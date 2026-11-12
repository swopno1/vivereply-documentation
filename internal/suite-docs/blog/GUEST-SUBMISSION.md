# Guest Submissions

Travelers submit stories at `/blog/submit`. The page is available in English and Bengali and needs no account. Submissions go through an anti-abuse pipeline before anything is written to the database. Depending on settings, a story then goes to the moderation queue or straight to the blog.

## Files

| Piece | File |
|---|---|
| Page (server; reads settings per request, signs the form token) | `src/app/blog/submit/page.tsx` |
| Form (client; mirrors server validation) | `src/app/blog/submit/GuestSubmissionForm.tsx` |
| Intro and guidelines | `src/app/blog/submit/GuestSubmitIntro.tsx`; text in `en.ts` / `bn.ts` → `blogGuest.guidelines` |
| Success page | `src/app/blog/submit/success/` (`?status=pending` or `live`) |
| Endpoint | `POST /api/blog/submit` (`src/app/api/blog/submit/route.ts`), multipart |
| Pure rules (unit-tested) | `src/lib/blog/guest-pipeline.ts`, `guest-rules.ts`, `form-token.ts` |
| Blocklists | `src/content/blog/spam-terms.ts` |
| Captcha | `src/lib/blog/turnstile.ts` |
| Images | `src/lib/blog/images.ts`, `storage.ts` |

A Route Handler is used instead of a Server Action because three 5 MB photos exceed the 1 MB Server Action body limit. Raising that limit globally would widen every action's attack surface.

## When the form is open

The form renders only when **all** of these hold. Otherwise the page shows "Submissions are closed" and the endpoint returns `guest_disabled` (503).

- `guestPostsEnabled` is on.
- Turnstile is usable. Production needs `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`. Development falls back to Cloudflare's always-pass test keys.
- Image storage is usable: R2 configured, or local `public/uploads/` in development.
- At least one active category is open to guests (`guestAllowedCategories`, empty = all).

## Pipeline, in order

Every rejection writes a `BlogSubmissionAttempt` row: salted IP hash, email, title, status, and reason. Rows marked "counts" below count toward the rate limit, as does the transient `IN_PROGRESS` reservation.

| # | Check | On failure | Attempt status | Counts |
|---|---|---|---|:-:|
| 1 | **Honeypot**: the hidden `website` field must be empty | Fake success (bots learn nothing) | `REJECTED_BOT` | ✅ |
| 2 | **Time gate**: server-signed render time (HMAC with `BETTER_AUTH_SECRET`) must be 5 s – 2 h old | `too_fast` / `form_expired` | `REJECTED_BOT` | ✅ |
| 3 | **Rate limit** per IP: `guestRateLimitPerHour` (default 2) and `guestRateLimitPerIp` per 24 h (default 3). Count and reservation run under a Postgres advisory lock on the IP hash, so parallel requests cannot all pass. Passing requests reserve a counted `IN_PROGRESS` row, which is updated to the final outcome. | `rate_limited` (429) | `RATE_LIMITED` | — |
| 4 | **Turnstile** server verification (single-use token) | `captcha_failed` (403) | `TURNSTILE_FAILED` | ✅ |
| 5 | **Fields**: name 2–80; valid email; BD mobile `^(?:\+?88)?01[3-9]\d{8}$` after stripping spaces and dashes; bio ≤ 200; title 10–100; excerpt 100–300; content `guestMinContentLength`–`guestMaxContentLength`; agreement ticked | `invalid_input` + per-field codes | `INVALID` | — |
| 6 | **Category** must be open to guests | `invalid_input` (`categoryId: not_allowed`) | `INVALID` | — |
| 7 | **Images**: `guestMinImages`–`guestMaxImages`; alt text on each; type by magic bytes within `allowedMimeTypes`; ≤ `maxImageSizeMb`; no duplicate within the submission | `image_count` / `image_alt_required` / `image_type` / `image_too_large` / `image_duplicate` | `INVALID` | — |
| 8 | **Disposable email** (54 domains) | `disposable_email` | `REJECTED_SPAM` | ✅ |
| 9 | **Keyword blocklist**: whole-word, case-insensitive | `spam_detected` | `REJECTED_SPAM` | ✅ |
| 10 | **URL density**: more than `guestMaxUrls` (default 3) external links (own domain excluded) | `too_many_urls` | `REJECTED_SPAM` | ✅ |
| 11 | **Duplicate content**: SHA-256 of the case- and whitespace-normalized body matches any post from the last 7 days | `duplicate_content` | `REJECTED_SPAM` | ✅ |

Soft flags do not reject. They force `PENDING` even when auto-publish is on, and the reason is stored in `BlogPost.flagReason` for the moderator:

- any external URL while `guestAllowUrls` is off;
- more than `guestMaxCapsWords` (default 10) ALL-CAPS words of four or more letters.

Invalid-field attempts do not count toward the rate limit, so a real guest who mistypes a phone number is not locked out. Bot and spam outcomes do count.

**Client IP.** The endpoint uses `X-Real-IP`, or the **last** `X-Forwarded-For` entry (the one our reverse proxy appends). It never uses the first entry, because a client can forge it. The reverse proxy must set one of these headers. The raw IP is stored on the post (`authorIp`, shown to moderators). Attempt rows store only a salted hash.

### Spec conflicts and how they were resolved

- §4.4 says spam keywords **flag** a post. §10 and the success criteria ("spam is filtered before it reaches the moderation queue") say **reject**. Keywords reject. ALL-CAPS and "URLs while disallowed" flag.
- §10 "URL density > 3 → reject" is configurable via `guestMaxUrls`. §4.4 "reject URLs if never allowed" is the `guestAllowUrls` flag, which holds posts for review rather than rejecting them.

**Retention.** `GET /api/cron/blog-attempts-cleanup` (with the `CRON_SECRET` bearer, like the other cron routes) deletes attempt rows older than 90 days. Schedule it daily. The rate limit only looks back 24 hours, so cleanup never weakens it.

**Reviewing abuse.** Attempts are plain rows, so they can be queried directly, for example the top rejection reasons this week:

```sql
SELECT status, reason, count(*) FROM "BlogSubmissionAttempt"
WHERE "createdAt" > now() - interval '7 days'
GROUP BY 1, 2 ORDER BY 3 DESC;
```

## After the checks pass

1. Create the `BlogPost`: `source = GUEST`, `status = PENDING`, a slug of `slugify(title)` plus a random 6-hex suffix (Bengali titles use `travel-story-xxxxxx`), and the content hash and flag reason.
2. Store each image at `blog/{postId}/{sha256}.{ext}` plus a `-600w.webp` variant, and add a `BlogImage` row. The first photo becomes the cover. If storage fails, the post and any stored files are removed and the guest gets `storage_unavailable`.
3. If `guestModerationRequired` is off **and** there are no flags, set `PUBLISHED` and `publishedAt = now`.
4. Log a `SUCCESS` attempt, and write an `AuditLog` row (`GUEST_SUBMIT_BLOG_POST`, with IP).
5. After the response is sent (`after()`), send emails. A mail outage never fails a submission.

## Emails

Templates live in `src/lib/email/blog.ts`, with text in `en.ts` / `bn.ts` → `blogEmails`. A guest's language is not stored, so every email contains English then Bengali. Guest-supplied text is HTML-escaped, and subjects are forced onto one line. Without `RESEND_API_KEY`, emails are logged as `[Mock Resend Email] to=… subject=… body=…`.

| Email | To | When | Content |
|---|---|---|---|
| Received | guest | on submit, if `sendGuestConfirmation` | "We received your story: {title}". Pending: "Our editors will review it…". Live: "It is now live" + link |
| New submission | `notifyEmail` | on submit, if set | name, email, phone, title, status, flag reason, link to `/admin/blog/pending` |
| Approved | guest | on approval (see MODERATION.md) | "Your story is live: {title}" + link |
| Rejected | guest | on rejection | "About your story: {title}" + the moderator's reason |

## Images

These rules apply to guest and staff uploads alike (`src/lib/blog/images.ts`):

- **Type** is checked by magic bytes (JPEG, PNG, WebP), not by file name, and must be in `allowedMimeTypes`.
- **Size** must be ≤ `maxImageSizeMb`. The endpoint also rejects oversized request bodies before reading them.
- **Decode** with sharp. Inputs over about 50 megapixels are refused as a decompression-bomb guard.
- **Auto-orient** from EXIF, then **strip all metadata** (EXIF, GPS). Verified by `images.test.ts` and on a real upload.
- **Resize** so the longest side is at most **2400 px** (never upscaled), then re-encode in the original format.
- **Variant**: a 600 px wide WebP (`-600w.webp`) for grids and lists.
- **Hash**: SHA-256 of the processed bytes. A second copy of the same image on one post is rejected.
- **Storage key**: `blog/{postId}/{hash}.{ext}` on R2. In development without R2, files go to `public/uploads/` (git-ignored). Production without R2 fails closed.
- **Alt text** is required on every image, for guests and staff. A missing alt is reported inline.
- **Deletion**: a hard delete of a post, or removing an image in the editor, deletes the R2 objects (original + variant). Archiving keeps them.
- **Serving**: all images render through `next/image`. `next.config.ts` allows `*.r2.dev` and the `R2_PUBLIC_DOMAIN` host, which is read at **build** time.

Staff upload through `POST /api/admin/blog/images` (STAFF+, ownership-checked, `staffMaxImages`). Uploads unlock once the post has been saved as a draft.

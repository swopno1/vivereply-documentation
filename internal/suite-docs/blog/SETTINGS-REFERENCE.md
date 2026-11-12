# Blog Settings Reference

- **Where:** `/admin/blog/settings`. OWNER only, and the OWNER must have 2FA (`requireMfa`).
- **Stored in:** the `BlogSettings` singleton (`id = "singleton"`), inserted by migration `blog_hardening`.
- **When changes apply:** `getBlogSettings()` (`src/lib/blog/queries.ts`) reads the row on every request, with no cross-request cache, so a change applies on the next request. No deploy is needed. The save also revalidates the admin views, `/blog`, `/feed.xml`, and the sitemap, so cached public pages refresh at once.
- **Validation:** `settingsInputSchema` in `src/lib/blog/schemas.ts`. An out-of-range value is rejected with an inline error, and nothing is saved.
- **Audit:** each save writes one `AuditLog` row (`UPDATE_BLOG_SETTINGS`) whose `diff` holds **only the changed fields**, as `{ before: {...}, after: {...} }`. A save with no changes writes nothing.

## Guest submissions

| Setting | Default | Range | Impact |
|---|---|---|---|
| `guestPostsEnabled` | `true` | on/off | Off: `/blog/submit` shows "Submissions are closed" and the endpoint returns `guest_disabled`. |
| `guestModerationRequired` | `true` | on/off | On: every guest post is `PENDING`. Off: clean guest posts publish immediately; flagged posts still wait. |
| `guestMinImages` | `1` | 0–10, ≤ max | Fewer photos → `image_count`. |
| `guestMaxImages` | `3` | 1–10 | More photos → `image_count`. Also caps the form's "Add photo" button and the request-size guard. |
| `guestMinContentLength` | `300` | 100–50 000, < max | Story body minimum (characters, after trimming). |
| `guestMaxContentLength` | `10000` | 500–50 000 | Story body maximum. |
| `guestAllowedCategories` | empty (all) | any existing category IDs | Limits the guest category dropdown. The server rejects other IDs (`not_allowed`). Stored as a JSON array, or `null` for all. |
| `guestRequireEmailVerify` | `false` | — (disabled in UI) | Reserved. Shown disabled, with a "coming soon" tooltip. Has no effect. |

## Spam protection

| Setting | Default | Range | Impact |
|---|---|---|---|
| `guestRateLimitPerHour` | `2` | 1–100, ≤ per-24h | Counted attempts from one IP in the last hour. Reaching it → `rate_limited` (429). |
| `guestRateLimitPerIp` | `3` | 1–100 | Counted attempts from one IP in the last 24 h. Counted = success, spam, bot, or captcha failures. Plain field mistakes are not counted. |
| `guestAllowUrls` | `true` | on/off | Off: any external link holds the post as `PENDING` with a flag reason. It is not rejected. |
| `guestMaxUrls` | `3` | 0–20 | More external links than this → rejected (`too_many_urls`). Links to the resort's own domain don't count. |
| `guestMaxCapsWords` | `10` | 0–100 | More ALL-CAPS words (4+ letters) than this → held as `PENDING` with a flag reason. |

The keyword and disposable-email lists are code, not settings: `src/content/blog/spam-terms.ts`.

## Staff posts

| Setting | Default | Range | Impact |
|---|---|---|---|
| `staffMaxImages` | `10` | 0–50 | Body photos per post (the cover is not counted). Enforced on upload and on save. |
| `staffPostsAutoPublish` | `true` | on/off | Off: nobody can "Publish now" or "Schedule". Posts go live only through approval in the moderation queue. MANAGER+ can still re-save a post that is already live. STAFF can never publish, whatever this is set to. |

## Photos

| Setting | Default | Range | Impact |
|---|---|---|---|
| `allowedMimeTypes` | JPEG, PNG, WebP | non-empty subset of those three | Checked by file signature (magic bytes), for guests and staff. Also sets the file picker's `accept`. |
| `maxImageSizeMb` | `5` | 1–20 | Per-photo limit on the uploaded file, before processing. |

## Notifications

| Setting | Default | Range | Impact |
|---|---|---|---|
| `notifyEmail` | empty | valid email or empty | Receives "New guest submission from {name}" for every accepted guest post, including the flag reason. Empty = no alerts. |
| `sendGuestConfirmation` | `true` | on/off | Guests get "We received your story" on submit. Approval and rejection emails are always sent. |

## Public blog

| Setting | Default | Range | Impact |
|---|---|---|---|
| `postsPerPage` | `12` | 3–48 | Page size on `/blog`, `/blog/category/*`, and `/blog/tag/*`. |
| `showAuthorName` | `true` | on/off | Hides the byline, author bio block, and the Article `author` name. Schema falls back to the organization. |
| `enableRss` | `true` | on/off | Off: `/feed.xml` returns 404. (The site-wide `<link rel="alternate">` in the layout stays, as it is shared with non-blog pages.) |

The admin list page size is fixed at 20 (spec §3.3) and is not a setting.

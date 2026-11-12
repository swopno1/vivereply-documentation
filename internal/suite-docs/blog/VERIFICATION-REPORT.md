# Blog Verification Report

- **Date:** 2026-09-29
- **Branch:** `blog-finalize`
- **Environment:** macOS, Node 24, Next.js 16.3.5, local PostgreSQL 16 (`docker-compose.dev.yml`)

Everything below is **raw output** captured during the run. Nothing is claimed without the output that shows it.

**How the environment was set up:**
- Functional flows ran against `pnpm dev` on `localhost:3000`, driven by Playwright (Chromium) or by a Node `fetch` script that does what the form does.
- **R2 is not configured locally.** Images used the development fallback (`public/uploads/`). Real R2 upload and delete were **not** exercised.
- **Resend is not configured.** Emails were captured from the mock sender's `[Mock Resend Email]` log lines.
- **Turnstile** used Cloudflare's official always-pass test keys (the development fallback). The failure branch is covered by code review and unit tests only; no always-fail key was run.
- Different client IPs were simulated with the `X-Real-IP` header. In production the reverse proxy must set that header (GUEST-SUBMISSION.md → Client IP).
- Test accounts were created locally for the run and deleted afterwards: `blog.manager@…` (MANAGER), `blog.staff@…` (STAFF), and `blog.owner@…` (OWNER, with real TOTP 2FA enrolled through `/admin/setup-2fa`).

## Summary

| # | Check (spec §11) | Result |
|---|---|---|
| 1 | `pnpm build` | ✅ exit 0 |
| 2 | `pnpm lint`, zero warnings | ✅ exit 0, 0 warnings (also `tsc --noEmit` exit 0, `pnpm test` 96 passed) |
| 3 | Staff flow (MANAGER create → draft → edit → publish → on `/blog`) | ✅ |
| 4 | Guest flow, moderation on (submit → queue → approve → public) | ✅ |
| 5 | Guest flow, auto-publish on | ✅ |
| 6 | Guest rejection with reason, reason emailed | ✅ (mock email log) |
| 7 | 4 images with `guestMaxImages = 3` | ✅ rejected (UI caps at 3; API returns `image_count`) |
| 8 | 4th submission from one IP with `guestRateLimitPerIp = 3` | ✅ rejected. **This check found a bug:** parallel requests bypassed the limit. Fixed in `a41d730` and re-tested. |
| 9 | Content with 5 external URLs | ✅ rejected (`too_many_urls`) |
| 10 | Mobile, 360 px | ✅ no horizontal overflow on 9 pages; no interactive element under 44 px on `/blog/submit` |
| 11 | Bengali on `/blog/submit` | ✅ labels and errors translated |
| 12 | Schema / Google Rich Results Test | ⚠️ Local structural validation: 12/12 PASS. **Google Rich Results Test NOT RUN**, because it needs a publicly reachable URL and none was available. |
| 13 | RSS contains published posts only | ✅ |
| 14 | Sitemap lists published posts only | ✅ |
| 15 | Role enforcement (STAFF publish refused; no access without a role) | ✅, with one caveat on the HTTP status code (see 15) |

Extra checks beyond §11 (all ✅): OWNER settings page requires 2FA; settings validation and diff-only audit; honeypot; time gate; disposable email; duplicate content; scheduled post hidden until due; published-slug rename redirect; bulk delete removing stored files; EXIF stripping and the 2400 px cap on a real upload.

---

## 1–2. Build, lint, types, tests (final code)

### `pnpm lint`
```
$ eslint . && pnpm check:guards && pnpm check:money
$ bash scripts/check-admin-api-guards.sh && bash scripts/check-admin-actions-guards.sh && for f in src/app/actions/blog/*.ts; do bash scripts/check-admin-actions-guards.sh "$f" || exit 1; done
✓ All admin, cron and webhook route handlers are guarded
✓ Every exported Server Action in src/app/actions/admin-actions.ts calls a guard
✓ Every exported Server Action in src/app/actions/blog/moderation.ts calls a guard
✓ Every exported Server Action in src/app/actions/blog/posts.ts calls a guard
✓ Every exported Server Action in src/app/actions/blog/settings.ts calls a guard
✓ Every exported Server Action in src/app/actions/blog/taxonomy.ts calls a guard
$ bash scripts/check-no-float-money.sh
✓ No legacy Float money field names outside src/lib/money-legacy.ts
exit=0
```

### `pnpm exec tsc --noEmit -p .`
```
exit=0
```

### `pnpm test`
```
$ vitest run
 RUN  v4.1.11 /Users/mdamirhossain/ViveScript-Solutions/projects/TravelWebTemplate
 Test Files  7 passed | 1 skipped (8)
      Tests  96 passed | 1 skipped (97)
   Start at  16:55:05
   Duration  1.03s (transform 337ms, setup 0ms, import 883ms, tests 641ms, environment 1ms)
exit=0
```

### `pnpm build` (blog-related lines of the route table)
```
✓ Running next.config.ts took 118ms
  ✓ authInterrupts
✓ Compiled successfully in 2.6s
✓ Generating static pages using 7 workers (77/77) in 1387ms
Route (app)                                         Revalidate  Expire
├ ƒ /admin/blog
├ ƒ /admin/blog/[id]
├ ƒ /admin/blog/[id]/preview
├ ƒ /admin/blog/categories
├ ƒ /admin/blog/new
├ ƒ /admin/blog/pending
├ ƒ /admin/blog/pending/[id]
├ ƒ /admin/blog/settings
├ ƒ /admin/blog/tags
├ ƒ /api/admin/blog/images
├ ƒ /api/blog/submit
├ ƒ /api/cron/blog-attempts-cleanup
├ ƒ /blog
├   /blog/[slug]
│ └ ● /blog/ultimate-coxs-bazar-travel-guide                1h      1y
├ ƒ /blog/category/[slug]
├ ƒ /blog/submit
├ ƒ /blog/submit/success
├ ƒ /blog/tag/[slug]
├ ○ /feed.xml                                               1h      1y
├ ○ /sitemap.xml                                            1h      1y
○  (Static)   prerendered as static content
●  (SSG)      prerendered as static HTML (uses generateStaticParams)
ƒ  (Dynamic)  server-rendered on demand
exit=0
```
`/blog/[slug]` is statically generated (●) with a 1 h revalidate. Before this work it was dynamic (ƒ), because it read `searchParams`.

## Settings (OWNER + 2FA, validation, audit diff)
```
[OWNER without 2FA] GET /admin/blog/settings -> redirected to http://localhost:3000/admin/setup-2fa
[OWNER after TOTP enrollment] afterVerify=/admin/settings; GET /admin/blog/settings -> h1 "Blog settings"
[UI] set guestRateLimitPerHour=3, Save -> role=status "Settings saved."
[UI] set guestMinImages=5 (> max 3), Save -> inline "Please check this value." + "Please fix the highlighted fields."
DB after: guestMinImages | guestMaxImages | guestRateLimitPerHour | guestRateLimitPerIp
          1 | 3 | 3 | 3
AuditLog: UPDATE_BLOG_SETTINGS | {"after": {"guestRateLimitPerHour": 3}, "before": {"guestRateLimitPerHour": 2}}
```

## 3. Staff flow (MANAGER)
```
Playwright (MANAGER blog.manager@demo.resort, 1280px):
[{"step":"draft saved","slug":"best-time-to-visit-coxs-bazar-a-month-by-month-guide","editUrl":"/admin/blog/cmumjp5vq0001ighnxhf4oryu?created=1"}]
[{"step":"cover uploaded","coverImgSrc":"/_next/image?url=%2Fuploads%2Fblog%2Fcmumjp5vq0001ighnxhf4oryu%2F90d02d087ccb6549d1ca014b55ee42d0a693c5d5f808897ef53a8e73b9f4458f.jpg&w=3840&q=75"},
 {"step":"edited","status":"Saved."},
 {"step":"published","subtitle":"Current status: Published Tue, Sep 29, 2026"},
 {"step":"public","listedLinks":2,"h1":"Best time to visit Cox's Bazar: month by month","directAnswer":"The best time to visit Cox's Bazar is November to February, when rain is rare and the sea is calm enough to swim."}]
(listedLinks=2: the card links the cover image and the title to the post)
```
```
$ select slug,status,source,"publishedAt" from BlogPost where id=cmumjp5vq0001ighnxhf4oryu
slug | status | source | publishedAt | coverImageUrl
best-time-to-visit-coxs-bazar-a-month-by-month-guide | PUBLISHED | STAFF | 2026-09-29 10:40:35.587 | /uploads/blog/cmumjp5vq0001ighnxhf4oryu/90d02d087ccb6549d1ca014b55ee42d0a693c5d5f808897ef53a8e73b9f4458f.jpg
(1 row)
$ audit trail
action | email | diff
CREATE_BLOG_POST | blog.manager@demo.resort | {"after": {"slug": "best-time-to-visit-coxs-bazar-a-month-by-month-guide", "title": "Best time to visit Cox's Bazar: a month-by-month guide", "status": "DRAFT", "publishedAt": null}, "before": null}
UPLOAD_BLOG_IMAGE | blog.manager@demo.resort | 
UPDATE_BLOG_POST | blog.manager@demo.resort | {"after": {"slug": "best-time-to-visit-coxs-bazar-a-month-by-month-guide", "title": "Best time to visit Cox's Bazar: month by month", "status": "DRAFT", "publishedAt": null}, "before": {"slug": "best-time-to-visit-coxs-bazar-a-month-by-month-guide", "title": "Best time to visit Cox's Bazar: a month-by-month guide", "status": "DRAFT"}}
PUBLISH_BLOG_POST | blog.manager@demo.resort | {"after": {"slug": "best-time-to-visit-coxs-bazar-a-month-by-month-guide", "title": "Best time to visit Cox's Bazar: month by month", "status": "PUBLISHED", "publishedAt": "2026-09-29T10:40:35.587Z"}, "before": {"slug": "best-time-to-visit-coxs-bazar-a-month-by-month-guide", "title": "Best time to visit Cox's Bazar: month by month", "status": "DRAFT"}}
(4 rows)
```

## 4. Guest flow with moderation on
The guest submitted at a 360 px viewport through the real form (Turnstile widget, 6 s wait, photo upload). The MANAGER approved the post with the quick action in `/admin/blog/pending`.
```
$ curl /blog/walking-the-tea-estates-of-sreemangal-6fdeb2
HTTP 200
<h1 lang="en" class="font-display text-2xl font-bold leading-tight text-white sm:text-4xl">Walking the tea estates of Sreemangal
data-direct-answer
$ audit
action | who | ipAddress | diff
GUEST_SUBMIT_BLOG_POST | (guest) | 203.0.113.10 | {"after": {"slug": "walking-the-tea-estates-of-sreemangal-6fdeb2", "title": "Walking the tea estates of Sreemangal", "status": "PENDING"}, "before": null}
APPROVE_BLOG_POST | blog.manager@demo.resort | ::1 | {"after": {"status": "PUBLISHED"}, "before": {"status": "PENDING"}}
(2 rows)
$ attempts for 203.0.113.10
status | reason
SUCCESS | Created as PENDING
(1 row)
$ dev server mock email log
[Mock Resend Email] to=rafiq.hasan@outlook.com subject="We received your story: Walking the tea estates of Sreemangal | আপনার গল্পটি আমরা পেয়েছি: Walking the tea estates of Sreemangal" body="Dear Rafiq Hasan, প্রিয় Rafiq Hasan, Thank you for sharing your travel story "Walking the tea estates of Sreemangal". Our editors will re
[Mock Resend Email] to=rafiq.hasan@outlook.com subject="Your story is live: Walking the tea estates of Sreemangal | আপনার গল্প প্রকাশিত হয়েছে: Walking the tea estates of Sreemangal" body="Dear Rafiq Hasan, প্রিয় Rafiq Hasan, Good news! Your story "Walking the tea estates of Sreemangal" has been approved and is now published on
```
EXIF and resize, checked on the first UI submission of this run (a 3200×2000 JPEG carrying EXIF `Make`/`Model`):
```
$ sharp(<stored file>).metadata()
stored: 2400x1500 exif: false
```

## 5. Guest flow with auto-publish on
```
$ settings: guestModerationRequired set OFF via /admin/blog/settings (OWNER+2FA) -> Settings saved.
diff
{"after": {"guestModerationRequired": false}, "before": {"guestModerationRequired": true}}
(1 row)
$ node guest-submit.mjs 203.0.113.11 autopub 1
POST /api/blog/submit [ip=203.0.113.11 label=autopub images=1] -> HTTP 200 {"ok":true,"data":{"status":"PUBLISHED"}}
$ DB
slug | status | source | unmoderated
verification-story-autopub-from-the-coast-f9fd24 | PUBLISHED | GUEST | t
(1 row)
$ curl /blog/verification-story-autopub-from-the-coast-f9fd24
HTTP 200
links to it on /blog: 1
```
After this check, moderation was switched back on in the settings UI.

## 6. Guest rejection
```
$ node guest-submit.mjs 203.0.113.12 reject 1
POST /api/blog/submit [ip=203.0.113.12 label=reject images=1] -> HTTP 200 {"ok":true,"data":{"status":"PENDING"}}
(MANAGER rejected in /admin/blog/pending/[id] with reason + internal note)
status | rejectionReason | moderationNote
REJECTED | Thanks for writing in! Your story needs more detail about the trip itself: where you stayed, what you did each day, and a photo you took. | Reads like a test; asked for a real trip report.
(1 row)
action | email | diff
REJECT_BLOG_POST | blog.manager@demo.resort | {"after": {"status": "REJECTED"}, "before": {"status": "PENDING"}}
(1 row)
$ dev server log (Resend not configured -> mock sender logs the message)
[Mock Resend Email] to=traveler.reject@gmail.com subject="We received your story: Verification story reject from the coast | আপনার গল্পটি আমরা পেয়েছি: Verification story reject from the coast" body="Dear Test Traveler, প্রিয় Test Traveler, Thank you for sharing your travel story "Verification story reject from the coast". Our editors will review it and email you once it is published. আপনার ভ্রমণের গল্প "Verification story reject from the coast" শেয়ার করার জন্য ধন্যবাদ। আমাদের সম্পাদকরা এটি পর্যালোচনা করবেন এবং প্রকাশিত হলে আপনাকে ইমেইলে জানাবেন। The Client Resort &amp; Spa editorial team Client Resort &amp; Spa সম্পাদকীয় দল"
[Mock Resend Email] to=traveler.reject@gmail.com subject="About your story: Verification story reject from the coast | আপনার গল্প সম্পর্কে: Verification story reject from the coast" body="Dear Test Traveler, প্রিয় Test Traveler, Thank you for submitting "Verification story reject from the coast". After review, our editors could not publish it this time. "Verification story reject from the coast" জমা দেওয়ার জন্য ধন্যবাদ। পর্যালোচনার পর আমাদের সম্পাদকরা এবার এটি প্রকাশ করতে পারেননি। Reason / কারণ: Thanks for writing in! Your story needs more detail about the trip itself: where you stayed, what you did each day, and a photo you took. You're welcome to revise your story and submit it again. লে
```

## 7–9. Image limit, rate limit, URL density, and other abuse checks
UI: after two clicks on "Add another photo", the form has 3 photo slots and the button disappears (`{"photoSlots":3,"addButtonVisibleAt3":0}`). The API calls below bypass the UI on purpose.
```
$ guestMaxImages=3; submit 4 images
POST /api/blog/submit [ip=203.0.113.30 label=fourimages images=4] -> HTTP 400 {"ok":false,"error":"image_count","params":{"min":1,"max":3}}

$ guestRateLimitPerIp=3 (and per hour 3); 4 submissions from 203.0.113.20
POST /api/blog/submit [ip=203.0.113.20 label=ratelimit4 images=1] -> HTTP 200 {"ok":true,"data":{"status":"PENDING"}}
POST /api/blog/submit [ip=203.0.113.20 label=ratelimit2 images=1] -> HTTP 200 {"ok":true,"data":{"status":"PENDING"}}
POST /api/blog/submit [ip=203.0.113.20 label=ratelimit1 images=1] -> HTTP 200 {"ok":true,"data":{"status":"PENDING"}}
POST /api/blog/submit [ip=203.0.113.20 label=ratelimit3 images=1] -> HTTP 200 {"ok":true,"data":{"status":"PENDING"}}

$ 5 external URLs in content (guestMaxUrls=3)
POST /api/blog/submit [ip=203.0.113.40 label=urls images=1] -> HTTP 400 {"ok":false,"error":"too_many_urls","params":{"max":3}}

$ time gate: submitted 1s after page load
POST /api/blog/submit [ip=203.0.113.50 label=toofast images=1] -> HTTP 400 {"ok":false,"error":"too_fast"}

$ AFTER FIX (advisory lock): 4 concurrent submissions from 203.0.113.21
POST /api/blog/submit [ip=203.0.113.21 label=lockrate1 images=1] -> HTTP 429 {"ok":false,"error":"rate_limited"}
POST /api/blog/submit [ip=203.0.113.21 label=lockrate3 images=1] -> HTTP 200 {"ok":true,"data":{"status":"PENDING"}}
POST /api/blog/submit [ip=203.0.113.21 label=lockrate2 images=1] -> HTTP 200 {"ok":true,"data":{"status":"PENDING"}}
POST /api/blog/submit [ip=203.0.113.21 label=lockrate4 images=1] -> HTTP 200 {"ok":true,"data":{"status":"PENDING"}}
$ and a 5th, sequential, from the same IP
POST /api/blog/submit [ip=203.0.113.21 label=lockrate5 images=1] -> HTTP 429 {"ok":false,"error":"rate_limited"}
status | reason
SUCCESS | Created as PENDING
SUCCESS | Created as PENDING
SUCCESS | Created as PENDING
RATE_LIMITED | hour=3 day=3
RATE_LIMITED | hour=3 day=3
(5 rows)

$ spec case: 4 sequential submissions from 203.0.113.22 (guestRateLimitPerIp=3)
POST /api/blog/submit [ip=203.0.113.22 label=seqrate1 images=1] -> HTTP 200 {"ok":true,"data":{"status":"PENDING"}}
POST /api/blog/submit [ip=203.0.113.22 label=seqrate2 images=1] -> HTTP 200 {"ok":true,"data":{"status":"PENDING"}}
POST /api/blog/submit [ip=203.0.113.22 label=seqrate3 images=1] -> HTTP 200 {"ok":true,"data":{"status":"PENDING"}}
POST /api/blog/submit [ip=203.0.113.22 label=seqrate4 images=1] -> HTTP 429 {"ok":false,"error":"rate_limited"}

$ honeypot filled (bot) -> silent fake success, nothing created
POST /api/blog/submit [ip=203.0.113.60 label=honeypot images=1] -> HTTP 200 {"ok":true,"data":{"status":"PENDING"}}

$ disposable email domain
POST /api/blog/submit [ip=203.0.113.61 label=disposable images=1] -> HTTP 400 {"ok":false,"error":"disposable_email"}

$ duplicate content within 7 days (same body as a previous submission)
POST /api/blog/submit [ip=203.0.113.62 label=dupefirst images=1] -> HTTP 200 {"ok":true,"data":{"status":"PENDING"}}
POST /api/blog/submit [ip=203.0.113.63 label=dupesecond images=1] -> HTTP 400 {"ok":false,"error":"duplicate_content"}
status | reason | email
REJECTED_BOT | Honeypot field filled | traveler.honeypot@gmail.com
REJECTED_SPAM | Disposable email domain | someone@mailinator.com
SUCCESS | Created as PENDING | traveler.dupefirst@gmail.com
REJECTED_SPAM | Duplicate of post cmumjzmnj0027ighnlg14p50j | traveler.dupesecond@gmail.com
(4 rows)
posts_created_for_honeypot
0
(1 row)
```
**Finding:** the first rate-limit run (4 **concurrent** requests from 203.0.113.20) accepted all four. The count and the insert were separate statements. Fix `a41d730` serializes the check per IP with `pg_advisory_xact_lock` and reserves a counted `IN_PROGRESS` row. After the fix, the concurrent run from 203.0.113.21 accepted exactly 3, and the spec's sequential case from 203.0.113.22 rejected the 4th with 429.

## 10. Mobile, 360 px
```
/blog/submit (en): {"photoSlots":3,"addButtonVisibleAt3":0,"overflowPx":-15,"smallTargets":[]}
scrollWidth - innerWidth (negative = no horizontal overflow; -15 is the scrollbar):
{"blog-listing":-15,"blog-post":-15,"blog-post-bn":-15,"blog-category":-15,
 "admin-list":-15,"admin-editor":-15,"admin-queue":-15,"admin-categories":-15}
```
`smallTargets` lists every visible button, input, select, textarea, and link in `<main>` shorter than 44 px, excluding checkboxes (which sit inside ≥ 44 px labels). It is empty. The phone flow was driven by automation, so "under 3 minutes for a person" was **not** timed with a human.

## 11. Bengali (`/blog/submit?lang=bn`, empty submit)
```
{"bnHeading":"আপনার ভ্রমণের গল্প শেয়ার করুন",
 "bnLabels":["এই ঘরটি খালি রাখুন","পুরো নাম","ইমেইল","মোবাইল নম্বর","সংক্ষিপ্ত পরিচিতি (ঐচ্ছিক)","গল্পের শিরোনাম"],
 "bnTopError":"চিহ্নিত ঘরগুলো ঠিক করুন।",
 "bnFieldErrors":["এই ঘরটি পূরণ করা আবশ্যক।","একটি সঠিক ইমেইল ঠিকানা দিন।","একটি বাংলাদেশি মোবাইল নম্বর দিন, যেমন 01712345678।","1 থেকে 3টি ছবি যুক্ত করুন।","লেখাটি যে আপনার নিজের, তা নিশ্চিত করুন।"],
 "bnSubmit":"আমার গল্প পাঠান"}
```
(The first label is the visually hidden honeypot.) The post page at `?lang=bn` showed `এই লেখাটি শুধু ইংরেজিতে পাওয়া যাচ্ছে।` for an English-only post.

Known gap: the native file input's "Choose file / No file chosen" text comes from the browser's locale, not the site language.

## 12. Schema
Local structural validation of the JSON-LD on a published post:
```
{
 "type": "Article",
 "headline": "Best time to visit Cox's Bazar: month by month",
 "author": {
  "@type": "Person",
  "name": "Mina Manager"
 },
 "image": [
  "https://clientresort.com/uploads/blog/cmumjp5vq0001ighnxhf4oryu/90d02d087ccb6549d1ca014b55ee42d0a693c5d5f808897ef53a8e73b9f4458f.jpg"
 ],
 "datePublished": "2026-09-29T10:40:35.587Z",
 "dateModified": "2026-09-29T10:40:35.594Z",
 "crumbs": [
  "Home",
  "Blog",
  "Destination Guides",
  "Best time to visit Cox's Bazar: month by month"
 ]
}
PASS Article present
PASS headline <= 110 chars
PASS image is absolute URL array
PASS datePublished ISO 8601
PASS dateModified ISO 8601
PASS author.name present
PASS publisher references Organization
PASS articleBody is plain text
PASS mainEntityOfPage absolute
PASS BreadcrumbList present
PASS breadcrumb positions 1..n
PASS breadcrumb items absolute
<link rel="canonical" href="https://clientresort.com/blog/best-time-to-visit-coxs-bazar-a-month-by-month-guide"/>
<meta property="og:image" content="https://clientresort.com/uploads/blog/cmumjp5vq0001ighnxhf4oryu/90d02d087ccb6549d1ca014b55ee42d0a693c5d5f808897ef53a8e73b9f4458f.jpg"/>
<meta name="twitter:card" content="summary_large_image"/>
```
**Google Rich Results Test: NOT RUN.** It requires a publicly reachable URL, and no staging deployment was available. Run it after deploying this branch.

## 13–14. RSS and sitemap
Taken while 4 posts were live and 13 were pending or rejected:
```
$ posts by status
status | count
PENDING | 12
PUBLISHED | 4
REJECTED | 1
(3 rows)
$ live slugs
slug
best-time-to-visit-coxs-bazar-a-month-by-month-guide
ultimate-coxs-bazar-travel-guide
verification-story-autopub-from-the-coast-f9fd24
walking-the-tea-estates-of-sreemangal-6fdeb2
(4 rows)

$ curl -s /feed.xml | item links
<link>https://clientresort.com/blog/best-time-to-visit-coxs-bazar-a-month-by-month-guide</link>
<link>https://clientresort.com/blog/ultimate-coxs-bazar-travel-guide</link>
<link>https://clientresort.com/blog/verification-story-autopub-from-the-coast-f9fd24</link>
<link>https://clientresort.com/blog/walking-the-tea-estates-of-sreemangal-6fdeb2</link>

$ curl -s /sitemap.xml | blog URLs
<loc>https://clientresort.com/blog/best-time-to-visit-coxs-bazar-a-month-by-month-guide</loc>
<loc>https://clientresort.com/blog/category/destination-guides</loc>
<loc>https://clientresort.com/blog/submit</loc>
<loc>https://clientresort.com/blog/ultimate-coxs-bazar-travel-guide</loc>
<loc>https://clientresort.com/blog/verification-story-autopub-from-the-coast-f9fd24</loc>
<loc>https://clientresort.com/blog/walking-the-tea-estates-of-sreemangal-6fdeb2</loc>
<loc>https://clientresort.com/blog</loc>

$ any non-live slug in feed or sitemap?
three-misty-days-in-the-sajek-hills-a12e7d: 0
verification-story-ratelimit4-from-the-coast-096ff4: 0
verification-story-reject-from-the-coast-4ebf5e: 0
verification-story-ratelimit2-from-the-coast-8a47cc: 0
verification-story-ratelimit1-from-the-coast-852f5e: 0
verification-story-ratelimit3-from-the-coast-554288: 0
verification-story-lockrate3-from-the-coast-6fb5d2: 0
verification-story-lockrate2-from-the-coast-7c093e: 0
verification-story-seqrate1-from-the-coast-23aa96: 0
verification-story-lockrate4-from-the-coast-dc549e: 0
verification-story-seqrate2-from-the-coast-c16292: 0
verification-story-seqrate3-from-the-coast-91ee8d: 0
verification-story-dupefirst-from-the-coast-6d43d4: 0
```
Scheduled post (see below): `curl /feed.xml /sitemap.xml | grep -c monsoon-travel-checklist` returned `0`.

## 15. Role enforcement
```
$ STAFF direct publish attempt left no post behind:
count
0
(1 row)
$ anonymous (no session)
GET /admin/blog              -> 307 http://localhost:3000/admin/login?redirect=%2Fadmin%2Fblog
GET /admin/blog/settings     -> 307 http://localhost:3000/admin/login?redirect=%2Fadmin%2Fblog%2Fsettings
GET /admin/blog/pending      -> 307 http://localhost:3000/admin/login?redirect=%2Fadmin%2Fblog%2Fpending
POST /api/admin/blog/images -> {"error":"Unauthorized"} HTTP 401
$ Playwright as STAFF (blog.staff@demo.resort)
{"staffPublishOptions":["DRAFT","PENDING"],
 "payloadRewrittenToPublished":true,
 "serverResponseShownToStaff":"Only a manager or owner can publish. Submit the post for review instead.",
 "/admin/blog/pending":"200 403 - Access Denied You do not have the required permissions",
 "/admin/blog/settings":"200 403 - Access Denied You do not have the required permissions",
 "/admin/blog/categories":"200 403 - Access Denied You do not have the required permissions",
 "/admin/blog/tags":"200 403 - Access Denied You do not have the required permissions"}
(forbidden() renders the 403 page; the HTTP status is 200 because of the site-wide root loading.tsx streaming, see SEO-INTEGRATION.md)
```
**Caveat, pre-existing and site-wide:** `forbidden()` and `notFound()` render the correct 403 / 404 page, but the HTTP status is 200. The root `src/app/loading.tsx` streams every dynamic route. `/destinations/does-not-exist` behaves the same on a production build. Unauthenticated access is still a 307 to login, and the admin API still returns 401. Details: SEO-INTEGRATION.md → Known limitation.

## Scheduling and slug stability
```
$ Playwright as MANAGER: schedule a post for tomorrow; rename a published slug
{"scheduledSubtitle":"Current status: Scheduled for Wed, Sep 30, 2026",
 "scheduledPublicPage":{"status":200,"showsNotFound":true},
 "renameWarning":"This post has been published. Changing the URL leaves a permanent redirect from the old address.",
 "oldSlugLandsOn":"http://localhost:3000/blog/coxs-bazar-best-time-to-visit"}
fromSlug | currentSlug
best-time-to-visit-coxs-bazar-a-month-by-month-guide | coxs-bazar-best-time-to-visit
(1 row)
$ scheduled post absent from feed/sitemap:
0
```

## Hard delete and stored-file cleanup
```
$ Bulk delete from /admin/blog as MANAGER ("select all" on the page, Delete, confirm)
confirm dialog: "Permanently delete 18 posts and their photos? This can't be undone."
delete_audit_rows | posts
18 | 18
(1 row)
stored files under public/uploads/blog after delete: 0 (16 empty folders left; fixed so folders are removed too)
NOTE: the selection included the pre-existing seeded post ultimate-coxs-bazar-travel-guide; it was re-created from src/content/blog/ultimate-coxs-bazar-travel-guide.md with its previous values (new id, updatedAt reset).
```
**Incident during cleanup:** "select all" on the admin list also selected the single pre-existing post in the local dev database. That post was deleted, then re-created from its seed file. Only the local dev DB was affected.

## Not verified
- Real Cloudflare R2 upload and delete (no credentials locally; the development fallback was used).
- Real email delivery through Resend (mock sender only).
- Turnstile failure branch against a live key.
- Google Rich Results Test (needs a public URL).
- Human timing of the phone submission.

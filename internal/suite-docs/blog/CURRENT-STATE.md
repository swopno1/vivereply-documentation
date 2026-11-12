# Blog System — Current State Audit

- Audited: 2026-09-29, commit `0d2d274` (`main`)
- Scope: the blog feature merged via `blog_crud` → `feature/blog-17354622685866433554`

This file replaces an earlier audit. That audit described the pre-database state (markdown files only). The documents that followed claimed more than the code delivers. Every row below was checked against source. Legend: ✅ confirmed in code · ⚠️ partial or stub · ❌ not found.

## 1. Infrastructure inventory

| Item | Status | Evidence |
|---|---|---|
| `/blog` route | ✅ | `src/app/blog/page.tsx` reads `PUBLISHED` rows from Prisma. Page size is hard-coded to 12 (it ignores `postsPerPage`), and search is a case-sensitive `contains`. |
| `/blog/[slug]` route | ⚠️ | `src/app/blog/[slug]/page.tsx` renders from the DB. It reads `searchParams` (`?lang`), which forces dynamic rendering, so `generateStaticParams` and `revalidate = 86400` have no effect. There is no Person schema and no author bio block. |
| `/blog/category/[slug]`, `/blog/tag/[slug]` | ⚠️ Stub | Each page is a 10-line `redirect()` to `/blog?category=` or `?tag=`. Neither is an indexable listing page. |
| `BlogPost` Prisma model | ✅ | `prisma/schema.prisma:256`, created in migration `20260929033828_init_postgres`. Also present: `BlogImage`, `BlogCategory`, `BlogTag`, `BlogSettings`, `BlogSubmissionAttempt`. |
| Blog content source | ✅ Database | `prisma/seed.ts` `seedBlog()` imports `src/content/blog/*.md` as `PUBLISHED` staff posts. ⚠️ It first runs `deleteMany` on every blog table, so re-seeding wipes real posts. |
| `src/content/blog/` | ✅ | Three seed markdown files, plus `spam-terms.ts` (16 keywords, 17 disposable domains). |
| `/feed.xml` | ⚠️ | `src/app/feed.xml/route.ts` serves `PUBLISHED` posts from the DB. It ignores the `enableRss` setting. |
| Article schema | ✅ | `getArticleSchema` and `getBreadcrumbSchema` are used in `src/app/blog/[slug]/page.tsx:162`. |
| Sitemap | ✅ | `src/app/sitemap.ts:93` lists only `PUBLISHED` slugs. |
| Admin routes | ⚠️ | `src/app/admin/blog/{page,new,[id],[id]/preview,pending,pending/[id],categories,tags,settings}` all exist. Their gaps are listed in §2. The nav entry is in `AdminShell.tsx:58`. |
| Markdown renderer | ✅ | `src/lib/markdown.ts` `renderAndSanitizeMarkdown` (`marked` + `sanitize-html`, allow-listed tags and schemes). |
| Lint / types | ✅ | `pnpm exec eslint .` reports no output (clean). `pnpm exec tsc --noEmit` exits 0. |

## 2. Requirement gaps (claimed in the previous docs vs. actual)

| Requirement | Status | Evidence |
|---|---|---|
| Cloudflare Turnstile | ❌ | Only a text label exists at `src/app/blog/submit/GuestSubmissionForm.tsx:352`. There is no widget and no server-side verification. |
| Image upload to R2 | ❌ | Staff and guests paste image **URLs**. `uploadBlogImageToR2` (`src/lib/storage/r2.ts:87`) is never called, and its unconfigured fallback returns a stock Unsplash URL. |
| SHA-256 image hash | ❌ | `contentHash` is the hex of the URL string (`src/app/actions/blog-actions.ts:268`), not a hash of the file bytes. |
| EXIF strip, 2400px cap, `-600w.webp` variant | ❌ | Not implemented. |
| Delete from R2 on hard delete | ❌ | Not implemented. |
| Time gate (5s) | ⚠️ | The client supplies `formLoadTimestamp` (`src/app/actions/guest-submission-actions.ts:62`), so a bot can spoof it. |
| Rate limit per IP, per hour and per day | ⚠️ | 24-hour window only. It uses raw `x-forwarded-for`. |
| Duplicate detection (content hash, 7 days) | ⚠️ | Compares `excerpt` equality instead (`guest-submission-actions.ts:137`). |
| URL density / ALL-CAPS / "URLs allowed" setting | ⚠️ | URL count flags a post but does not reject it. There is no ALL-CAPS rule and no setting for either. |
| Guest server-side validation | ⚠️ | These are not enforced on the server: email format, BD phone format, image count, image alt text, `guestAllowedCategories`, the agreement checkbox, and bio ≤ 200 characters. |
| Guest error messages | ❌ | Actions `throw`, and Next.js masks thrown Server Action messages in production, so guests see only a generic error. |
| Bilingual UI | ❌ | The submit form, success page, every admin blog screen, and all emails are hard-coded English. `en.ts`/`bn.ts` contain only `blogPage` (6 keys). |
| Settings honored | ⚠️ | Stored but not read: `postsPerPage`, `enableRss`, `sendGuestConfirmation`, `notifyEmail` (admin alerts go to the brand inbox via `sendLeadNotificationEmail`), `staffPostsAutoPublish`, `staffMaxImages`, `allowedMimeTypes`, `maxImageSizeMb`, `showAuthorName`. |
| Settings security | ⚠️ | `updateBlogSettingsAction` spreads unvalidated input into Prisma. `getBlogSettingsAction` is an unguarded exported Server Action that exposes `notifyEmail` to anyone. The settings page skips `requireMfa()`, which every other settings page calls. |
| Settings audit diff | ⚠️ | The audit logs the full before and after rows instead of a field-level diff. |
| Scheduled publishing | ❌ | `scheduledFor` is stored, but no job publishes it and the editor has no schedule control. |
| Immutable published slugs | ❌ | Slugs stay editable after publishing, and there is no redirect table. |
| STAFF restrictions | ⚠️ | STAFF can set `featured`, `authorName`, `ARCHIVED`, and `REJECTED` on their own posts. |
| Moderation actions | ⚠️ | Approve and reject exist, including quick approve/reject with a reason modal in `PendingQueueView.tsx`. (The first version of this audit said quick actions were missing; that was wrong.) Missing: archive from moderation and an audit-trail view. Reject does not revalidate public pages. |
| Bulk actions | ⚠️ | Bulk PUBLISH overwrites `publishedAt` and skips moderation emails. Bulk delete writes one audit row for the whole batch. |
| Audit coverage | ⚠️ | Category and tag create, update, and delete are not audited. |
| Tag create-on-type | ❌ | The editor only toggles existing tags. |
| Image tags | ❌ | Native `<img>` tags violate CLAUDE.md §3: `src/components/admin/PostEditor.tsx:476,631`, `src/app/admin/blog/[id]/preview/page.tsx:67`, `src/app/admin/blog/pending/[id]/page.tsx:110`. |
| Email HTML safety | ⚠️ | The guest's name, the title, and the rejection reason are interpolated into email HTML without escaping (`src/lib/email/index.ts`). |
| R2 image host | ⚠️ | `next.config.ts` allows `*.r2.cloudflarestorage.com`, which is the private S3 endpoint, not `R2_PUBLIC_DOMAIN`. |
| Action guard lint | ⚠️ | `scripts/check-admin-actions-guards.sh` scans only `admin-actions.ts`. The blog action files are not checked. |
| Type safety | ⚠️ | The blog code casts `(prisma as any)` about 34 times, even though the generated client includes the models. |
| Previous `VERIFICATION-REPORT.md` | ❌ | It contains no raw evidence for any functional flow, its route table is truncated, and it reports lint as "PASS" while showing 2 warnings. |

## 3. Conflicts with the scaffold and how they are resolved

1. **`ResponsiveTable` does not exist.** The spec asks for it to be reused. The admin list keeps its own desktop-table / mobile-card split. Extracting a shared component would change existing admin modules, which is out of scope.
2. **`@db.Text`.** On PostgreSQL, Prisma `String` already maps to `text`, so the annotation would be a no-op. It is omitted to keep the migration diff empty.
3. **AUTHOR role.** Not introduced. `UserRole` already reserves roles for the Phase A2 permission system, and STAFF covers "draft + submit for review".
4. **Detail-page revalidate.** The spec says 3600s, while `docs/seo/AEO-GEO-GUIDE.md §5` requires "at least daily". 3600s satisfies both.
5. **Guest submission transport.** Server Actions have a 1 MB default body limit. Raising it globally would widen the DoS surface for every action, so guest submissions with images use a Route Handler (`POST /api/blog/submit`) instead.
6. **Server Action errors.** Next.js masks thrown messages in production. Blog actions return `{ ok: false, error: <code> }` instead, and the client translates the code.
7. **Status codes under the root `loading.tsx`.** The site-wide `src/app/loading.tsx` makes every dynamic route stream. As a result, `notFound()` answers HTTP 200 (with `noindex`), and redirects arrive in the stream instead of as a 3xx status. This affects `/destinations/*` too, so it is not a blog change. Left as is, to avoid changing every route; see SEO-INTEGRATION.md.

## 4. What changes next

The remediation happens one commit per spec section on branch `blog-finalize`. Each section's doc (`DATA-MODEL`, `PERMISSIONS`, `GUEST-SUBMISSION`, `MODERATION`, `SETTINGS-REFERENCE`, `SEO-INTEGRATION`) is rewritten in the commit that implements it. `VERIFICATION-REPORT.md` is rewritten last and contains only raw command and browser output.

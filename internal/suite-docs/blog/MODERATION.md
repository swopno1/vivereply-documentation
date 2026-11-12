# Moderation

MANAGER and OWNER review everything in `PENDING`: guest submissions, and staff posts that were submitted for review. STAFF never see the queue.

## Screens

| Route | Purpose | Gate |
|---|---|---|
| `/admin/blog/pending` | Queue, oldest first. Each card shows source (Guest / Staff), submitted date, photo count, category, author, excerpt, and a **spam-filter flag** when the pipeline held the post. Quick **Approve** (confirm) and **Reject** (modal requires a reason). | `requireRole("MANAGER")` |
| `/admin/blog/pending/[id]` | The post rendered exactly as the public page will show it (same `ArticleBody` component and sanitizer), plus author info (name, email, phone, **IP**, bio), flag reason, internal note, actions, and history. | `requireRole("MANAGER")` |
| `/admin/blog` → "Moderation queue (n)" | Entry point; the button appears when anything is pending. | MANAGER+ |

## Actions

All actions live in `src/app/actions/blog/moderation.ts`. Each export calls `requireRole("MANAGER")`. The allowed "from" statuses are enforced inside the `UPDATE … WHERE status IN (…)`, so if two moderators act at once, only one succeeds. The other gets `not_found` ("That post no longer exists").

| Action | From | To | Side effects |
|---|---|---|---|
| **Approve** | `PENDING`, `REJECTED` | `PUBLISHED` | `publishedAt = now` (keeps an earlier past date), clears `rejectionReason`, sets `moderatedBy/At`, emails a guest author "Your story is live" + link, revalidates the post, listings, RSS, and sitemap |
| **Approve with edits** | `PENDING` | editor → `PUBLISHED` | Opens `/admin/blog/[id]`. The editor defaults to "Publish now" for a pending post. Saving it counts as an approval: `APPROVE_BLOG_POST` audit, `moderatedBy/At`, and the same guest email. If direct publishing is off (`staffPostsAutoPublish = false`), save the edits, then press **Approve** in the queue. |
| **Reject** | `PENDING` | `REJECTED` | A **reason is required** (`rejection_reason_required`, 1–2000 chars). It is stored in `rejectionReason` and emailed to a guest author. Revalidates public surfaces. |
| **Archive** | `PENDING`, `REJECTED`, `PUBLISHED`, `DRAFT` | `ARCHIVED` | Soft removal: sets `archivedAt`, sends no email, keeps images in storage. The post leaves the public site. |
| **Save note** | any | unchanged | `moderationNote` is internal and never sent to the author. It is also saved together with approve, reject, or archive. |

## Audit trail

Every transition writes an `AuditLog` row with `module = "BLOG"`, `entity = "BlogPost"`, the moderator's `userId`, IP, user agent, `diff = { before: { status }, after: { status } }`, and metadata (title, source, reason, note). The detail view's **History** lists every row for the post, newest first. That includes the guest submission itself (`GUEST_SUBMIT_BLOG_POST`, user "System"), edits, uploads, and moderation.

| Audit action | Meaning |
|---|---|
| `GUEST_SUBMIT_BLOG_POST` | Guest form accepted a post |
| `CREATE_BLOG_POST` / `UPDATE_BLOG_POST` | Staff editor save |
| `PUBLISH_BLOG_POST` / `SCHEDULE_BLOG_POST` | Staff editor published or scheduled |
| `APPROVE_BLOG_POST` / `REJECT_BLOG_POST` / `ARCHIVE_BLOG_POST` | Moderation (queue, detail, or editor approval) |
| `NOTE_BLOG_POST` | Internal note changed |
| `UPLOAD_BLOG_IMAGE` | Staff photo upload |
| `DELETE_BLOG_POST` | Hard delete (one row per post, including bulk) |

## Email templates

Templates are in `src/lib/email/blog.ts`, with text in `blogEmails` in `en.ts` / `bn.ts`. Each email has English then Bengali, HTML-escaped. Emails go out after the response (`after()`), so a Resend outage never blocks a moderation decision. Failures are logged as `[blog] … email failed`.

**Approved**: subject "Your story is live: {title} | আপনার গল্প প্রকাশিত হয়েছে: {title}"

> Dear {name}, Good news! Your story "{title}" has been approved and is now published on our blog. [Read your story] — The {brand} editorial team

**Rejected**: subject "About your story: {title} | আপনার গল্প সম্পর্কে: {title}"

> Dear {name}, Thank you for submitting "{title}". After review, our editors could not publish it this time. **Reason:** {rejectionReason} You're welcome to revise your story and submit it again.

Staff authors receive no email. They see the status in the admin list.

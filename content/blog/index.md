# Blog — Staff Training Module

**Page:** `/admin/blog` — the property's travel stories and guides.
**Audience:** content writers, editors (primary), managers.
**Time to complete:** about 20 minutes.
**Prerequisite:** none.

## Learning objectives

After this module you can:

- Explain the post lifecycle and the two sources (staff vs guest).
- Find, filter, and manage posts.
- Know which sub-page does what: new, edit, preview, moderation queue,
  categories, tags, settings.

## 1. What the blog is

*"Write, review and publish travel stories and guides."* The public blog
lives on the website; this is its newsroom. Posts come from two sources:

- **STAFF** — written by the team in the editor.
- **GUEST** — traveler stories submitted through the website's story form.
  Every guest story lands as PENDING and an editor reads it before anything
  goes live.

## 2. The post lifecycle

| Status | Meaning |
|---|---|
| **DRAFT** | Being written, invisible |
| **PENDING** | Submitted, waiting in the [moderation queue](pending/) |
| **PUBLISHED** | Live on the website (or scheduled — see below) |
| **REJECTED** | Sent back, not published |
| **ARCHIVED** | Removed from the public blog, kept in the system |

**SCHEDULED** isn't a stored status — it's a filter view: PUBLISHED posts
whose publish date is still in the future. They go live automatically when
the date arrives.

## 3. The list

Search by **title, slug, or author**; filter by **status, category, author,
source**; 20 per page. Each row shows title, author, category, status,
publish date, photo count, and actions: **Preview**, **Edit**, **View
live** (published posts), **Archive**, **Delete**.

**Bulk actions:** select posts to **archive** (removed from the public
blog, kept) or **delete** (*"Permanently delete \{count} posts and their
photos? This can't be undone."*). Deleting is forever — archive when in
doubt.

## 4. The sub-pages

| Page | Docs | What it's for |
|---|---|---|
| `/admin/blog/new` | [New Post](new/) | Writing a post in the editor |
| `/admin/blog/[id]` | [Edit Post](edit/) | Editing an existing post |
| `/admin/blog/[id]/preview` | [Preview](edit/preview/) | Seeing it as guests will |
| `/admin/blog/pending` | [Moderation Queue](pending/) | Approving guest + staff submissions |
| `/admin/blog/categories` | [Categories](categories/) | Organizing topics |
| `/admin/blog/tags` | [Tags](tags/) | Finer-grained labels |
| `/admin/blog/settings` | [Blog Settings](settings/) | How the blog behaves |

## 5. Permissions

Viewing needs blog-view. **Creating** needs the create permission.
**Editing** a post depends on authorship and role (you can always edit
your own drafts; others' posts need editor rights). **Approving**
(PENDING → PUBLISHED) needs the approve permission. Deleting is the most
guarded action of all.

## 6. Troubleshooting

| Symptom | Check first |
|---|---|
| Post not on the website | Is it PUBLISHED with a past publish date? DRAFT, PENDING, and SCHEDULED (future) posts aren't live. |
| Can't edit someone's post | You need editor rights for others' posts — your own drafts are always editable. |
| Scheduled post didn't go live | Check the publish date/timezone — and that nothing failed in the scheduler. |
| Deleted post needed back | Deletion is permanent — this is why Archive exists. |

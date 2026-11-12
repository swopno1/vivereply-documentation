# Edit Post — Staff Training Module

**Page:** `/admin/blog/[id]` — editing an existing post.
**Audience:** writers (own posts), editors.
**Time to complete:** about 10 minutes.
**Prerequisite:** the [Blog](..) and [New Post](../new/) modules.

## Learning objectives

After this module you know what editing changes, what's locked, and how
edits interact with publishing.

## 1. What editing is

The same editor as [New Post](../new/), opened on an existing post. You
can change everything: title, slug, excerpt, content, category, tags,
photos, publish date.

**Permissions:** you can always edit your own drafts. Editing someone
else's post — or any published post — needs editor rights. The page
refuses cleanly (*forbidden*) when you lack them.

## 2. Editing a published post

Editing a live post updates it in place — guests see the new version
immediately on save. Rules of the road:

- **Fix freely:** typos, broken links, better photos, updated prices.
- **Think twice:** changing the title substantially on a post that's ranking is a
  marketing decision, not a typo fix — check with the manager. (Changing the
  slug is safe: renaming a published post leaves a redirect, so old links keep
  working while the post stays public.)
- **Unpublishing:** move it back to DRAFT rather than
  deleting — deletion also destroys its photos permanently. (The editor has no
  Archive state — archive from the list's bulk action or the [moderation
  queue](../pending/) instead.)

## 3. Sub-page

| Page | Docs | What it's for |
|---|---|---|
| `/admin/blog/[id]/preview` | [Preview](preview/) | Seeing the post exactly as guests will |

## 4. Troubleshooting

| Symptom | Check first |
|---|---|
| "Forbidden" on opening | You lack edit rights for this post — your own drafts are always fine. |
| Changes not showing live | Hard-refresh; then check you saved (not just previewed). |
| Old slug still circulating | Renames redirect automatically while the post stays public — if the old link is dead, the post was unpublished or archived. |

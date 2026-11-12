# Blog Permissions

Since Phase A2, blog access comes from the RMS permission matrix (`src/lib/permissions.ts`, documented in `docs/rms/01-ROLES-AND-PERMISSIONS.md`), module `BLOG`:

| BLOG action | Covers | Roles |
|---|---|---|
| `view` | Blog list, preview | OWNER, MANAGER, AUDITOR |
| `create` | Write and edit own drafts, upload images | OWNER, MANAGER |
| `edit` | Edit any post, taxonomy, featured flag, author name, live slugs | OWNER, MANAGER |
| `delete` | Delete posts (single or bulk), delete categories/tags | OWNER, MANAGER |
| `approve` | Publish and schedule, moderation queue | OWNER, MANAGER |

Blog settings need `SETTINGS.edit` (OWNER). The per-post rules in `src/lib/blog/permissions.ts` are derived from these permissions, The STAFF column below describes a role with `BLOG.create` but not `edit`/`approve` (draft and submit for review). **Since the owner's 2026-10-07 decision no role has that**: FRONT_DESK and STAFF lost blog access, and blog writing is OWNER and MANAGER only. The column stays as the rule a future contributor (AUTHOR) role would follow. Roles without `BLOG` (FRONT_DESK, STAFF, HOUSEKEEPING, KITCHEN, STOREKEEPER, ACCOUNTANT, HR) have no blog access. Before A2 they resolved to STAFF level by accident. No AUTHOR role was added (see "AUTHOR role" below).

## Matrix

| Action | OWNER | MANAGER | STAFF | GUEST (public form) | PUBLIC | Enforced by |
|---|:-:|:-:|:-:|:-:|:-:|---|
| Create post (draft) | ✅ | ✅ | ✅ | — | — | `savePostAction` → `requirePermission("BLOG", "create")` |
| Edit own post | ✅ | ✅ | ✅ ¹ | — | — | `canEditPost` |
| Edit any post | ✅ | ✅ | ❌ | — | — | `canEditPost` |
| Delete post (hard) | ✅ | ✅ | ❌ | — | — | `deletePostAction`, `bulkPostsAction` → `requirePermission("BLOG", "delete")` |
| Archive (bulk / moderation) | ✅ | ✅ | ❌ | — | — | `bulkPostsAction` → `BLOG.delete`; `archivePostAction` → `requirePermission("BLOG", "approve")` |
| Publish now / schedule | ✅ ² | ✅ ² | ❌ | — | — | `resolvePublishState` |
| Submit for review | ✅ | ✅ | ✅ | — | — | `resolvePublishState` |
| Approve / reject / archive pending | ✅ | ✅ | ❌ | — | — | `src/app/actions/blog/moderation.ts` → `requirePermission("BLOG", "approve")` |
| Set `featured`, change author name | ✅ | ✅ | ❌ ³ | — | — | `canSetFeatured`, `canSetAuthor` |
| Change a published post's slug | ✅ | ✅ | ❌ | — | — | `canRenamePublishedSlug` (leaves a 301 redirect) |
| Manage categories / tags | ✅ | ✅ | ❌ | — | — | page `requirePermission("BLOG", "edit")` + `taxonomy.ts` actions (`BLOG.edit`; deletes `BLOG.delete`) |
| Create a tag from the editor | ✅ | ✅ | ❌ | — | — | `createTagFromNameAction` → `requirePermission("BLOG", "edit")` |
| Edit blog settings | ✅ ⁴ | ❌ | ❌ | — | — | `requirePermission("SETTINGS", "edit")` + `requireMfa()` on page and action |
| Submit guest post | — | — | — | ✅ | — | `POST /api/blog/submit`: anti-abuse pipeline, no session |
| Read published posts | ✅ | ✅ | ✅ | ✅ | ✅ | `publishedWhere()`: `PUBLISHED` and `publishedAt <= now` |

1. STAFF can edit their own posts while they are `DRAFT`, `PENDING`, or `REJECTED`. Once a post is `PUBLISHED` or `ARCHIVED`, it is locked for STAFF, so an edit can't silently take a ranking page offline. A MANAGER edits live posts.
2. When the OWNER turns off `staffPostsAutoPublish`, nobody can use "Publish now" or "Schedule". New posts go live only by approval from the moderation queue. A MANAGER can still re-save a post that is already live.
3. STAFF values for these fields are ignored. The stored value stays unchanged, and new posts use the account name.
4. OWNER accounts must have 2FA enabled, as on every other settings page.

## How it is enforced

- **Server Actions are the security boundary.** UI hiding is only a convenience. Every exported function in `src/app/actions/blog/*.ts` calls `requirePermission()` in its own body. `pnpm lint` (`scripts/check-server-actions.sh`) fails if any export is missing it, and `src/app/actions/permission-enforcement.test.ts` checks each action against every role.
- **Page gates:**
  - `/admin/blog`, `/[id]/preview`: `BLOG.view`. `/new`, `/[id]`: `BLOG.create`. The editor and preview pages also call `canEditPost` and return 403 (`forbidden()`) for someone else's post.
  - `/admin/blog/categories`, `/tags`: `BLOG.edit`. `/admin/blog/pending`, `/pending/[id]`: `BLOG.approve`.
  - `/admin/blog/settings`: `SETTINGS.edit` + `requireMfa()`.
- **Pure rules** live in `src/lib/blog/permissions.ts` and are unit-tested in `permissions.test.ts`.
- **Reads are not endpoints.** Admin data loads (`getPostForEdit`, `getBlogSettings`, …) are plain server functions in `src/lib/blog/queries.ts`, not exported Server Actions, so the browser cannot call them directly. The old `getBlogSettingsAction` exposed `notifyEmail` publicly and has been removed.
- **Errors are codes.** Actions return `{ ok: false, error: "forbidden_publish" }` rather than throwing, and the client shows the message from `blogErrors` in `en.ts` / `bn.ts`.

## Publishing states

| Editor choice | Stored as | Public when |
|---|---|---|
| Draft | `DRAFT` | never |
| Submit for review | `PENDING` | after approval |
| Publish now | `PUBLISHED`, `publishedAt = now` (kept on later edits) | immediately |
| Schedule | `PUBLISHED`, `publishedAt = scheduledFor` (must be ≥ 1 minute ahead) | once `publishedAt` passes |

Public queries (listing, detail, category/tag pages, RSS, sitemap) all filter on `publishedAt <= now`. A scheduled post therefore needs no cron job, and a stalled job can never publish one early. Cached pages pick it up within their revalidate window (≤ 1 hour).

## AUTHOR role (deferred)

The spec lists an optional AUTHOR role for external contributors. It was **not** introduced:
- STAFF covered "draft + submit for review" until 2026-10-07. Since then no role does; add an AUTHOR row (`BLOG` V C only) if outside contributors are needed.
- Phase A2 added the permission matrix. An AUTHOR role would be one more row there (`BLOG` V C only).
- An AUTHOR role would need its own gating across every non-blog admin module.

Revisit this when Phase A2 lands.

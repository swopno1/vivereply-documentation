# Phase A2 §2 — Permission system (implementation record)

**Audience:** developers adding or changing a guarded surface, and the owner reviewing Section 2.
**Source of truth:** [`docs/rms/01-ROLES-AND-PERMISSIONS.md`](../01-ROLES-AND-PERMISSIONS.md). This file records how that matrix was implemented and verified. `src/lib/permissions.test.ts` parses that document's §4 and §6 tables and fails if the code disagrees with them.

## What exists now

| Piece | Where | Notes |
|---|---|---|
| Roles, modules, actions, the matrix | `src/lib/permissions.ts` | Pure, no dependencies; client components may import it. `PERMISSIONS: Record<UserRole, Record<Module, Action[]>>` lists every module for every role, so the compiler rejects a missing cell. An empty list is an explicit denial. |
| `can(role, module, action)` | same | Unknown role, module or action → `false`. |
| `requirePermission(module, action)` | `src/lib/auth-helpers.ts` | No session → redirect to `/admin/login`. Denied → Next `forbidden()` (403). |
| `requireRole(min)` (legacy) | same | Only for the deferred payment call sites (27 at Section 2; 26 after FU-3, see the addendum). OWNER > MANAGER > STAFF. **Every other role is refused**; the old `|| 1` fallback that gave new roles STAFF rights is gone (baseline N3). |
| Sidebar | `NAV_RULES`, `visibleNav()` → `src/components/admin/AdminShell.tsx` | Computed from the matrix. The hard-coded `minRole` arrays are removed. Labels come from `t.adminShell` (Bengali nav labels were untranslated English before). |
| Landing page | `landingPathFor()`; `/admin` redirects roles without `REPORTS.view`; new `/admin/welcome` | Covers baseline N11. |
| Blog per-post rules | `src/lib/blog/permissions.ts` | Now derived from the matrix (`BLOG.edit/delete/approve`, `SETTINGS.edit`), not role literals. |

### Typing debt (resolved after review, FU-4)

At the Section 2 commit, `SessionUser.role` was typed as the legacy `"OWNER" | "MANAGER" | "STAFF"` union, so the payment files' `ROLE_RANK: Record<UserRole, number>` compiled unchanged. The runtime value could be any of the ten roles. The addendum below records how this was fixed.

## Call sites

### Migrated to `requirePermission` (46)

Every call is listed with its (module, action), from `grep -rn "requirePermission(" src/` with tests and comments excluded:

| Call site | Permission |
|---|---|
| `src/app/actions/admin-actions.ts:200` | `"BOOKING", "approve"` |
| `src/app/actions/admin-actions.ts:201` | `"FRONT_DESK", "edit"` |
| `src/app/actions/admin-actions.ts:313` | `"ROOMS", "delete"` |
| `src/app/actions/admin-actions.ts:356` | `"ROOMS", formData.id ? "edit" : "create"` |
| `src/app/actions/admin-actions.ts:433` | `"FRONT_DESK", "edit"` |
| `src/app/actions/admin-actions.ts:475` | `"BOOKING", "edit"` |
| `src/app/actions/admin-actions.ts:60` | `"BOOKING", "create"` |
| `src/app/actions/admin-actions.ts:655` | `"BOOKING", "approve"` |
| `src/app/actions/blog/moderation.ts:103` | `"BLOG", "approve"` |
| `src/app/actions/blog/moderation.ts:109` | `"BLOG", "approve"` |
| `src/app/actions/blog/moderation.ts:93` | `"BLOG", "approve"` |
| `src/app/actions/blog/moderation.ts:98` | `"BLOG", "approve"` |
| `src/app/actions/blog/posts.ts:231` | `"BLOG", "delete"` |
| `src/app/actions/blog/posts.ts:262` | `"BLOG", "delete"` |
| `src/app/actions/blog/posts.ts:296` | `"BLOG", "create"` |
| `src/app/actions/blog/posts.ts:35` | `"BLOG", "create"` |
| `src/app/actions/blog/settings.ts:13` | `"SETTINGS", "edit"` |
| `src/app/actions/blog/taxonomy.ts:113` | `"BLOG", "edit"` |
| `src/app/actions/blog/taxonomy.ts:19` | `"BLOG", "edit"` |
| `src/app/actions/blog/taxonomy.ts:49` | `"BLOG", "delete"` |
| `src/app/actions/blog/taxonomy.ts:67` | `"BLOG", "edit"` |
| `src/app/actions/blog/taxonomy.ts:94` | `"BLOG", "delete"` |
| `src/app/actions/room-unit-actions.ts:133` | `"ROOMS", "edit"` |
| `src/app/actions/room-unit-actions.ts:176` | `"ROOMS", "edit"` |
| `src/app/actions/room-unit-actions.ts:225` | `"ROOMS", "delete"` |
| `src/app/actions/room-unit-actions.ts:69` | `"ROOMS", "delete"` |
| `src/app/admin/blog/[id]/page.tsx:18` | `"BLOG", "create"` |
| `src/app/admin/blog/[id]/preview/page.tsx:21` | `"BLOG", "view"` |
| `src/app/admin/blog/categories/page.tsx:8` | `"BLOG", "edit"` |
| `src/app/admin/blog/new/page.tsx:8` | `"BLOG", "create"` |
| `src/app/admin/blog/page.tsx:24` | `"BLOG", "view"` |
| `src/app/admin/blog/pending/[id]/page.tsx:14` | `"BLOG", "approve"` |
| `src/app/admin/blog/pending/page.tsx:8` | `"BLOG", "approve"` |
| `src/app/admin/blog/settings/page.tsx:12` | `"SETTINGS", "edit"` |
| `src/app/admin/blog/tags/page.tsx:8` | `"BLOG", "edit"` |
| `src/app/admin/bookings/[id]/page.tsx:33` | `"BOOKING", "view"` |
| `src/app/admin/bookings/new/page.tsx:9` | `"BOOKING", "create"` |
| `src/app/admin/bookings/page.tsx:19` | `"BOOKING", "view"` |
| `src/app/admin/guests/page.tsx:12` | `"FRONT_DESK", "view"` |
| `src/app/admin/rooms/[id]/page.tsx:20` | `"ROOMS", isNew ? "create" : "edit"` |
| `src/app/admin/rooms/page.tsx:11` | `"ROOMS", "view"` |
| `src/app/admin/settings/integrations/page.tsx:11` | `"SETTINGS", "edit"` |
| `src/app/admin/settings/page.tsx:8` | `"SETTINGS", "view"` |
| `src/app/api/admin/blog/images/route.ts:38` | `"BLOG", "create"` |
| `src/app/api/admin/pms/test-connection/route.ts:6` | `"SETTINGS", "edit"` |
| `src/app/api/admin/reports/payments/route.ts:9` | `"REPORTS", "export"` |

Also migrated, but not as `requirePermission` calls:
- `src/app/admin/page.tsx`: the dashboard checks `can(user.role, "REPORTS", "view")` and **redirects** to the role's landing page instead of refusing, because `/admin` is where every login lands.
- `src/app/admin/layout.tsx`: the BanglaQR badge count is loaded only when the sidebar shows the queue.
- `src/app/admin/setup-2fa/page.tsx` stays `requireAuth()`: every role must be able to enrol 2FA.

### Still `requireRole` (27 at Section 2, all deferred payment code; 26 after FU-3)

`grep -rn "requireRole(" src/ | grep -v requirePermission`, with tests and comments excluded:

```
src/app/actions/banglaqr-actions.ts:108:  const user = await requireRole("MANAGER");
src/app/actions/banglaqr-actions.ts:128:  const user = await requireRole("MANAGER");
src/app/actions/banglaqr-actions.ts:145:  const user = await requireRole("MANAGER");
src/app/actions/banglaqr-actions.ts:162:  const user = await requireRole("OWNER");
src/app/actions/banglaqr-actions.ts:180:  const user = await requireRole("MANAGER");
src/app/actions/banglaqr-actions.ts:197:  const user = await requireRole("OWNER");
src/app/actions/banglaqr-actions.ts:215:  const user = await requireRole("OWNER");
src/app/actions/banglaqr-actions.ts:238:  const user = await requireRole("OWNER");
src/app/actions/bkash-actions.ts:124:  const user = await requireRole("MANAGER");
src/app/actions/bkash-actions.ts:148:  const user = await requireRole("OWNER");
src/app/actions/bkash-actions.ts:68:  const user = await requireRole("OWNER");
src/app/actions/nagad-actions.ts:129:  const user = await requireRole("OWNER");
src/app/actions/nagad-actions.ts:154:  const user = await requireRole("MANAGER");
src/app/actions/nagad-actions.ts:174:  const user = await requireRole("OWNER");
src/app/actions/nagad-actions.ts:74:  const user = await requireRole("OWNER");
src/app/actions/sslcommerz-actions.ts:134:  const user = await requireRole("OWNER");
src/app/actions/sslcommerz-actions.ts:159:  const user = await requireRole("MANAGER");
src/app/actions/sslcommerz-actions.ts:181:  const user = await requireRole("OWNER");
src/app/actions/sslcommerz-actions.ts:80:  const user = await requireRole("OWNER");
src/app/admin/payments/banglaqr-verification/page.tsx:14:  const user = await requireRole("MANAGER");
src/app/admin/settings/payments/page.tsx:23:  await requireRole("OWNER");
src/app/api/admin/payments/banglaqr/receipt-file/route.ts:15:  await requireRole("MANAGER");
src/app/api/admin/payments/bkash/test-connection/route.ts:32:  const user = await requireRole("OWNER");
src/app/api/admin/payments/nagad/test-connection/route.ts:33:  const user = await requireRole("OWNER");
src/app/api/admin/payments/refund/route.ts:14:    await requireRole("OWNER");
src/app/api/admin/payments/sslcommerz/test-connection/route.ts:33:  const user = await requireRole("OWNER");
src/app/api/admin/payments/status/route.ts:11:  await requireRole("MANAGER");
src/lib/auth-helpers.ts:103:export async function requireRole(requiredRole: LegacyRole): Promise<SessionUser> {
```

The last line is the helper's own definition. The other 27 are exactly the deferred list in 01-ROLES-AND-PERMISSIONS.md §5.3.

**Standing rule** (01 §7 rule 4): a change that edits any deferred file migrates every guard in that file to its §5.3 target in the same PR, removes the file from `scripts/check-require-role.sh`, and runs that gateway's `pnpm test:<gateway>:db`.

## Lint gates (`pnpm check:guards`, part of `pnpm lint`)

| Script | Fails when |
|---|---|
| `scripts/check-server-actions.sh` (new) | Any `"use server"` module under `src/` (found automatically) exports an action whose body lacks `requirePermission(`. The four deferred payment files may use `requireRole(` instead (`--legacy-role`). `requireAuth`/`requireMfa` alone no longer count. |
| `scripts/check-admin-api-guards.sh` (tightened) | A route under `src/app/api/admin/**` calls neither `requirePermission(` nor `requireRole(`. Also still checks cron and webhook routes. |
| `scripts/check-require-role.sh` (new) | `requireRole(` is called outside the 12 deferred files, or a deferred entry's file no longer exists. |

Negative probes, run during implementation:
- a file with `requireRole("OWNER")` in `src/lib/` → `❌ requireRole() outside the deferred payment list`, exit 1;
- an action calling only `requireAuth()` → `❌ Server Actions without a permission guard … y`, exit 1.

## Behaviour changes

Deliberate, following the matrix:

1. **The seven Phase A2 roles no longer get STAFF access.** Before, an AUDITOR could open the offline-booking form and the blog editor (baseline evidence). Now each role gets exactly its matrix row.
2. **The dashboard (revenue) is `REPORTS.view`.** STAFF, FRONT_DESK and HOUSEKEEPING previously saw it. They now land on their first permitted page (evidence below).
3. **Check-in / check-out buttons need `FRONT_DESK.edit`.** Previously they were shown to every signed-in role; the action itself required STAFF.
4. **`/admin/rooms/[id]` needs `ROOMS.edit`** (`ROOMS.create` for `/new`). There is no read-only room page. MANAGER keeps access, and MANAGER keeps creating room types (owner decision, 01 §4.1). Unit add/remove and room-type deactivation are `ROOMS.delete`, OWNER only.
5. **AUDITOR can open `/admin/settings` read-only** (`SETTINGS.view`). Today's page saves nothing (Section 5 rebuilds it). Its bKash "Test connection" button calls an OWNER-only route, which refuses.
6. **`GET /api/admin/reports/payments` now answers 403 to a denied role.** Before, the guard sat inside the handler's `try`, so a refusal became HTTP 500 carrying Next's internal error string. No data leaked. Found by the enforcement test.
7. **Sidebar labels are bilingual;** the Bengali nav labels are now actually Bengali.

## Tests

| Test | Proves |
|---|---|
| `src/lib/permissions.test.ts` | `ROLES` equals the Prisma enum. The matrix equals the document's §4 table cell for cell. All 900 role × module × action cells are decided, and `can()` agrees. Unknown roles, modules and actions are denied. OWNER has everything; AUDITOR never gets create/edit/delete/approve; STAFF ≡ FRONT_DESK. The three owner decisions hold. Legacy hierarchy refuses every A2 role. Sidebar per role equals the document's §6 table. No nav item links to a page whose guard would refuse that role (read from the page sources). Landing page per role. Blog rules derived from the matrix. |
| `src/lib/auth-helpers.test.ts` | `requirePermission` allows and forbids per the matrix, redirects without a session, and forbids unknown or missing roles. `requireRole` refuses all seven A2 roles and unknown/missing roles, replacing the test that pinned the STAFF fallback. |
| `src/app/actions/permission-enforcement.test.ts` | All 25 exported Server Actions in the migrated files (32 cases: `updateBookingStatus` is tested per target status and `createOrUpdateRoom` for new and edit), plus the 3 migrated admin API routes, are each called as all 10 roles and an unknown role. Denied roles are refused **before any database access**: the database is a proxy that throws on use. Allowed roles get past the guard. A final check fails if a new exported action is not listed in this test. |

`pnpm test` with the database suites enabled (fresh `resort_test`):

```
 Test Files  70 passed (70)
      Tests  1063 passed (1063)
```

## Evidence: every role against the production build

Setup:
- `next start -p 3100` against `resort_test`;
- one scratch user per role, signed in through `/api/auth/sign-in/email`. Better Auth's limit of 3 sign-ins per 10 s per IP returned 429 twice; those two were retried after a pause.

`403` means the body carried `NEXT_HTTP_ERROR_FALLBACK;403`. The root `loading.tsx` streams, so a refusal arrives as a 200 carrying that digest, and a `redirect()` arrives as a 200 carrying `NEXT_REDIRECT` (the same behaviour recorded in A1). That is why `/admin` shows 200 for roles it redirects.

```
ROLE          /admin            /bookings /bk/new /guests /rooms /rooms/id /settings /blog/new SIDEBAR (after landing)
owner         200               200       200     200     200    200       200       200       Dashboard,Bookings,BanglaQR Queue,Blog Articles,Rooms,Guests,Settings
manager       200               200       200     200     200    200       403       200       Dashboard,Bookings,BanglaQR Queue,Blog Articles,Rooms,Guests
staff         200               200       200     200     200    403       403       200       (none)
front_desk    200               200       200     200     200    403       403       200       (none)
housekeeping  200               403       403     403     200    403       403       403       (none)
kitchen       200               403       403     403     403    403       403       403       (none)
storekeeper   200               403       403     403     403    403       403       403       (none)
accountant    200               200       403     403     403    403       403       403       Dashboard,Bookings
hr            200               403       403     403     403    403       403       403       (none)
auditor       200               200       403     200     200    403       200       403       Dashboard,Bookings,Blog Articles,Rooms,Guests,Settings
```

Where `/admin` sends each role, and the sidebar on that page:

```
ROLE          /admin lands on      SIDEBAR on the landing page
owner         /admin               Dashboard, Bookings, BanglaQR Queue, Blog Articles, Rooms, Guests, Settings
manager       /admin               Dashboard, Bookings, BanglaQR Queue, Blog Articles, Rooms, Guests
staff         /admin/bookings      Bookings, Blog Articles, Rooms, Guests
front_desk    /admin/bookings      Bookings, Blog Articles, Rooms, Guests
housekeeping  /admin/rooms         Rooms
kitchen       /admin/welcome       (none) + welcome message
storekeeper   /admin/welcome       (none) + welcome message
accountant    /admin               Dashboard, Bookings
hr            /admin/welcome       (none) + welcome message
auditor       /admin               Dashboard, Bookings, Blog Articles, Rooms, Guests, Settings
```

Both match 01-ROLES-AND-PERMISSIONS.md §6.

## Addendum: owner review of Section 2 (2026-10-01)

### FU-3: refund route migrated

`POST /api/admin/payments/refund` now calls `requirePermission("FINANCE", "edit")` **before** its `try`, so a refusal propagates as Next's 403 instead of the catch's 500. `FINANCE.edit` is OWNER-only, the same set as the former `requireRole("OWNER")`. Only the guard changed. The route still only reads the payment and points to the per-gateway refund dialog; it never calls a gateway. The file is removed from `scripts/check-require-role.sh`. `permission-enforcement.test.ts` covers the route for all ten roles plus an unknown one. Moving the guard back inside `try` fails that test (checked).

Remaining `requireRole` calls (26), with tests and comments excluded:

```
src/app/actions/banglaqr-actions.ts:108:  const user = await requireRole("MANAGER");
src/app/actions/banglaqr-actions.ts:128:  const user = await requireRole("MANAGER");
src/app/actions/banglaqr-actions.ts:145:  const user = await requireRole("MANAGER");
src/app/actions/banglaqr-actions.ts:162:  const user = await requireRole("OWNER");
src/app/actions/banglaqr-actions.ts:180:  const user = await requireRole("MANAGER");
src/app/actions/banglaqr-actions.ts:197:  const user = await requireRole("OWNER");
src/app/actions/banglaqr-actions.ts:215:  const user = await requireRole("OWNER");
src/app/actions/banglaqr-actions.ts:238:  const user = await requireRole("OWNER");
src/app/actions/bkash-actions.ts:124:  const user = await requireRole("MANAGER");
src/app/actions/bkash-actions.ts:148:  const user = await requireRole("OWNER");
src/app/actions/bkash-actions.ts:68:  const user = await requireRole("OWNER");
src/app/actions/nagad-actions.ts:129:  const user = await requireRole("OWNER");
src/app/actions/nagad-actions.ts:154:  const user = await requireRole("MANAGER");
src/app/actions/nagad-actions.ts:174:  const user = await requireRole("OWNER");
src/app/actions/nagad-actions.ts:74:  const user = await requireRole("OWNER");
src/app/actions/sslcommerz-actions.ts:134:  const user = await requireRole("OWNER");
src/app/actions/sslcommerz-actions.ts:159:  const user = await requireRole("MANAGER");
src/app/actions/sslcommerz-actions.ts:181:  const user = await requireRole("OWNER");
src/app/actions/sslcommerz-actions.ts:80:  const user = await requireRole("OWNER");
src/app/admin/payments/banglaqr-verification/page.tsx:14:  const user = await requireRole("MANAGER");
src/app/admin/settings/payments/page.tsx:23:  await requireRole("OWNER");
src/app/api/admin/payments/banglaqr/receipt-file/route.ts:15:  await requireRole("MANAGER");
src/app/api/admin/payments/bkash/test-connection/route.ts:32:  const user = await requireRole("OWNER");
src/app/api/admin/payments/nagad/test-connection/route.ts:33:  const user = await requireRole("OWNER");
src/app/api/admin/payments/sslcommerz/test-connection/route.ts:33:  const user = await requireRole("OWNER");
src/app/api/admin/payments/status/route.ts:11:  await requireRole("MANAGER");
```

### FU-4: the session role is typed honestly

- `SessionUser.role` is now `Role`, all ten values. The column is a Postgres enum with a default, so this is exactly what can be read back.
- The four payment action files needed a one-line type change each: `ROLE_RANK: Record<UserRole, number> & Partial<Record<Role, number>>`. Their lookup `(ROLE_RANK[user.role] ?? 0)` is unchanged and already ranks every other role at 0, below STAFF. No payment logic changed.
- The narrowed `UserRole` alias in `auth-helpers` remains, typing the payment files' `required` parameter, and is marked `@deprecated` with a reference to FU-4.
  - `@typescript-eslint/no-deprecated` allows it only in those four files (`eslint.config.mjs`).
  - `src/lib/auth-helpers.test.ts` fails if any other file imports it. Importing it from `AdminShell.tsx` made the test fail (checked).
- `AdminShell` and `PostEditor` now take the full role type.

### Gateway suites (four payment action files and the refund route touched)

```
pnpm test:nagad:db       Test Files  15 passed (15)   Tests  255 passed (255)
pnpm test:sslcommerz:db  Test Files  15 passed (15)   Tests  334 passed (334)
pnpm test:bkash:db       Test Files  15 passed (15)   Tests  157 passed (157)
pnpm test:banglaqr:db    Test Files  11 passed (11)   Tests   96 passed (96)
```

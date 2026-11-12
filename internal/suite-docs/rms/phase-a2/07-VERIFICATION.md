# Phase A2: verification report

**Branch:** `phase-a2-foundation`. Section commits: `952ba28` (§0), `6fe63ba` (§1), `e8f1bfe` (§2), `fbd54dc` (§2 review: FU-3, FU-4), `90fae7c` (FU-1), `18bae64` (§3), `41e83dc` (§4), `ca57c32` (§5), `09ef528` (§6), `3e572a8` (§7), `ce80820` (§8), and this report (§9).

**Verdict:** every Section 1–8 deliverable is built, tested and checked live, with these exceptions, each explained below:
- **FU-7 was fixed after this report** (see Follow-ups).
- **25 `requireRole` calls remain** in 10 deferred payment files.
- **Runtime settings (FU-6, done):** contact details, check-in/out times and early/late fees are editable in Settings › General and reach the public site, JSON-LD and emails at once. The name, address and cancellation policy stay in `brand.config.ts` by decision (10-RUNTIME-SETTINGS.md).
- **The brief's inventory walkthrough step** can't be run, because no inventory page exists yet.

---

## 9.1 Automated tests

### Required coverage, and where it lives
| Brief item | Tests (passed/total) |
|---|---|
| RoomUnit creation, migration, availability | `rooms/availability.test.ts` 20/20, `rooms/availability.db.test.ts` 14/14 (incl. 8 simultaneous bookings for 3 units, never double-booked), `actions/room-units.db.test.ts` 18/18, plus the migration replay in §9.3 |
| Permission matrix: every role × module × action | `lib/permissions.test.ts` 14/14 (every cell checked against 01-ROLES-AND-PERMISSIONS.md §4, parsed from the doc), `blog/permissions.test.ts` 9/9 |
| Server Action and route enforcement (unauthorized roles rejected) | `actions/permission-enforcement.test.ts` 43/43: every guarded action and route × 10 roles + an unknown role, refused before any database access. Lint also checks that every exported Server Action calls a guard (output below). |
| Sidebar visibility per role | `lib/permissions.test.ts` (sidebar per role, landing page), `rms/module-flags.test.ts` 12/12 (with modules disabled) |
| Settings tabs render, Save works | `lib/settings.test.ts` 9/9, `actions/settings.db.test.ts` 4/4, `actions/modules.db.test.ts` 6/6; every tab rendered live in EN and BN (09-SETTINGS.md §5) |
| Invitations: token generation, expiry, single use | `users/tokens.test.ts` 3/3, `users/accounts.db.test.ts` 16/16 (72 h expiry, one accept wins a 3-way race, an email failure rolls back), `email/account.test.ts` |
| Dashboard KPI formulas | `dashboard/metrics.test.ts` 5/5, `dashboard/metrics.db.test.ts` 8/8, `timezone.test.ts` 11/11 |
| Feature flags: disabled modules refused and hidden from the nav | `rms/module-flags.test.ts` 12/12, `actions/modules.db.test.ts` 6/6 (actions refused for OWNER; the route returns 404) |
| Sequence: no collision under concurrent creates | `sequence.test.ts` 4/4, `sequence.db.test.ts` 5/5 (50 concurrent transactions get 1–50; 12 simultaneous public bookings get consecutive codes) |
| Roles, test users, STAFF migration | `content/roles.test.ts` 3/3, `prisma/seed-test-users.test.ts` 4/4, `scripts/migrate-staff-to-front-desk.db.test.ts` 5/5, `auth-helpers.test.ts` 42/42 |

### `pnpm test` (unit; DB suites skip without a `*_test` database)
```
 Test Files  44 passed | 44 skipped (88)
      Tests  649 passed | 537 skipped (1186)
```

### Full suite on `resort_test` (`DATABASE_URL=…/resort_test vitest run --no-file-parallelism`)
```
total 1186 passed 1185 failed 0 skipped 1
```
The skipped test is the migrations-vs-schema drift check, which needs `SHADOW_DATABASE_URL`. The four gateway suites are part of this run. No payment file changed after §5, when each ran on its own: nagad 255, sslcommerz 334, bkash 157, banglaqr 96.

### `pnpm lint`
```
$ eslint . && pnpm check:guards && pnpm check:money
$ bash scripts/check-admin-api-guards.sh && bash scripts/check-require-role.sh && bash scripts/check-server-actions.sh
✓ All admin, cron and webhook route handlers are guarded
✓ requireRole() is only used by the 10 deferred payment files
✓ Every exported Server Action in src/app/actions/admin-actions.ts calls a permission guard
✓ Every exported Server Action in src/app/actions/banglaqr-actions.ts calls a permission guard (deferred file: legacy requireRole accepted)
✓ Every exported Server Action in src/app/actions/bkash-actions.ts calls a permission guard (deferred file: legacy requireRole accepted)
✓ Every exported Server Action in src/app/actions/blog/moderation.ts calls a permission guard
✓ Every exported Server Action in src/app/actions/blog/posts.ts calls a permission guard
✓ Every exported Server Action in src/app/actions/blog/settings.ts calls a permission guard
✓ Every exported Server Action in src/app/actions/blog/taxonomy.ts calls a permission guard
✓ Every exported Server Action in src/app/actions/module-actions.ts calls a permission guard
✓ Every exported Server Action in src/app/actions/nagad-actions.ts calls a permission guard (deferred file: legacy requireRole accepted)
✓ Every exported Server Action in src/app/actions/room-unit-actions.ts calls a permission guard
✓ Every exported Server Action in src/app/actions/settings-actions.ts calls a permission guard
✓ Every exported Server Action in src/app/actions/sslcommerz-actions.ts calls a permission guard (deferred file: legacy requireRole accepted)
✓ Every exported Server Action in src/app/actions/user-actions.ts calls a permission guard
$ bash scripts/check-no-float-money.sh
✓ No legacy Float money field names outside src/lib/money-legacy.ts
```
exit 0; ESLint printed no problems.

### `pnpm build`
```
✓ Compiled successfully in 3.2s
✓ Generating static pages using 7 workers (81/81) in 823ms
```
exit 0; `grep -ci warn build.log` → `0`.

---

## 9.2 Manual walkthrough

**Run on:** a production build (`next start`) at a 360px viewport, against scratch database `resort_a2s6_test` (migrated and seeded; dropped afterwards, as was `resort_a2_verify_test`). The OWNER was `test-owner@demo.resort`, with 2FA really enrolled (TOTP computed in the page).

| # | Brief step | Result |
|---|---|---|
| 1 | Invite a MANAGER from `?tab=users`; email sent; link works | **Done in §4** (08-USER-MANAGEMENT.md §Live). Outside production, the email is mocked and the link is logged; the link opened `/admin/accept-invite`, set a password, and sign-in worked. In a production build without `RESEND_API_KEY`, the invite is refused and rolled back, with a `USER_INVITE_FAILED` audit row. A real Resend delivery has not been checked (needs a key; see 9.5). |
| 2 | Add 3 units to a room type; they show AVAILABLE | Sunset Royal Beach Villa: `CBSRV-1..3` → after 3 adds `CBSRV-1..6`, all `AVAILABLE`. Availability API for 1–3 Dec: **3 → 6**. |
| 3 | Mark one unit MAINTENANCE; it drops out | `CBSRV-6=MAINTENANCE` (persisted across reload). Availability: **6 → 5**. |
| 4 | Create a booking; a unit is assigned | `POST /api/bookings` → `RES-202610-00003`, `unitNumber CBSRV-1`, status PENDING |
| 5 | MANAGER: sidebar hides Settings and Users | Sidebar `/admin, /admin/bookings, /admin/payments/banglaqr-verification, /admin/blog, /admin/rooms, /admin/guests`. `/admin/settings` and `?tab=users` → `NEXT_HTTP_ERROR_FALLBACK;403`. |
| 6 | FRONT_DESK: sidebar shows only Front Desk, Bookings, Guests | At the time of this report: Bookings, Blog, Rooms, Guests (the matrix then granted ROOMS.view and BLOG V C). **Changed by owner decision on 2026-10-07:** FRONT_DESK/STAFF lost ROOMS and BLOG, and a Front Desk page (`/admin/front-desk`) was added. The sidebar is now **Front Desk, Bookings, Guests**, landing on Front Desk (re-checked live, see the Follow-ups addendum). |
| 7 | Disable inventory; sidebar hides it; `/admin/inventory` 404 | **Can't be done as written:** inventory is not built (Phase D), so there is nothing to hide, and the switch is refused as `not_available` instead of silently doing nothing. **Done with Rooms instead** (05-FEATURE-FLAGS.md §7): switched off in Settings, then the sidebar lost Rooms (OWNER and MANAGER), `/admin/rooms` and `/admin/rooms/new` showed "Module disabled", and the CSV route returned **404** with Reports off. Audited, and reset to defaults afterwards. |
| 8 | KPIs match the formulas (revenue vs the Payment table) | 04-DASHBOARD-METRICS.md §6: SQL straight from `Payment` gave today 2,000,000 and month 2,900,000 poisha. The dashboard showed **৳20,000 / ৳29,000**; occupancy, ADR (৳4,000) and RevPAR (৳90.23) matched hand calculation. |
| 9 | Timezone changed; dashboard boundaries follow | Switching to Europe/London moved a payment captured at 01:00 Dhaka to the previous day: Revenue Today **৳20,000 → ৳5,000**, month unchanged. |

---

## 9.3 Migration verification

`resort_dev` could not be used; see 9.5 L1. The A2 migrations were replayed on scratch database `resort_a2_verify_test`:
1. Every pre-A2 migration applied in order.
2. Pre-A2 data inserted: 3 room types with `availableUnits` 5, 2 and 0, one booking `RES-123456`, and one STAFF user.
3. Every A2 migration applied (`20260930140000` … `20261001160000`).

**Before the A2 migrations:**
```
 slug    | availableUnits        rooms | bookings | guests | users
 cottage |              0            3 |        1 |      1 |     1
 deluxe  |              5
 villa   |              2
```
**After:**
```
  slug   | legacy_available_units | units | from_migration | unit_list
 cottage |                      0 |     0 |              0 |
 deluxe  |                      5 |     5 |              5 | D-1:AVAILABLE, D-2:AVAILABLE, D-3:AVAILABLE, D-4:AVAILABLE, D-5:AVAILABLE
 villa   |                      2 |     2 |              2 | V-1:AVAILABLE, V-2:AVAILABLE

 rooms | bookings | guests | users
     3 |        1 |      1 |     1

 bookingCode | unit_null | status        role  | role_default
 RES-123456  | t         | CONFIRMED     STAFF | 'FRONT_DESK'::"UserRole"

 Settings: singleton | Asia/Dhaka | rmsModules NULL      Sequence rows: 0      Booking_unit_no_overlap: present
```
- **RoomUnit counts match `Room.availableUnits` for every room type** (5/5, 2/2, 0/0), all created by `system:migration`. The `20260930140200_verify_unit_count` migration aborts the deploy if they don't (tested in §1).
- **No data lost:** the row counts are unchanged, and the old booking keeps its code and status. It has no unit (it predates units) and still counts against capacity as an unassigned booking (§1).
- **The deprecated `availableUnits` column is still there and readable** (the values above). It is re-synced on unit changes for one more release.
- **STAFF → FRONT_DESK** is a separate one-shot script, not a migration. Dry run, then apply, on the same database:
  ```
  would change  STAFF -> FRONT_DESK  oldstaff@example.com  (Old Staff, u1)
  1 user(s) would change. Dry run: nothing written. Re-run with --apply.
  changed  STAFF -> FRONT_DESK  oldstaff@example.com  (Old Staff, u1)
  USER_ROLE_CHANGED | USERS | u1 | {"after": {"role": "FRONT_DESK"}, "before": {"role": "STAFF"}}
  ```

---

## 9.4 Security greps

### `grep -rn "requireRole" src/ | grep -v "requirePermission"`
```
src/middleware.ts:11: * Page and action guards (requireRole / requireAuth) still run; this is the
src/app/admin/settings/tabs/PaymentsTab.tsx:22: * this wrapper's guard changed, from requireRole("OWNER") to SETTINGS.edit
src/app/admin/payments/banglaqr-verification/page.tsx:3:import { requireMfa, requireRole } from "@/lib/auth-helpers";
src/app/admin/payments/banglaqr-verification/page.tsx:14:  const user = await requireRole("MANAGER");
src/app/actions/banglaqr-actions.ts:5:import { getCurrentUser, requireMfa, requireRole, type Role, type SessionUser, type UserRole } from "@/lib/auth-helpers";
src/app/actions/banglaqr-actions.ts:55: * requireRole refuses it with a 403. Without this, a STAFF account probing
src/app/actions/banglaqr-actions.ts:108:  const user = await requireRole("MANAGER");
src/app/actions/banglaqr-actions.ts:128:  const user = await requireRole("MANAGER");
src/app/actions/banglaqr-actions.ts:145:  const user = await requireRole("MANAGER");
src/app/actions/banglaqr-actions.ts:162:  const user = await requireRole("OWNER");
src/app/actions/banglaqr-actions.ts:180:  const user = await requireRole("MANAGER");
src/app/actions/banglaqr-actions.ts:197:  const user = await requireRole("OWNER");
src/app/actions/banglaqr-actions.ts:215:  const user = await requireRole("OWNER");
src/app/actions/banglaqr-actions.ts:238:  const user = await requireRole("OWNER");
src/app/actions/nagad-actions.ts:5:import { getCurrentUser, requireMfa, requireRole, type Role, type SessionUser, type UserRole } from "@/lib/auth-helpers";
src/app/actions/nagad-actions.ts:74:  const user = await requireRole("OWNER");
src/app/actions/nagad-actions.ts:129:  const user = await requireRole("OWNER");
src/app/actions/nagad-actions.ts:154:  const user = await requireRole("MANAGER");
src/app/actions/nagad-actions.ts:174:  const user = await requireRole("OWNER");
src/app/actions/bkash-actions.ts:5:import { getCurrentUser, requireMfa, requireRole, type Role, type SessionUser, type UserRole } from "@/lib/auth-helpers";
src/app/actions/bkash-actions.ts:68:  const user = await requireRole("OWNER");
src/app/actions/bkash-actions.ts:124:  const user = await requireRole("MANAGER");
src/app/actions/bkash-actions.ts:148:  const user = await requireRole("OWNER");
src/app/actions/sslcommerz-actions.ts:5:import { getCurrentUser, requireMfa, requireRole, type Role, type SessionUser, type UserRole } from "@/lib/auth-helpers";
src/app/actions/sslcommerz-actions.ts:80:  const user = await requireRole("OWNER");
src/app/actions/sslcommerz-actions.ts:134:  const user = await requireRole("OWNER");
src/app/actions/sslcommerz-actions.ts:159:  const user = await requireRole("MANAGER");
src/app/actions/sslcommerz-actions.ts:181:  const user = await requireRole("OWNER");
src/app/api/admin/payments/bkash/test-connection/route.ts:2:import { getCurrentUser, requireMfa, requireRole } from "@/lib/auth-helpers";
src/app/api/admin/payments/bkash/test-connection/route.ts:32:  const user = await requireRole("OWNER");
src/app/api/admin/payments/status/route.ts:2:import { requireRole } from "@/lib/auth-helpers";
src/app/api/admin/payments/status/route.ts:11:  await requireRole("MANAGER");
src/app/api/admin/payments/banglaqr/receipt-file/route.ts:2:import { requireRole } from "@/lib/auth-helpers";
src/app/api/admin/payments/banglaqr/receipt-file/route.ts:15:  await requireRole("MANAGER");
src/app/api/admin/payments/nagad/test-connection/route.ts:2:import { getCurrentUser, requireMfa, requireRole } from "@/lib/auth-helpers";
src/app/api/admin/payments/nagad/test-connection/route.ts:33:  const user = await requireRole("OWNER");
src/app/api/admin/payments/refund/route.ts:14:  // FINANCE.edit is OWNER-only, the same as the former requireRole("OWNER").
src/app/api/admin/payments/sslcommerz/test-connection/route.ts:2:import { getCurrentUser, requireMfa, requireRole } from "@/lib/auth-helpers";
src/app/api/admin/payments/sslcommerz/test-connection/route.ts:33:  const user = await requireRole("OWNER");
src/lib/auth-helpers.ts:125: * requireRole() outside the deferred list.
src/lib/auth-helpers.ts:127:export async function requireRole(requiredRole: LegacyRole): Promise<SessionUser> {
src/lib/payments/banglaqr/roles.test.ts:9: * requireRole/requireMfa. Only the session source (better-auth) and Next's
src/lib/payments/banglaqr/verification.ts:15: * Authorization is enforced by the calling Server Actions (requireRole
src/lib/auth-helpers.test.ts:45:describe("requireRole", () => {
src/lib/auth-helpers.test.ts:52:    await expect(requireRole(required as "MANAGER" | "OWNER")).rejects.toThrow("NEXT_FORBIDDEN");
src/lib/auth-helpers.test.ts:64:    const user = await requireRole(required as "STAFF" | "MANAGER" | "OWNER");
src/lib/auth-helpers.test.ts:74:      await expect(requireRole("STAFF")).rejects.toThrow("NEXT_FORBIDDEN");
src/lib/auth-helpers.test.ts:80:    await expect(requireRole("STAFF")).rejects.toThrow("NEXT_FORBIDDEN");
src/lib/auth-helpers.test.ts:82:    await expect(requireRole("STAFF")).rejects.toThrow("NEXT_FORBIDDEN");
src/lib/permissions.ts:231:// ── Legacy hierarchy, for the deferred requireRole() call sites ──────────────
src/lib/permissions.ts:233:/** The three pre-A2 roles, as payment components and requireRole() still type them. */
src/lib/permissions.ts:236:/** Levels for requireRole(). Every other role has none and is always refused. */
src/lib/permissions.ts:239:/** Whether `role` passes requireRole(`required`). New roles never do. */
src/lib/permissions.ts:264:   * The page still has a deferred requireRole() guard; the item shows only
src/lib/blog/queries.ts:3: * none of them is reachable from the browser; pages call requireRole() first
src/lib/permissions.test.ts:119:describe("the legacy requireRole hierarchy", () => {
src/lib/permissions.test.ts:173:          // Deferred page: guarded by requireRole(legacyMinRole).
src/lib/permissions.test.ts:174:          expect(source).toContain(`requireRole("${rule.legacyMinRole}")`);
```
**Every match, explained:**
- **25 calls in the 10 deferred payment files** (26 at Section 2; §5 migrated the payments page's), which are the only callers `scripts/check-require-role.sh` allows (it runs in `pnpm lint`):
  - `admin/payments/banglaqr-verification/page.tsx`;
  - `actions/{banglaqr,bkash,nagad,sslcommerz}-actions.ts`;
  - `api/admin/payments/status/route.ts`;
  - `api/admin/payments/banglaqr/receipt-file/route.ts`;
  - `api/admin/payments/{bkash,nagad,sslcommerz}/test-connection/route.ts`.

  Moving them is a payment-code change, out of scope under §10. The §5.3 mapping in 02-PERMISSION-MATRIX.md gives the equivalent `requirePermission` for each. `requireRole()` refuses every non-legacy role (fail closed), so the seven new roles never pass it.
- **The rest are not calls:** the `requireRole` definition (`auth-helpers.ts:127`), comments (`middleware.ts`, `PaymentsTab.tsx`, `refund/route.ts`, `permissions.ts`, `banglaqr/verification.ts`, `blog/queries.ts`), and tests of the legacy hierarchy (`auth-helpers.test.ts`, `permissions.test.ts`, `banglaqr/roles.test.ts`).

### `grep -rn "requirePermission" src/ | wc -l`
```
104
```
Every exported Server Action outside the deferred files calls `requirePermission` inline; `check-server-actions.sh` enforces it (output in 9.1). Every admin route handler is guarded (`check-admin-api-guards.sh`), and `permission-enforcement.test.ts` runs each guard for every role.

---

## 9.5 Limitations (honest list)

**Environment**
- **L1: the dev database was emptied by a container change outside this work.** On 2026-10-03 00:56 UTC, while this work was paused, `travelwebtemplate-postgres-1` was recreated from `pgvector/pgvector:pg16` with an **anonymous** volume. It is not the container `docker-compose.dev.yml` defines (`postgres:16-alpine`, named volume `pgdata`). Every database in it started empty. On 7 Oct the §5 build's `migrate deploy` recreated the tables in `resort_dev` (all migrations show `started_at 2026-10-07 01:17:13`), but the old seed data, users and bookings are not in it.
  - The compose project's named volume **`travelwebtemplate_pgdata` still exists**, so the original `resort_dev` is probably intact there.
  - I did not touch it. To get it back, stop the pgvector container and run `docker compose -f docker-compose.dev.yml up -d`.
  - As a result, 9.3 was run on a replayed scratch database rather than `resort_dev`, and the "one STAFF user left in `resort_dev`" from §3 can't be checked.
- **L2: `main` was not updated by this work.** The owner asked for a merge after §5; the merge and push were blocked by the session's permission policy, so `main` is still at `a51af60` plus whatever the owner pushes. All of §4–§9 is on `phase-a2-foundation` only.

**Product gaps (known and logged)**
- **L3, FU-7: fixed** after the owner approved it; see the Follow-ups table.
- **L4, FU-5: fixed** after the report (addendum).
- **L5, FU-6:** fixed. Contact details, times and fees are runtime overrides; name, address and cancellation policy remain config-only by decision (10-RUNTIME-SETTINGS.md).
- **L6: 25 `requireRole` calls remain** in deferred payment code (9.4). The brief's success criterion "no requireRole remains in the operational code" is **not met** for those 10 files, by design under §10.
- **L7: the payment settings forms are English only.** They were moved into the Payments tab without changes, and the owner chose to leave them as they are.
- **L8: there is no inventory, housekeeping or other Phase B–G module.** Their flags exist and are listed, but can't be switched. Brief §9.2 step 7 was run with Rooms instead.

**Measurement limits**
- **L9: RevPAR's available room-nights use today's unit count for earlier days of the month.** There is no unit-status history yet; night audit snapshots come in Phase B.
- **L10:** part-paid desk sales (`PARTIAL`) are left out of revenue, and the dashboard shows how many. The amount actually received isn't recorded until the folio (Phase B).
- **L11:** occupancy counts bookings. A booking on a unit later put out of service can push occupancy over 100%; it is shown as computed.

**Not verified**
- **L12: real email delivery.** No Resend key was available, so delivery was only checked in mocked mode, plus the failure path in production.
- **L13: HTTP status codes for refused pages.** `forbidden()` and `redirect()` inside server components stream as `NEXT_HTTP_ERROR_FALLBACK;403` / `NEXT_REDIRECT` digests in a 200 response, which is normal Next.js behaviour. The browser shows the 403 page or follows the redirect; a crawler-style client sees 200. Route handlers return real 403/404 status codes.
- **L14:** the migrations-vs-schema drift test needs `SHADOW_DATABASE_URL` and was skipped (1 skipped).
- **L15: concurrency is tested at small scale.** 50 sequence transactions, 12 simultaneous bookings, and 8 bookings for 3 units: no load test beyond that.

---

## Follow-ups

| # | Found in | Item | Severity | Status |
|---|---|---|---|---|
| FU-1 | §1, full DB suite run on 2026-10-01 | **Concurrent bookings for one room type could fail with a Postgres deadlock.** First seen as a one-off timeout of `availability.db.test.ts` › "never double-books a unit: 8 simultaneous bookings for 3 units…". On 2026-10-01, during Section 3, it failed on every standalone run (3 of 3), so it was diagnosed. **Root cause:** transactions that pick the same free unit insert concurrently. In the `Booking_unit_no_overlap` GiST exclusion index, each can wait on the other's uncommitted row. Postgres then kills them with `40P01 deadlock detected`, not the `23P01` violation that `withUnitRetry` retried. The slow lock waits also hit Prisma's 5 s interactive-transaction timeout (`P2028`). Observed: 5 losers all failed with `40P01`, and on another run only 1 of the 3 possible bookings succeeded. **No double-booking ever happened.** The effect was a spurious error, or a false "sold out", for a guest booking at the same moment as another. | Medium (guest-facing failure under contention; never a double-booking) | **Fixed** in its own commit, just before Section 3. `assignUnit()` takes `pg_advisory_xact_lock` on the room type before reading availability, so assignments for one type queue briefly instead of racing. Other room types are unaffected. `withUnitRetry` now also retries a deadlock victim, as a backstop. The concurrency test passed 20 of 20 standalone runs and 5 of 5 whole-file runs. A new unit test covers the deadlock retry. |
| FU-2 | §1, same run | **Date-dependent Nagad test.** `src/lib/payments/nagad/resilience.test.ts` › "date rollover through the real flow" only passed when the real date was 2026-09-30. It faked Node's clock, but `Payment.createdAt` is stamped by the database clock. | Medium (every DB-backed CI run fails) | **Fixed** before Section 2. The test now anchors on `SELECT now()` from the database. `pnpm test:nagad:db`: 15 files, 255 tests passed. |
| FU-3 | §2, enforcement test | **A refused request can come back as HTTP 500 instead of 403.** A guard inside a handler's `try/catch` turns Next's `forbidden()` into the catch's error response: status 500, with the internal string `NEXT_HTTP_ERROR_FALLBACK;403` as the message. It is still fail-closed, since no data is returned. Fixed for `GET /api/admin/reports/payments` in §2. | Low | **Fixed** after the owner's review of §2. `POST /api/admin/payments/refund` now calls `requirePermission("FINANCE", "edit")` before its `try`; only the guard changed. `permission-enforcement.test.ts` covers it for every role. All four gateway suites pass (02-PERMISSION-MATRIX.md, addendum). |
| FU-4 | §2, typing | **The session role was typed narrower than its runtime value.** `SessionUser.role` was typed as the legacy `OWNER \| MANAGER \| STAFF` union so the payment files' `ROLE_RANK` compiled unchanged, but it holds any of ten roles. Every access decision already checked the runtime value. | Low (type-level only) | **Fixed** after the owner's review of §2. `SessionUser.role` is now the full `Role`. The payment files' `ROLE_RANK` type accepts every role, with a one-line change each; lookups are unchanged and unknown roles still rank 0. What remains is the narrowed alias `UserRole`, marked `@deprecated` (FU-4). It is allowed by lint only in the four payment action files, and `auth-helpers.test.ts` fails on any other importer. It is removed when those files migrate. |
| FU-5 | §4, owner review | **Email delivery is inconsistent when no Resend key is set in production.** The account emails (invitation, password reset) go through `sendEmail()` in `src/lib/email/sender.ts` and **fail** in production without `RESEND_API_KEY`, so the action rolls back. The older senders (booking confirmation, lead alert, payment status in `email/index.ts`; blog emails in `email/blog.ts`; the four payment email modules) still log a mocked send and report **success** in that case, so a misconfigured server silently sends no booking confirmations. | Medium (silent non-delivery on a misconfigured server) | **Fixed** at the owner's request (2026-10-07): every module now sends through `sendEmail()`; see the addendum and docs/EMAIL.md. |
| FU-6 | §5, General tab | **Property identity and guest policies couldn't be changed at runtime.** Fixed: an OWNER can override the contact email, phone, WhatsApp number, check-in/out times and early/late fees in Settings › General. A save is audited, refreshes the cached settings in every PM2 worker (`cache-handler.cjs`) and rebuilds the prerendered pages on their next visit. The landing page stays prerendered (about 2 ms to first byte). The name, address and cancellation policy stay in `brand.config.ts` by decision. Details and live evidence: 10-RUNTIME-SETTINGS.md. | Low | **Fixed.** |
| FU-7 | §6, writing the KPIs | **A booking waiting for Bangla QR verification does not hold its unit.** `PENDING_MANUAL_VERIFICATION` is missing from `LIVE_BOOKING_STATUSES` (`src/lib/rooms/availability.ts`) and from the `Booking_unit_no_overlap` constraint's `WHERE`. While a guest's receipt waits for review, the engine treats the unit as free and can sell it again. When staff then verify the payment and the booking returns to `CONFIRMED`, the constraint rejects it, so a guest who has paid can end up with no room. | High (double-sell of a paid stay) | **Fixed** after the owner approved it (2026-10-07). `LIVE_BOOKING_STATUSES` and the `Booking_unit_no_overlap` constraint include `PENDING_MANUAL_VERIFICATION` (migration `20261001170000_unit_hold_pending_verification`). The migration first unassigns any awaiting booking whose unit was already resold, or whose unit another awaiting booking holds, with a `BOOKING_UNIT_UNASSIGNED` audit row each. Tested on a scratch DB with all three cases, which ended with the right unit kept, 2 audit rows, and the constraint refusing a new overlap. `rooms/pending-verification.db.test.ts` 3/3; Bangla QR suite 96/96. |

## Addendum: changes after the report (owner review, 2026-10-07)

### FRONT_DESK menu (owner decision)
- **Matrix:** FRONT_DESK and STAFF lose `ROOMS.view` and `BLOG.view/create` (01-ROLES-AND-PERMISSIONS.md §4, §4.1, §6, §8). Blog writing is now OWNER and MANAGER only; no role is left that can draft without publishing (docs/blog/PERMISSIONS.md).
- **New Front Desk page, `/admin/front-desk`** (`FRONT_DESK.view`, `frontDesk` module), loaded by `src/lib/front-desk/today.ts`:
  - **Lists:** today's arrivals, departures and in-house stays on the property's business day.
  - **Each stay shows:** unit number, dates and nights, guest count, a call button and a link to the booking, where check-in/out happens.
  - **No money** (FRONT_DESK has no FINANCE).
  - **Overdue checkouts** are flagged.
- **Tests:** `front-desk/today.db.test.ts` 2/2 (Dhaka business day at 00:30, arrivals including payment-under-review, departures, in-house order and overdue flag); `permissions.test.ts` and `module-flags.test.ts` updated from the doc.
- **Live** (production build, scratch DB, 360px, `test-front-desk@demo.resort`):
  - Sign-in landed on `/admin/front-desk`.
  - The sidebar was `/admin/front-desk, /admin/bookings, /admin/guests`.
  - The page listed 1 arrival (Room CBOD-1), 1 departure and 1 in-house (CBOD-2), in EN and in BN with Bengali digits, at `scrollWidth` 345.
  - `/admin/blog` and `/admin/rooms` returned `NEXT_HTTP_ERROR_FALLBACK;403`.

### Email production readiness (FU-5, owner request)
- **One send path:** every module now goes through `sendEmail()` in `src/lib/email/sender.ts`: booking, lead, payment status, blog, account, and the bKash, Nagad, SSLCommerz and Bangla QR modules.
  - Before this change, the four payment modules hard-coded Resend's test sender `onboarding@resend.dev`. With a real key, **guests would not have received payment emails**, because Resend only delivers the test sender's mail to the account owner.
- **Production without a key** fails everywhere, and the failure is logged without the recipient. With a key, a 429, 5xx or network error is retried once with the same `Idempotency-Key`.
- **The sender** is `RESEND_FROM_EMAIL`, otherwise `bookings@<brand.config domain>` in production. Replies go to the resort's contact email (a lead alert's reply goes to the guest).
- **Fixed in the templates:**
  - The booking, lead and payment-status emails now HTML-escape guest-typed values. Before, a guest name was interpolated raw.
  - The guest footer "sent via Resend Transactional Email Engine" is now the resort's name.
- **`.env.example`** no longer ships a fake key; the old placeholder value is treated as "no key".
- **Settings → General → Email (Resend)** shows readiness and names each problem, with an OWNER-only **Send test email** (audited `EMAIL_TEST_SENT`, one per 30 s).
- **Setup guide:** `docs/EMAIL.md`.
- **Tests:**
  - `email/sender.test.ts` 14 (sender rules, production failure, placeholder key, Reply-To, Idempotency-Key, retry rules, never throws, no PII in logs, subject CRLF, config status);
  - `email/index.test.ts` 3 (escaping, Reply-To for leads, failure reported not thrown);
  - `actions/email-test.db.test.ts` 4 (send and audit, cooldown, Resend's refusal shown, mocked in development);
  - enforcement test: `sendTestEmailAction` is OWNER-only;
  - gateway suites: nagad 255/255, sslcommerz 334/334, bkash 157/157, banglaqr 96/96;
  - full suite 1,208 passed, 1 skipped.
- **Live** (production build, no key, 360px, OWNER with 2FA):
  - The card showed *Not ready*, Production, key "Not set", sender `bookings@clientresort.com` (brand-domain default), "RESEND_API_KEY is not set, so no email is sent."
  - **Send test email** answered "The email was not sent: RESEND_API_KEY is not set". It was checked in Bengali too; `scrollWidth` 345.
- **Not verified:** real delivery through Resend, which needs your key and a verified domain. That is the first thing to do after adding the key (docs/EMAIL.md step 5).

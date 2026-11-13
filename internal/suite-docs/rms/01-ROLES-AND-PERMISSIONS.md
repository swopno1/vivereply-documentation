# RMS Roles and Permissions

**Status:** Source of truth for the permission matrix (Phase A2 adjustment A1). `src/lib/permissions.ts` implements exactly this table. `docs/rms/phase-a2/02-PERMISSION-MATRIX.md` records how it was implemented. If the two ever disagree, this document wins, and the code is fixed to match.
**Audience:** the owner (approves who may do what) and developers adding a module or a guarded action.
**Inputs:** the Phase A2 brief §2–§3, the baseline `docs/rms/phase-a2/00-BASELINE.md` (§0.3 call-site inventory; findings N3, N4, N5, N11, N14), and `docs/blog/PERMISSIONS.md`.

---

## 1. Principles

1. **Permissions are code, not data (v1).** The matrix is a typed constant, reviewed in pull requests and tested exhaustively. There are no Role or Permission tables. A client that needs a custom role gets a code change, not an admin screen.
2. **One role per user.** `User.role` is the Prisma `UserRole` enum, a single value. Multi-role users are out of scope for v1. If someone does two jobs, give them the broader role.
3. **Fail closed.**
   - A role with no entry for a module has no access to it.
   - An action not listed is denied.
   - An unknown role value is denied everything.
   - There is **no fallback level.** This removes today's `|| 1` fallback, which treats every new role as STAFF (N3).
4. **The server is the boundary.** Every Server Action, route handler and admin page checks `requirePermission(module, action)` on the server. Hiding a link in the sidebar is only a convenience.
5. **Module flags come first.** When a module is disabled for a deployment (`docs/rms/phase-a2/05-FEATURE-FLAGS.md`), nobody can use it, OWNER included. Permissions decide *who*; flags decide *whether at all*.
6. **2FA is separate.** `requireMfa()` still forces OWNER accounts to enrol TOTP before reaching settings and OWNER-only actions. It sits on top of permissions and does not replace them.

## 2. Roles

| Role | Label (EN) | Label (BN) | Purpose | Assignable |
|---|---|---|---|---|
| `OWNER` | Owner | মালিক | Full access to all modules and settings | ✅ |
| `MANAGER` | Manager | ম্যানেজার | Day-to-day operations, no financial admin | ✅ |
| `FRONT_DESK` | Front Desk | ফ্রন্ট ডেস্ক | Bookings, check-in/out, daily sheet | ✅ |
| `HOUSEKEEPING` | Housekeeping | হাউসকিপিং | Room status, cleaning queue | ✅ |
| `KITCHEN` | Kitchen | রান্নাঘর | Room service tickets, kitchen inventory | ✅ |
| `STOREKEEPER` | Storekeeper | স্টোরকিপার | Inventory and purchase receipts | ✅ |
| `ACCOUNTANT` | Accountant | হিসাবরক্ষক | Expenses, purchases, ledgers, reports | ✅ |
| `HR` | HR | এইচআর | Staff records, attendance, shifts | ✅ |
| `AUDITOR` | Auditor | অডিটর | Read-only access to all modules | ✅ |
| `STAFF` | (Deprecated) | (অপ্রচলিত) | Legacy role. Existing STAFF users become FRONT_DESK in Phase A2 §3.1 | ❌ never offered in invite or role pickers |

`STAFF` stays in the enum so old rows and old sessions still parse. Existing STAFF users are moved to FRONT_DESK by the audited one-shot script `pnpm users:staff-to-front-desk` (not a Prisma migration). The column default and Better Auth's `defaultRole` are FRONT_DESK. See phase-a2/03-TEST-USERS.md §2. Its grants mirror `FRONT_DESK` exactly, so a STAFF user who hasn't been migrated behaves like front desk, not like "everything a STAFF level allowed". The final bilingual descriptions live in `src/content/en.ts` / `bn.ts` (Phase A2 §3.2). This table is their reference.

## 3. Modules and actions

**Actions** (the same six for every module):

| Action | Meaning |
|---|---|
| `view` | See the module's pages and records |
| `create` | Add new records |
| `edit` | Change existing records |
| `delete` | Remove or archive records, or deactivate them where there is no hard delete |
| `approve` | Make a decision that others' work waits on: confirm, reject, verify, publish, sign off |
| `export` | Download CSV or print reports out of the module |

**Modules:**

| Module | Covers | Module flag (Phase A2 §7) | Exists today? |
|---|---|---|---|
| `BOOKING` | Reservations: list, detail, offline booking, edits, confirm/cancel | core (always on) | ✅ |
| `FRONT_DESK` | Guest records, check-in/out status moves, guest notes, daily sheet (Phase B) | `frontDesk` | partly (guests, status moves) |
| `ROOMS` | Room types, physical room units, unit status | `rooms` | ✅ (units from A2 §1) |
| `HOUSEKEEPING` | Cleaning queue, room readiness | `housekeeping` | ✅ (Phase B2) |
| `ROOM_SERVICE` | Room service tickets, menu | `roomService` | ✅ (Phase C) |
| `INVENTORY` | Stock items, stock movements | `inventory` | ✅ (Phase D) |
| `PURCHASE` | Purchase orders, goods received | `purchase` | Phase E |
| `EXPENSE` | Expense entries and approval | `expenses` | Phase E |
| `FINANCE` | Payments, gateway verification queue, refunds, reconciliation | `finance` ¹ | ✅ (payment admin) |
| `HR` | Staff records, attendance, leave, payroll | `hr`, `payroll` | ✅ (Phase G) |
| `REPORTS` | Dashboard KPIs, reports, report exports | `reports` / `ownerDashboard` | ✅ (dashboard, payments CSV) |
| `SETTINGS` | Property settings, payment gateway settings, PMS, modules, tax | core | ✅ |
| `USERS` | User list, invite, role change, deactivate, password reset | core | A2 §4 |
| `AUDIT` | Audit log viewer | `auditLog` | ✅ (Phase A3) |
| `BLOG` | Blog posts, moderation, taxonomy | core (website feature) | ✅ (N4) |

¹ The existing gateway payment admin (BanglaQR queue, refunds, status checks) keeps working even when the `finance` flag is off. Guests' payments must never depend on an RMS flag. The flag gates only the new Phase F finance screens. `05-FEATURE-FLAGS.md` records this exception.

## 4. The matrix

Legend: **V** view · **C** create · **E** edit · **D** delete · **A** approve · **X** export · `—` no access.

| Module ↓ / Role → | OWNER | MANAGER | FRONT_DESK | HOUSEKEEPING | KITCHEN | STOREKEEPER | ACCOUNTANT | HR | AUDITOR | STAFF (dep.) |
|---|---|---|---|---|---|---|---|---|---|---|
| BOOKING | VCEDAX | VCEAX | VC | — | — | — | VX | — | VX | VC |
| FRONT_DESK | VCEDAX | VCEAX | VCE | — | — | — | — | — | VX | VCE |
| ROOMS | VCEDAX | VCEX | — | V | — | — | — | — | VX | — |
| HOUSEKEEPING | VCEDAX | VCEAX | V | VCE | — | — | — | — | VX | V |
| ROOM_SERVICE | VCEDAX | VCEAX | VC | V | VE | — | — | — | VX | VC |
| INVENTORY | VCEDAX | VCEAX | — | V | V | VCEX | VX | — | VX | — |
| PURCHASE | VCEDAX | VCEAX | — | — | — | VCE | VAX | — | VX | — |
| EXPENSE | VCEDAX | VCEA | — | — | — | — | VCEAX | — | VX | — |
| FINANCE | VCEDAX | VA | — | — | — | — | VCAX | — | VX | — |
| HR | VCEDAX | VCE | — | — | — | — | — | VCEDX | VX | — |
| REPORTS | VCEDAX | VX | — | — | — | — | VX | — | VX | — |
| SETTINGS | VCEDAX | — | — | — | — | — | — | — | V | — |
| USERS | VCEDAX | — | — | — | — | — | — | — | V | — |
| AUDIT | VCEDAX | — | — | — | — | — | — | — | VX | — |
| BLOG | VCEDAX | VCEDAX | — | — | — | — | — | — | V | — |

Reading the table:
- **OWNER** has every action on every module.
- **MANAGER** runs operations but has no `SETTINGS`, `USERS` or `AUDIT` access. In `FINANCE` a manager can **verify** payments (V A), which they do today in the BanglaQR queue, but cannot refund or override. Refunds and overrides are `FINANCE.edit`/`delete`, which only OWNER has.
- **FRONT_DESK** can create bookings but cannot **edit** an existing booking's dates, room or amount (`BOOKING.edit`), or confirm or cancel one (`BOOKING.approve`). Those stay with MANAGER, as today.
- **AUDITOR** gets `view` on everything and `export` wherever there is data to export. It never gets create, edit, delete or approve.
- **STAFF** mirrors FRONT_DESK exactly.

### 4.1 Cells that differ from the Phase A2 brief's example

The brief's example matrix was illustrative. Where this table differs, it is deliberate:

| Cell | Brief example | Here | Why |
|---|---|---|---|
| FRONT_DESK × BOOKING | V C E | V C | Editing a booking's dates, room or amount is `requireRole("MANAGER")` today (`admin-actions.ts:412`). Keeping it with MANAGER makes the migration behaviour-neutral and keeps price changes behind a manager. |
| MANAGER × SETTINGS | "MANAGER to view" General (§5.2) | — | §9.2 requires the MANAGER sidebar to hide Settings, and today's settings pages are OWNER-only. The two parts of the brief conflict. This follows §9.2 and today's code. |
| MANAGER × ROOMS | (not given) | V C E X | **Owner decision (2026-10-01).** A MANAGER keeps creating and editing room types (`ROOMS.create` / `ROOMS.edit`), as today, so launching a new room type or rate-card change does not wait for the owner. `ROOMS.delete` is OWNER-only and covers the two changes to a property's physical inventory that brief §1.5 reserves for the owner: deactivating a room type, and **adding or removing a unit of an existing room type**. Unit add sits under `delete` rather than `create` because `create` is the MANAGER's room-type action. The permission that matters here is "changes the property's inventory", and that is the owner-only one. The units a MANAGER enters when *creating* a new room type are part of creating that type. After that, the unit set only changes through the owner. |
| Everyone × BLOG | (no BLOG module) | as shown | N4: the blog has 24 guarded call sites. FRONT_DESK/STAFF had V C until the owner's 2026-10-07 decision (§8) removed it; blog writing is now OWNER and MANAGER. |
| FRONT_DESK sidebar | "Front Desk, Bookings, Guests" (§9.2) | Front Desk, Bookings, Guests | **Owner decision (2026-10-07):** matches the brief. ROOMS and BLOG were removed from FRONT_DESK/STAFF. Unit numbers the desk needs are shown on the Front Desk page (`/admin/front-desk`) and the booking pages. |

## 5. Guard mapping for existing call sites

All 71 call sites from baseline §0.3 are mapped here. **Migrated in A2** means the call site changes to `requirePermission` in Phase A2 §2. **Deferred** means it keeps `requireRole` (payment code). For deferred sites the mapping is the target, to be applied under the standing rule in §7.

### 5.1 Operational (migrated in A2)

| Call site | Today | Becomes |
|---|---|---|
| `actions/admin-actions.ts` `createOfflineBooking` | STAFF | `BOOKING.create` |
| `admin-actions.ts` `updateBookingStatus` → CONFIRMED / CANCELLED | MANAGER | `BOOKING.approve` |
| `admin-actions.ts` `updateBookingStatus` → any other status (CHECKED_IN, COMPLETED, PENDING) | STAFF | `FRONT_DESK.edit` |
| `admin-actions.ts` `toggleRoomStatus` (activate/deactivate room type) | OWNER | `ROOMS.delete` |
| `admin-actions.ts` `createOrUpdateRoom` with id | MANAGER | `ROOMS.edit` |
| `admin-actions.ts` `createOrUpdateRoom` without id (new room type, with its initial units) | MANAGER | `ROOMS.create` |
| `room-unit-actions.ts` `addRoomUnit`, `removeRoomUnit` | OWNER (+2FA) | `ROOMS.delete` (+`requireMfa`, see §4.1) |
| `room-unit-actions.ts` `updateRoomUnit`, `setRoomUnitStatus` | MANAGER | `ROOMS.edit` |
| `admin-actions.ts` `updateGuestNotes` | STAFF | `FRONT_DESK.edit` |
| `admin-actions.ts` `updateBooking` | MANAGER | `BOOKING.edit` |
| `admin-actions.ts` `cancelBookingWithRefundDecision` | MANAGER | `BOOKING.approve` |
| `admin/page.tsx` (dashboard) | any signed-in | `REPORTS.view` (roles without it are sent to their landing page, §6) |
| `admin/bookings/page.tsx`, `bookings/[id]/page.tsx` | any signed-in | `BOOKING.view` |
| `admin/bookings/new/page.tsx` | STAFF | `BOOKING.create` |
| `admin/guests/page.tsx` | any signed-in | `FRONT_DESK.view` |
| `admin/rooms/page.tsx` | any signed-in | `ROOMS.view` |
| `admin/rooms/[id]/page.tsx` | MANAGER | `ROOMS.edit` to open an existing room type, `ROOMS.create` for `/admin/rooms/new`. There is no read-only room page, so view-only roles use the list. The unit add/remove controls need `ROOMS.delete`. |
| `admin/settings/page.tsx` | OWNER | `SETTINGS.view`. Each tab checks its own permission (General edit: `SETTINGS.edit`; Users: `USERS.view`). |
| `admin/settings/integrations/page.tsx` (now the PMS tab, A2 §5; the old URL redirects) | OWNER | `SETTINGS.edit` |
| `api/admin/pms/test-connection` POST | OWNER | `SETTINGS.edit` |
| `api/admin/reports/payments` GET | MANAGER | `REPORTS.export` |
| `admin/setup-2fa/page.tsx` | any signed-in | **stays `requireAuth`**: every role must be able to enrol 2FA |

### 5.2 Blog (migrated in A2, per N4)

The entry guard changes. The per-post rules in `src/lib/blog/permissions.ts` (own-post editing, publish decisions) run afterwards, unchanged.

| Call sites | Today | Becomes |
|---|---|---|
| Pages `/admin/blog`, `/[id]/preview` | STAFF | `BLOG.view` |
| Pages `/admin/blog/new`, `/[id]`; `savePostAction`; `previewMarkdownAction`; `POST /api/admin/blog/images` | STAFF | `BLOG.create` |
| `saveCategoryAction`, `saveTagAction`, `createTagFromNameAction`; pages `/categories`, `/tags` | MANAGER | `BLOG.edit` |
| `deletePostAction`, `deleteCategoryAction`, `deleteTagAction` | MANAGER | `BLOG.delete` |
| `bulkPostsAction` (archive or delete) | MANAGER | `BLOG.delete` |
| `approvePostAction`, `rejectPostAction`, `archivePostAction`, `saveModerationNoteAction`; pages `/pending`, `/pending/[id]` | MANAGER | `BLOG.approve` |
| `updateBlogSettingsAction`; page `/admin/blog/settings` | OWNER | `SETTINGS.edit` (+ `requireMfa`, unchanged) |

With the matrix above, OWNER and MANAGER keep every blog ability, and FRONT_DESK/STAFF keep exactly what STAFF has today. The only difference is that the six other new roles lose the blog access they currently get by accident through the STAFF fallback.

### 5.2a User management (new in A2 §4)

| Surface | Guard |
|---|---|
| `/admin/settings?tab=users` (list) | `SETTINGS.view` + `USERS.view` (OWNER, AUDITOR) |
| `inviteUserAction` (also resends a pending invitation) | `USERS.create` + OWNER 2FA |
| `changeUserRoleAction`, `sendPasswordResetAction`, `setTwoFactorRequiredAction` | `USERS.edit` + OWNER 2FA |
| `setUserActiveAction` (deactivate / reactivate), `cancelInviteAction` | `USERS.delete` + OWNER 2FA |
| `POST /api/account/accept-invite`, `POST /api/account/reset-password`; pages `/admin/accept-invite`, `/admin/reset-password` | Public: the single-use token is the credential (phase-a2/08-USER-MANAGEMENT.md §3) |

Deactivating uses `USERS.delete` because it removes all access. Nothing is deleted; the row, its history and its audit trail stay.

### 5.2b Settings tabs (A2 §5)

| Surface | Guard |
|---|---|
| `/admin/settings` (page) | `SETTINGS.view` + OWNER 2FA (`requireMfa`) |
| General tab (view) | `SETTINGS.view` (OWNER edits, AUDITOR read-only) |
| `updateGeneralSettingsAction` | `SETTINGS.edit` + OWNER 2FA |
| Payments tab (formerly `/admin/settings/payments`, which redirects here) | `SETTINGS.edit`, **migrated** from `requireRole("OWNER")`; the gateway forms and their actions are unchanged |
| PMS tab (formerly `/admin/settings/integrations`, which redirects here) | `SETTINGS.edit` |
| Users tab | `USERS.view` (§5.2a) |
| Modules, Tax tabs (placeholders) | `SETTINGS.view` |

The tab bar shows only the tabs the role can open (`src/app/admin/settings/tabs/registry.ts`). MANAGER has no `SETTINGS` access, so it gets 403 on every tab. The brief's "MANAGER to view" General was decided against in §4.1.

### 5.3 Payments (deferred, target mapping)

| Call sites | Today | Target |
|---|---|---|
| `checkBkashPaymentStatusAction`, `checkNagadPaymentStatusAction`, `checkSSLCommerzPaymentStatusAction`; `GET /api/admin/payments/status` | MANAGER | `FINANCE.view` |
| `getBanglaQRReceiptUrlAction`; `GET /api/admin/payments/banglaqr/receipt-file` | MANAGER | `FINANCE.view` |
| `confirmBanglaQRPaymentAction`, `rejectBanglaQRPaymentAction`, `requestBanglaQRReceiptAction`; page `/admin/payments/banglaqr-verification` | MANAGER | `FINANCE.approve` |
| `refundBkashPaymentAction`, `refundNagadPaymentAction`, `refundSSLCommerzPaymentAction`, `resolveNagadRefundAction`, `resolveSSLCommerzRefundAction` | OWNER | `FINANCE.edit` |
| `confirmBanglaQRWithoutReceiptAction`, `releaseExpiredBanglaQRBookingsAction` | OWNER | `FINANCE.edit` |
| `deleteBanglaQRReceiptAction` | OWNER | `FINANCE.delete` |
| `update{Bkash,Nagad,SSLCommerz,BanglaQR}SettingsAction`; `POST /api/admin/payments/{bkash,nagad,sslcommerz}/test-connection` | OWNER | `SETTINGS.edit` |

`POST /api/admin/payments/refund` has already migrated to `FINANCE.edit`, with the guard outside its `try` (owner review of Section 2, FU-3). The BanglaQR verification page and all of `banglaqr-actions.ts` migrated on 2026-11-01 (`FINANCE.view`/`approve`/`edit`/`delete`, `SETTINGS.edit`); ACCOUNTANT can now verify, and both files are off the deferred list.

Once a deferred file migrates, ACCOUNTANT gains the payment status and verification abilities (`FINANCE.view` / `approve`) that it is meant to have. Until then, deferred call sites allow only OWNER and MANAGER, as they do today.

## 6. Sidebar and landing page

The sidebar is computed from this matrix. Nothing is hard-coded per role.

| Nav item | Route | Visible when |
|---|---|---|
| Dashboard | `/admin` | `REPORTS.view` |
| Front Desk | `/admin/front-desk` | `FRONT_DESK.view` |
| Chatbot Admin | `/admin/chatbot-admin` | `FRONT_DESK.view` |
| Housekeeping | `/admin/housekeeping` | `HOUSEKEEPING.view` (Phase B2) |
| Room Service | `/admin/room-service` | `ROOM_SERVICE.view` (Phase C) |
| Inventory | `/admin/inventory` | `INVENTORY.view` (Phase D) |
| Purchasing | `/admin/purchasing` | `PURCHASE.view` (Phase E) |
| Expenses | `/admin/expenses` | `EXPENSE.view` (Phase E) |
| Finance | `/admin/finance` | `FINANCE.view` (Phase F) |
| Payments | `/admin/payments` | `FINANCE.view` |
| HR | `/admin/hr` | `HR.view` (Phase G) |
| Bookings | `/admin/bookings` | `BOOKING.view` |
| BanglaQR Queue | `/admin/payments/banglaqr-verification` (reached via the Payments hub and Finance → Waiting for approval) | `FINANCE.view` to read; the confirm / reject actions need `FINANCE.approve` |
| Blog Articles | `/admin/blog` | `BLOG.view` |
| Rooms | `/admin/rooms` | `ROOMS.view` |
| Guests | `/admin/guests` | `FRONT_DESK.view` |
| Settings | `/admin/settings` | `SETTINGS.view` |
| System Health | `/admin/system` | `SETTINGS.view` (go-live) |
| Audit Log | `/admin/audit` | `AUDIT.view` (Phase A3) |

**Rule for deferred pages (N5):** a nav item that points at a page still guarded by `requireRole` carries that page's legacy role as an extra condition, so the sidebar never shows a link that returns 403. A unit test checks, for every role, that nav visible ⇒ page guard passes. The extra condition is removed when the page migrates.

Resulting sidebars:

| Role | Sees |
|---|---|
| OWNER | Dashboard, Front Desk, Chatbot Admin, Housekeeping, Room Service, Inventory, Purchasing, Expenses, Finance, Payments, HR, Bookings, Blog Articles, Rooms, Guests, Settings, System Health, Audit Log |
| MANAGER | Dashboard, Front Desk, Chatbot Admin, Housekeeping, Room Service, Inventory, Purchasing, Expenses, Finance, Payments, HR, Bookings, Blog Articles, Rooms, Guests |
| FRONT_DESK / STAFF | Front Desk, Chatbot Admin, Housekeeping, Room Service, Bookings, Guests |
| HOUSEKEEPING | Housekeeping, Room Service, Inventory, Rooms |
| KITCHEN | Room Service, Inventory |
| STOREKEEPER | Inventory, Purchasing |
| HR | HR |
| ACCOUNTANT | Dashboard, Inventory, Purchasing, Expenses, Finance, Payments, Bookings |
| AUDITOR | Dashboard, Front Desk, Chatbot Admin, Housekeeping, Room Service, Inventory, Purchasing, Expenses, Finance, Payments, HR, Bookings, Blog Articles, Rooms, Guests, Settings, System Health, Audit Log |

AUDITOR opens everything read-only: the pages render, and every action they offer refuses at the server.

`src/lib/permissions.test.ts` checks this table against the code.

**Landing page (N11):** after sign-in, and whenever `/admin` is opened without `REPORTS.view`, the user is redirected to their first visible nav item. A role with no visible item (for example HR while the `hr` module is switched off) lands on a "Nothing to show yet" page that names their role. It is not an error.

## 7. Rules for developers

1. **Every new guarded surface calls `requirePermission(module, action)`.** That covers Server Actions, route handlers and admin pages. Pick the narrowest action. Reads are `view`, and file downloads are `view` unless they are bulk reports (`export`).
2. **One check per decision.** When an action's permission depends on its input (for example `updateBookingStatus`), branch *before* the check, and call `requirePermission` with the permission for that branch.
3. **Adding a module or changing a cell** means editing this document and `src/lib/permissions.ts` in the same PR. The exhaustive test fails if a role × module × action combination is missing from the matrix.
4. **Standing rule for the deferred list:** a change that edits any file on the deferred list (§5.3, and baseline §0.3 "Payments") migrates **every** guard in that file to its target permission in the same PR, and runs that gateway's full test suite (`pnpm test:<gateway>:db`).
5. **`requireRole` is legacy.** It stays exported for the deferred call sites only. After Phase A2 it grants access only to OWNER, MANAGER and STAFF (`OWNER > MANAGER > STAFF`). Any other role is always refused, so the STAFF fallback cannot come back.
6. **The lint gate** (`pnpm check:guards`) enforces this:
   - `check-server-actions.sh` finds every `"use server"` module and fails when an exported action does not call `requirePermission(`. Only the deferred payment files may use `requireRole(` instead.
   - `check-admin-api-guards.sh` does the same for `src/app/api/admin/**`; `requireAuth`/`requireMfa` alone never count.
   - `check-require-role.sh` fails on any `requireRole(` call outside the deferred list, and on a deferred entry whose file no longer exists.

## 8. Owner decisions

Answered by the owner on 2026-10-01. Each one is reflected in the matrix above.

| Question | Decision |
|---|---|
| May a MANAGER create new room types? | **Yes.** `ROOMS.create` stays with MANAGER. Only `ROOMS.delete` (deactivating a room type, and adding or removing units of an existing type) is OWNER-only. See §4.1. |
| May an ACCOUNTANT issue refunds? | **No.** Refunds and payment overrides are `FINANCE.edit`, which is OWNER-only. ACCOUNTANT keeps `FINANCE` V C A X. |
| Should the front desk see only Front Desk, Bookings and Guests (brief §9.2)? (2026-10-07) | **Yes.** FRONT_DESK/STAFF lose `ROOMS.view` and `BLOG.view/create`. A new Front Desk page (`/admin/front-desk`: today's arrivals, departures and in-house, with unit numbers) is their landing page. |
| Does HR get access to USERS (inviting or managing logins)? | **No.** HR has no USERS access. Inviting users, changing roles, deactivation and password resets stay OWNER-only (AUDITOR can view). |

## 9. PII masking matrix

Decided 2026-11-01. The front desk verifies IDs at check-in, so desk roles
see full guest NID/passport; salaries and bank details are full only for
roles that edit HR. Masking uses `maskTail` (`src/lib/privacy/mask.ts`)
for identifiers and `MASKED` (`•••`) for amounts.

| Field | Full for | Masked for | Masked as |
|---|---|---|---|
| Guest NID / passport | `FRONT_DESK.edit` (OWNER, MANAGER, FRONT_DESK, STAFF) | ACCOUNTANT, AUDITOR | tail (`••••8901`) |
| Staff NID | `HR.edit` (OWNER, MANAGER, HR) | AUDITOR | tail |
| Staff bank account | `HR.edit` | AUDITOR | tail |
| Monthly salary | `HR.edit` | AUDITOR | `•••` |

CSV parity: `GET /api/admin/hr/export` applies the same rule as the
screens the exporter just saw — NID/account tail-masked (as before),
salary `•••` unless the exporter holds `HR.edit`. Edit forms always show
full values (editing requires them); the forms sit behind `HR.edit`
already. Phone and email stay unmasked everywhere in /admin (desk staff
call and mail guests constantly); the guest-facing confirmation page
masks NID. Pinned by `src/app/admin/pii-masking.test.ts`.



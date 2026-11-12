# RMS Documentation Index

A single entry point into the RMS (Reservation Management System): what each module does, who
can use it, the routes and library code behind it, and where to read the full build history.
Read this first; follow the linked phase doc only when you need the step-by-step detail or the
reasoning behind a specific decision.

The RMS was built in phases, each with its own folder under `docs/rms/`:

| Phase | Covers | Status |
|---|---|---|
| A1 | Auth, Postgres migration, money-as-integer, baseline fixes | Done, merged |
| A2 | Roles/permissions, room units, user management, settings, feature flags | Done, merged |
| B | Business date, folio, night audit, daily sheet | Done, merged |
| B2 | Housekeeping, cash shifts | Done, merged |
| C | Room service | Done, merged |
| D | Inventory | Done, merged |
| E | Purchasing (suppliers, purchase orders), expenses | Done, merged |
| F | Finance and accounting: the books, automatic postings, supplier bills and payments, petty cash, reports | Done, merged |
| G | HR and payroll: staff records, attendance and leave, monthly payroll, payslips, salaries in the books | Done, merged |
| A3 | Audit log viewer; audit log made append-only; sign-ins audited | Done, merged |
| Go-live | System health, heartbeats for every job, sign-in rate limits, complete crontab, go-live checklist | Done, merged |

`docs/rms/00-CURRENT-STATE.md` is the baseline audit the whole rebuild started from (useful for
history; parts of it are now stale — this index reflects the current codebase). `docs/rms/
01-ROLES-AND-PERMISSIONS.md` is the full permission matrix referenced throughout this index.

---

## 1. Roles

Defined in `src/lib/permissions.ts` (`ASSIGNABLE_ROLES`) and filtered per property by
`src/lib/rms/roles.ts`. From most to least privileged: **OWNER**, **MANAGER**, **FRONT_DESK**
(STAFF is a deprecated alias with identical permissions — `docs/rms/phase-a2/03-TEST-USERS.md`).
The full module × role matrix is `docs/rms/01-ROLES-AND-PERMISSIONS.md` §4. One rule to
remember: a module being switched off (§2 below) refuses every role, OWNER included.

## 2. Module flags

`src/lib/rms/module-flags.ts` is the single source of truth for which modules exist for a given
property. `brand.config.ts` sets each client's defaults; an OWNER can override them at runtime
from Settings → Modules (`Settings.rmsModules` in the DB). A disabled module's page renders
`<ModuleGate>` (`src/components/admin/ModuleGate.tsx`) instead of running, and its Server
Actions/routes throw `ModuleDisabledError` / return 404 — never a silent no-op.

**Live today** (`LIVE_MODULES`): Front Desk, Housekeeping, Room Service, Inventory, Purchasing,
Expenses, Accounting, Finance, HR, Payroll, Rooms, Reports, Owner Dashboard, Audit Log. Purchasing, Accounting,
Finance, HR and Payroll are off by default in this template's `brand.config.ts` ("enabled per
client"); an OWNER switches them on in Settings → Modules (Finance needs Accounting, Payroll needs HR).
**Planned, not built** (`PLANNED_PHASE`): none — every module is built.

## 3. Front Desk

**What it does:** the day-to-day desk workflow — guest list, check-in/check-out status moves,
guest notes, each stay's folio (charges and payments), the night audit that closes a business
day, the daily sheet summary, and cash shift tracking.
**Who:** FRONT_DESK and above.
**Routes:** `/admin/front-desk` (today's arrivals/departures), `/admin/front-desk/daily-sheet`,
`/admin/front-desk/night-audit`, `/admin/front-desk/cash` (+ `/cash/[id]` for one shift).
**Library:** `src/lib/front-desk/`, `src/lib/folio/`, `src/lib/night-audit/`,
`src/lib/daily-sheet/`, `src/lib/business-day.ts`.
**Full detail:** `docs/rms/phase-b/01-BUSINESS-DATE.md`, `02-FOLIO.md`, `03-NIGHT-AUDIT.md`,
`04-DAILY-SHEET.md`, `05-VERIFICATION.md`.
**Not yet built:** room moves (changing a stay's unit from the desk) — a manager edits the
booking's unit directly instead; see `docs/rms/phase-b2/03-VERIFICATION.md` L1.

## 4. Housekeeping

**What it does:** tracks each room unit's cleanliness (Dirty → Clean → Inspected), separate
from its operational status (in-service/maintenance/out-of-order). Checkout marks a unit Dirty;
housekeeping staff mark it Clean; a manager marks it Inspected. Check-in only warns on a
not-inspected room — it never blocks.
**Who:** FRONT_DESK marks Clean; MANAGER+ marks Inspected.
**Routes:** `/admin/housekeeping` (the board).
**Library:** `src/lib/housekeeping/`. Cleanliness lives on `RoomUnit.housekeeping`, tracked only
while the `housekeeping` module flag is on.
**Full detail:** `docs/rms/phase-b2/01-HOUSEKEEPING.md`.
**Not yet built:** housekeeper assignment (who's cleaning which room).

## 5. Cash shifts

**What it does:** per-person shift cash tracking with a blind count at close. Any variance
(zero tolerance) requires a manager sign-off with a reason recorded. A desk CASH folio line
must carry the recording staff's open shift; voids post against the original transaction's
shift, not the voider's.
**Who:** any Front Desk role opens their own shift; a manager (not the shift's own owner,
unless OWNER) approves a variance.
**Routes:** `/admin/front-desk/cash`, `/admin/front-desk/cash/[id]`.
**Library:** `src/lib/cash/` (see `__tests__/fixtures.ts`'s `ensureOpenShift` for the pattern
every cash-taking test uses).
**Full detail:** `docs/rms/phase-b2/02-CASH-SHIFTS.md`.
**Not yet built:** drawer handover/safe tracking between shifts.

## 6. Rooms (room types & units)

**What it does:** admin for room types (`Room`) and their physical units (`RoomUnit`) — the
model the whole booking system's concurrency safety is built on (see
`docs/PRODUCTION-READINESS-REPORT.md` §7 for how booking and RMS share this data).
**Who:** MANAGER+.
**Routes:** `/admin/rooms`, `/admin/rooms/[id]`.
**Library:** `src/lib/rooms/availability.ts` (assignment, overlap checks, the advisory lock).
**Full detail:** `docs/rms/phase-a2/01-ROOM-UNIT-MIGRATION.md`.

## 7. Owner Dashboard & Reports

**What it does:** KPI dashboard (`/admin`) and a payments CSV export
(`/api/admin/reports/payments`).
**Who:** Dashboard — OWNER/MANAGER; export — per the permission matrix (`FINANCE` resource).
**Full detail:** `docs/rms/phase-a2/04-DASHBOARD-METRICS.md`.

## 8. Settings & user management

**What it does:** property configuration (brand overrides, RMS module switches, payment
gateway settings) and inviting/managing staff accounts. PMS and Tax tabs exist in the UI but
are documented placeholders (Phase F/PMS-future) — they render "nothing to configure yet" and
change nothing (`src/app/admin/settings/tabs/PlaceholderTabs.tsx`).
**Who:** OWNER for most settings; `08-USER-MANAGEMENT.md` for exact per-action roles.
**Routes:** `/admin/settings`.
**Full detail:** `docs/rms/phase-a2/08-USER-MANAGEMENT.md`, `09-SETTINGS.md`,
`10-RUNTIME-SETTINGS.md`, `05-FEATURE-FLAGS.md`.

## 8a. Room service, inventory, purchasing and expenses

- **Room service (Phase C):** menu, orders for checked-in guests, a kitchen board; delivery
  charges the folio. `/admin/room-service`. Detail: `docs/rms/phase-c/01-ROOM-SERVICE.md`.
- **Inventory (Phase D):** one main store; receive, issue, waste; weighted average cost; blind
  stock counts approved by a manager. `/admin/inventory`. Detail: `docs/rms/phase-d/01-INVENTORY.md`.
- **Purchasing (Phase E):** suppliers; purchase orders drafted by the storekeeper and approved by
  a manager, accountant or owner (never their own); goods received against the order post stock
  at the order's price. `/admin/purchasing`. Detail: `docs/rms/phase-e/01-PURCHASING.md`.
- **Expenses (Phase E):** running costs that aren't stock, approved by someone other than whoever
  entered or last changed them; month view by category. `/admin/expenses`. Detail:
  `docs/rms/phase-e/02-EXPENSES.md`.

## 8b. Finance and accounting (Phase F)

- **The books:** double entry in poisha; a starting chart of accounts; balanced, append-only
  journal entries corrected by reversals; manual journals approved by someone else; months closed
  (the OWNER reopens). `/admin/finance`. Detail: `docs/rms/phase-f/01-LEDGER.md`.
- **Automatic postings:** folio, online payments and refunds, stock, approved expenses and cash
  drawer differences post themselves hourly (`/api/cron/ledger-posting`) or on "Post now".
  Detail: `docs/rms/phase-f/02-AUTO-POSTING.md`.
- **Owed to suppliers, petty cash, transfers:** supplier bills against deliveries or other costs,
  supplier payments approved by someone else, petty cash counts, transfers between money
  accounts. `/admin/finance/payables`, `/admin/finance/petty-cash`. Detail:
  `docs/rms/phase-f/03-PAYABLES.md`.
- **Reports:** trial balance, profit and loss, balance sheet, supplier ageing, CSV.
  `/admin/finance/reports`. Detail: `docs/rms/phase-f/05-REPORTS.md`.

## 8c. HR and payroll (Phase G)

- **Staff records:** one per employee, whether or not they sign in; never deleted (marked as left).
  NID and account numbers masked in lists and exports. `/admin/hr/staff`.
- **Attendance and leave:** marked by day (present, absent, half day, day off, leave by type);
  unmarked days are paid; leave taken against the yearly allowance. `/admin/hr/attendance`.
- **Payroll:** one run per month built from salaries and attendance, additions and deductions with
  notes, approved by the OWNER once the month is over (freezing it and the month's attendance),
  marked paid; payslips; salaries post to the books. `/admin/hr/payroll`.
- **Who:** `HR` — OWNER all; MANAGER V C E; HR V C E D X; AUDITOR V X. Detail:
  `docs/rms/phase-g/01-HR-PAYROLL.md`, `02-SCREENS.md`.

## 8d. Audit log (Phase A3)

**What it does:** read-only viewer of every recorded admin action (including each successful
sign-in) and every payment gateway event, with filters and CSV. The audit tables are append-only
in the database (2-year minimum retention).
**Who:** OWNER, AUDITOR. **Route:** `/admin/audit`; CSV `/api/admin/audit/export`.
**Library:** `src/lib/audit/viewer.ts`. **Full detail:** `docs/rms/phase-a3/01-AUDIT-LOG.md`.

## 8e. System health and go-live

**What it does:** one page showing every scheduled job's last success (each job and the nightly
backup write a heartbeat), configuration problems (the `pnpm check:env` checks), the open business
day, the books, and owners without 2FA. **Who:** OWNER, AUDITOR (`SETTINGS.view`).
**Route:** `/admin/system`. **Library:** `src/lib/system/`. **Before each client goes live:**
`docs/GO-LIVE-CHECKLIST.md`. **Detail:** `docs/rms/go-live/01-GO-LIVE.md`.

## 9. Payments (bKash, Nagad, SSLCommerz, BanglaQR)

**What it does:** the four payment gateways guests use to pay for a booking, plus the admin
screens to check status, refund, and (BanglaQR only) manually verify a submitted receipt.
**Who:** per `01-ROLES-AND-PERMISSIONS.md` §5.3 (refunds and manual verification are
MANAGER+/FINANCE-gated).
**Routes:** `/admin/payments/banglaqr-verification`; gateway-specific test-connection/refund
APIs under `/api/admin/payments/`.
**Library:** `src/lib/payments/{bkash,nagad,sslcommerz,banglaqr}/`.
**Full detail:** one doc set per gateway — `docs/PAYMENTS-<NAME>.md` (how it works),
`docs/PAYMENTS-<NAME>-VERIFICATION.md` (what was tested), `docs/PAYMENTS-<NAME>-SECURITY-
REVIEW.md` (findings and fixes). Cross-gateway ops (crontab lines, required env vars):
`docs/DEPLOYMENT.md` §7.2a–d, and the one-command checklist `pnpm check:env`.

## 10. Not yet built (by design, not by omission)

From `module-flags.ts`'s `PLANNED_PHASE`, shown read-only in Settings → Modules so a client
knows what's coming rather than assuming it's missing by accident:

| Module | Target phase |
|---|---|
| — | none: every module in `RMS_MODULE_KEYS` is built |

Also not built: dynamic BanglaQR (real acquiring-bank integration — intentionally disabled
until a bank spec is available, owner decision D2 in `docs/PAYMENTS-BANGLAQR-VERIFICATION.md`),
a real malware scanner for BanglaQR receipts, Sentry/production error tracking
(`src/lib/error-tracking.ts`), VAT (needs the property's registration details), bank statement
reconciliation, clock-in attendance and staff self-service.

---

For the full production-readiness findings across payments, security, SEO and booking
correctness, see `docs/PRODUCTION-READINESS-REPORT.md`.

# Phase A3: the audit log

Branch `phase-a3-audit`, stacked on `phase-g-hr` (Phase G isn't merged yet). The `AUDIT` module, behind the `auditLog` flag, which is on by default. Same rules as every phase: additive migration, no route changes, no new dependencies, fail closed, EN and BN, 360px.

## Defaults applied (2026-10-09)

| Topic | Default |
|---|---|
| Who | `AUDIT`: OWNER all, AUDITOR V X (the matrix, unchanged). Nobody else sees it, MANAGER included (01 §4). |
| What it shows | Two sources: **actions in the admin** (`AuditLog`: everything the RMS records, now including each successful sign-in) and **payment gateway events** (`PaymentAuditLog`, which had no viewer before). |
| Tamper-proof | `AuditLog` becomes append-only in the database, like `PaymentAuditLog`: no UPDATE, no TRUNCATE, and no DELETE of rows younger than 2 years. The one exception is the user link being cleared when a user row is deleted (`ON DELETE SET NULL`), and only if nothing else changes. |
| Sign-ins | Every successful sign-in (after the TOTP step when 2FA is on) writes `SIGNED_IN` with the IP address and device; an impersonated session writes `SIGNED_IN_AS` under the impersonator. Best effort: a failed audit write never blocks sign-in. |

## The viewer (`/admin/audit`)

- **Filters** (in the query string, so a search can be bookmarked or shared):
  - date range in the property's timezone: the last 7 days by default, at most 366 days;
  - module (or gateway);
  - who;
  - action or event (contains, ignoring case);
  - record id (for payments: the payment, booking or correlation id).

  Malformed values are dropped, not trusted. Ids and actions are limited to `[A-Za-z0-9_:.@-]`.
- **Rows:** newest first, 50 a page, with keyset paging (`after=<createdAt>|<id>`), so a busy log never skips or repeats rows. Each row opens to its IP address, device and details: the before/after diff and the metadata, pretty-printed.
- **CSV:** `GET /api/admin/audit/export` (`AUDIT.export`) with the same filters, at most 10,000 rows (it says so in the last line when it stops). Cells that could run as formulas are neutralised. The export itself is audited (`AUDIT_EXPORTED`).
- **Sidebar:** "Audit Logs" (`ScrollText`) after Settings, for `AUDIT.view` while `auditLog` is on.
- **Indexes:** `AuditLog(module, createdAt)` and `PaymentAuditLog(createdAt)`, for the module and date filters.

## Tests

- `src/lib/audit/viewer.test.ts`: filter parsing (defaults, caps, malformed values), query-string round trip, cursor.
- `src/lib/audit/viewer.db.test.ts`: the database refuses UPDATE, TRUNCATE and early DELETE; the user link clears on user delete, and nothing else may change with it; old rows can be deleted. Filters and paging; payment events by gateway and payment id.
- `permission-enforcement.test.ts`: the export × every role.
- **Tests changed because audit rows can no longer be deleted:** `email-test.db.test.ts` (a new owner per test, since the 30-second limit reads that owner's audit rows), and `settings`, `modules`, `accounts` and `migrate-staff-to-front-desk` (no audit cleanup; lookups take the newest row).

## Also fixed

- **Bengali admin shell:** the user-management, sign-out, role and sign-in labels in `adminShell` were still in English. A scan of every Bengali string identical to its English one now finds only intended ones ("English", "RevPAR", a date-and-method template).
- With `auditLog` live, no module is "planned" any more: `PLANNED_PHASE` is empty, and Settings › Modules can switch every module.

## Not in A3

- Failed sign-in attempts aren't audited (only successes). The go-live work adds rate limits on sign-in.
- No alerts on suspicious patterns. Use the CSV for that.

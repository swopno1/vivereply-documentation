# Phase G §2: HR screens

Everything under `/admin/hr`, behind `moduleGate("hr")`. The payroll pages also need `moduleGate("payroll")`. Every page calls `requirePermission("HR", …)`. Strings are in `adminHr` in `src/content/en.ts` and `bn.ts`. Checked at 360px: no sideways scroll, and every tap target is at least 44px.

| Route | What it shows | Who can act |
|---|---|---|
| `/admin/hr` | Staff working by department and the monthly salary total, how many are marked today, the last two payroll runs | — |
| `/admin/hr/staff` | Everyone, with search and a "show staff who left" switch; CSV | Add: `HR.create`; CSV: `HR.export` |
| `/admin/hr/staff/new` | The employee form. The login picker appears only for someone with `USERS.view` (the OWNER). | `HR.create` |
| `/admin/hr/staff/[id]` | Details (the NID and account number in full, here only), leave this year against the allowance, this month's attendance, payslips | Edit and mark as left: `HR.edit` |
| `/admin/hr/attendance?date=` | One card per person working that day: status buttons (present, absent, half day, day off, leave, not marked), the leave type, a note. "Mark the rest present", and a save bar fixed to the bottom on a phone. Only changed rows are sent. Read-only once the month's payroll is approved. | `HR.create` |
| `/admin/hr/attendance/month?month=` | Counts per person up to the business date: cards on a phone, a table from `sm` up; CSV with one column per day | CSV: `HR.export` |
| `/admin/hr/payroll` | Runs, newest first; build a month (suggests last month until its run exists) | `HR.create` |
| `/admin/hr/payroll/[id]` | Totals, what to pay by each method, notes for each status; one card per line with the pay calculation, additions and deductions, and a warning for unmarked days | Rebuild `HR.create`; additions/deductions and paid `HR.edit`; discard `HR.delete`; approve `HR.approve`, enabled from the month's last day |
| `/admin/hr/payroll/[id]/payslip/[lineId]` | A printable payslip: property name, the employee, the calculation, net pay, how and when it was paid (account masked), attendance, a "received by" line. Black and white under `@media print`. | — |
| `GET /api/admin/hr/export?type=staff\|attendance\|payroll` | CSV with a UTF-8 BOM; cells that could run as formulas are neutralised; audited (`HR_EXPORTED`) | `HR.export` |

**Sidebar:** "HR" (`IdCard` icon) after Finance, for `HR.view` while the `hr` module is on. The HR role now lands on `/admin/hr` instead of the welcome page. `01-ROLES-AND-PERMISSIONS.md` §6 and `permissions.test.ts` are updated together.

**Settings › Modules:** `hr` and `payroll` are now switchable (`LIVE_MODULES`). `auditLog` is the only module still planned.

## Fixes made during the live check

| # | Problem | Fix |
|---|---|---|
| G-1 | **The theme had no `primary-foreground` colour,** so `text-primary-foreground` did nothing and text on teal kept the dark body colour. This affected 17 files built before Phase G: the active tab in the finance, expenses and purchasing sub-menus, the language switcher, the Settings › Modules switches, and the public Destinations banner and area-guide map pins. | `--color-primary-foreground: #FFFFFF` in `src/styles/theme.css`: white on teal, as every one of those uses intended. |
| G-2 | Date pickers stretched to full width: `w-auto` lost to the input's `w-full`. | The class is replaced, not appended. |
| G-3 | **Bengali:** "Cash" and the Nagad wallet were both "নগদ", so "নগদ-এ দিতে হবে" was ambiguous. | Cash is "হাতে নগদ" (cash in hand) in the HR screens. |

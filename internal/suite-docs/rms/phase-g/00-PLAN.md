# Phase G: HR and payroll

Branch `phase-g-hr`, from `main` at `5cca3f9` (Phase F merged).

The `HR` module behind the `hr` and `payroll` flags (Phase G in `01-ROLES-AND-PERMISSIONS.md`).

The Phase A2–F rules still apply:
- Additive migrations only.
- No route path changes.
- No new runtime dependencies.
- Fail closed, and audit every write.
- Every screen in EN and BN, working at 360px.
- One commit per section.
- `pnpm lint` and `pnpm build` before each commit.

The payment code is not touched.

## Defaults applied (2026-10-09)

The owner asked to "continue and finish the RMS for production" without further choices. These are the recommended defaults for a small Bangladeshi resort, in line with earlier phases. Each is easy to change.

| Topic | Default |
|---|---|
| Staff records | **One record per employee,** separate from logins: many staff (cleaners, guards, gardeners) never sign in. A record can be linked to one login. Code `EMP-0001`, department, designation, join date, type (permanent, probation, contract), monthly salary, how they are paid (cash, bank, bKash, Nagad) and the account number, phone, NID, emergency contact. **Never deleted:** someone who leaves is marked "left" with a date and reason. |
| Who sees what | `HR`: OWNER all; MANAGER V C E; HR V C E D X; AUDITOR V X (no matrix change). Salaries and NIDs are visible to whoever has `HR.view`; NIDs and account numbers are masked in lists and shown in full only on the record. |
| Attendance | **Marked by day** for every active employee: present, absent, half day, day off, or leave (casual, sick, annual, unpaid). Unmarked days count as present for payroll, so a forgotten day never docks pay; the attendance screen shows how many are unmarked. No clock-in, no duty roster. |
| Leave | Recorded on the attendance sheet (a day of leave of a type). The yearly allowance per type is shown against what was taken (defaults from the Bangladesh Labour Act: casual 10, sick 14, annual 1 day per 18 days worked); going over warns but doesn't block, because the record is of what happened. No leave requests or approvals. |
| Payroll | **One run per month.** HR (or a manager) builds it from the staff records and that month's attendance: monthly salary, less unpaid days (absent, unpaid leave, half days, days before joining or after leaving) at salary ÷ days in the month, plus additions (overtime, festival bonus) and less other deductions (advance recovered, tax withheld), each with a note. The run can be rebuilt while it is a draft. **Approved by the OWNER only** (`HR.approve`); approval freezes it and that month's attendance. **Marked paid** with a date once the money has gone out. |
| Payslips | One printable payslip per employee per run, in English or Bengali. |
| Books | When the books are kept (Phase F), payroll posts itself like everything else, once each. **On approval:** salaries expense (gross) against salaries payable (net) and "salary deductions held" (other deductions). **On payment:** salaries payable against the money accounts by each employee's payment method (cash from petty cash, as with cash expenses). Three accounts are added by the migration. |
| Festival bonus, provident fund, tax | An addition or a deduction on that month's run, with a note. No automatic rules: they depend on each employer's policy and the employee's tax position. |

## Permissions (no matrix change)

| Action | Grant |
|---|---|
| See staff, attendance and payroll | `HR.view` |
| Add staff, mark attendance, build a payroll run | `HR.create` (OWNER, MANAGER, HR) |
| Change a staff record, mark someone as left, change a draft run's additions and deductions, mark a run paid | `HR.edit` (OWNER, MANAGER, HR) |
| Discard a draft run | `HR.delete` (OWNER, HR) |
| Approve a run | `HR.approve` (OWNER) |
| CSV export | `HR.export` (OWNER, HR, AUDITOR) |

**Flags:**
- **`hr`:** staff records and attendance.
- **`payroll`:** payroll runs and payslips. It needs `hr` on too.

Both become live but stay **off by default** in this template, as the brief's `brand.config.ts` block has them. The sidebar gains "HR" (`HR.view`, `hr` flag), so the HR role finally has a landing page.

## Sections

- **§1 Staff, attendance and payroll.** Migration (staff records, attendance, payroll runs and lines, three accounts), the pay calculation, actions, posting payroll to the books; tests.
- **§2 Screens.** HR home, staff list and record, attendance by day and by month, payroll runs and payslips; CSV export; sidebar.
- **§3 Verification report.**

## Not in Phase G

- Clock-in or biometric attendance, duty rosters and shift swaps.
- Leave requests and approvals by staff themselves (there is no staff self-service).
- Automatic tax (TDS), provident fund or gratuity calculations.
- Loans and salary advances as their own records (recover an advance as a deduction with a note).
- Bank salary-transfer files.

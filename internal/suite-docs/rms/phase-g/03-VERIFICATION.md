# Phase G §3: verification report

Branch `phase-g-hr`, from `main` at `5cca3f9` (Phase F merged).

| § | Commit | What |
|---|---|---|
| 1 | `affccdb` | Staff records, attendance, payroll runs and lines, the pay calculation, payroll in the books; plan (00-PLAN.md) |
| 2 | `6aa8e53` | HR screens, payslips, CSV export, sidebar; theme `primary-foreground` fix |
| 3 | this commit | Verification report, RMS index |

## Summary

- **Staff records:** one per employee, with or without a login; numbered `EMP-0001`; never deleted (marked as left); edits refused if someone else saved in between; NID and account numbers kept out of the audit trail and masked in lists, exports and payslips.
- **Attendance:** by day; unmarked days are paid; leave by type against the yearly allowance; frozen once the month's payroll is approved (in the action and in the database).
- **Payroll:** one run per month from salaries and attendance (half-day precision, joiners and leavers pro rata), additions and deductions with notes, discard and rebuild while a draft, OWNER approval once the month is over and only if the run is still up to date, then paid. Payslips in English or Bengali, printable.
- **In the books:** accrued at the month's end (salaries against salaries payable and deductions held), paid by each employee's payment method; three accounts added.
- **Permission matrix:** unchanged. The sidebar gains "HR"; the HR role lands on `/admin/hr`.
- **Module flags:** `hr` and `payroll` are live, both off by default in this template (the brief's values). Payroll needs HR.
- **Migration:** one, additive: `20261014100000_hr`. It applies cleanly to a fresh `resort_test` and to `resort_dev`, with no drift. The payment code is untouched.

## Gates (at the final commit)

| Gate | Result |
|---|---|
| `pnpm lint` (ESLint, guard scripts, money check) | 0 problems; `hr-actions.ts` passes the guard check |
| `pnpm test` | 794 passed (637 DB tests skipped without a `*_test` DB) |
| Full suite on a fresh, migrated `resort_test` | 1,430 passed, 1 skipped (the migrations check), including the four gateway suites |
| `pnpm test:db` | 356 passed, three times in a row |
| Drift (`prisma migrate diff`) | No difference |
| `pnpm build` | Clean. New dynamic routes: `/admin/hr` with `staff`, `staff/new`, `staff/[id]`, `attendance`, `attendance/month`, `payroll`, `payroll/[id]`, `payroll/[id]/payslip/[lineId]`; `/api/admin/hr/export` |

**New test files:** `hr/constants.test.ts` (6), `hr/hr.db.test.ts` (3, covering about 70 assertions). **Updated:** `permission-enforcement.test.ts` (10 HR paths × every role), `permissions.test.ts` (sidebar, landing), `modules.db.test.ts` (the "not built" example is now the audit log), `ledger.db.test.ts` (33 system accounts), `payables.db.test.ts` (petty cash as at the count date).

## Live check (production build, scratch DB, 360px)

**Data:** four staff (bank, bKash and two cash), one joining on 16 September; September attendance with an absence, a half day, a sick day and two days of unpaid leave; books started 1 September.

| As | Checked |
|---|---|
| HR (English) | **Lands on `/admin/hr`:** 4 working, ৳74,000 a month, "Marked 0 of 4". **Attendance today:** "Mark the rest present", Shirin on sick leave with a note, Rafiq a half day: "Saved: 4 changed." **Payroll:** built September (`PAY-202609-1`); every line matches the hand calculation (Karim ৳24,166.67 after one absence plus a ৳2,500 festival bonus; Shirin ৳7,500 for 15 of 30 days; Jamal ৳21,633.33 for a half day; Rafiq ৳11,200 after two unpaid days); gross ৳67,000; to pay by bank ৳26,666.67, bKash ৳7,500, cash ৳32,833.33. No approve button for HR. **After approval:** September's attendance shows the frozen note with every button disabled. Staff list, record, month view and form: no overflow, no tap target under 44px. |
| OWNER | **Approve without 2FA:** sent to the 2FA setup (fail closed). Set up 2FA through the real flow (setup key → TOTP), then approved: "Approved by Test Owner on Oct 9, 2026. Attendance for this month is frozen." |
| MANAGER (Bengali) | Marked the run paid on 5 Oct ("৫ অক্টো, ২০২৬ তারিখে পরিশোধিত।"). Payslip in Bengali: the calculation, net ২৬,৬৬৬.৬৭৳, the bank account masked (••••••••7890), the attendance line and a signature line; no overflow. |
| ACCOUNTANT | "Records waiting to be posted: 2", then "Entries posted: 2": `JE-202609-00001` (30 Sep, salaries ৳67,000) and `JE-202610-00001` (5 Oct, paid). `/admin/hr` is refused (403): ACCOUNTANT has no HR access. |
| AUDITOR / FRONT_DESK | AUDITOR: the staff CSV downloads (200) and there is no "Add employee". FRONT_DESK: the CSV is refused (403). |

## Found and fixed during Phase G

| # | Problem | Fix |
|---|---|---|
| G-1 | **Theme (affected earlier phases and the public site):** `text-primary-foreground` was used in 17 files but never defined, so text on teal stayed dark grey: the active sub-menu tab (finance, expenses, purchasing, HR), the language switcher, the module switches, the public Destinations banner and the area-guide map pins. | `--color-primary-foreground: #FFFFFF` in the theme. |
| G-2 | **Petty cash count:** compared the box with every entry ever posted, including any dated after the count. | Compares with the books up to the count date. No effect in production (nothing is dated after the business date), but it is the right rule. |
| G-3 | Date pickers stretched to full width. | The width class is replaced, not appended. |
| G-4 | **Bengali:** cash and the Nagad wallet were both "নগদ". | Cash is "হাতে নগদ" in the HR screens. |

## Limitations and follow-ups

| # | Limitation |
|---|---|
| L1 | **No clock-in, duty roster or shift swaps.** Attendance is marked by day by HR or a manager. |
| L2 | **No leave requests or staff self-service.** Leave is recorded on the attendance sheet; going over the allowance warns but doesn't block. |
| L3 | **No automatic tax (TDS), provident fund or gratuity.** Enter them as deductions or additions with a note; "salary deductions held" is cleared by the accountant with a manual journal. |
| L4 | **An approved run is final.** A mistake found after approval is corrected on the next month's run (an addition or a deduction with a note). |
| L5 | **Salary changes take effect for the whole month** the run is built for; there is no mid-month salary history. |
| L6 | **Salary advances** are not their own records: pay one as an expense or a transfer and recover it as a deduction. |
| L7 | **Payroll before the books' start date** isn't accrued; paying it after the start leaves salaries payable negative until an opening balance covers it. |
| L8 | **No bank salary-transfer file.** The run shows the total to pay by each method, and the CSV lists each account. |

## Not merged

`main` is unchanged. Phase G is on `phase-g-hr` for the owner's review.

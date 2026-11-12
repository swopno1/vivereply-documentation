# Phase G §1: staff, attendance and payroll

Migration `20261014100000_hr`, `src/lib/hr/constants.ts`, `src/app/actions/hr-actions.ts`, payroll postings in `src/lib/ledger/auto.ts`. Defaults and permissions: `00-PLAN.md`.

## Staff records (`Employee`)

- **One row per employee,** whether or not they sign in. Code `EMP-0001` from the `employee` sequence.
- **Checked:** department, type and payment method from fixed lists. A bank, bKash or Nagad payment needs an account number. The NID is 10–17 digits; the phone is digits. The join date is no later than the business date. Salary is ৳0 to ৳1 crore a month.
- **Login link:** `userId` is unique, so a login belongs to one employee at most. Only someone with `USERS.view` (the OWNER) can set or change it. For anyone else the link is ignored on create and kept as it was on edit, because HR can't see the user list (01 §8).
- **Edits** carry the `updatedAt` the editor loaded. If someone else saved in between, the edit is refused (`stale`), not overwritten. The audit row has a before/after diff of the changed fields. The NID and account number show only as "(set)", so they never reach the audit log.
- **Leaving:** `markEmployeeLeftAction` sets `LEFT`, the last day and a reason. It is refused if attendance is already marked after that day. The login is not touched (deactivating it is the OWNER's job in Settings › Users).
- **Never deleted:** a trigger refuses deletes. A check constraint ties `LEFT` to having a last day.

## Attendance (`AttendanceDay`)

- **One row per employee per day:** present, absent, half day, day off, or leave of a type (casual, sick, annual, unpaid). The leave type is required exactly when the status is leave (check constraint).
- **`recordAttendanceAction`** marks one date for up to 500 people:
  - only dates up to the business date;
  - only people employed that day (`not_employed` names the first one who wasn't);
  - `UNMARKED` deletes the row.
  - One audit row per save lists each change (`EMP-0003: ABSENT → PRESENT`). Unchanged entries are skipped.
- **Unmarked days are paid.** A forgotten mark never docks pay. The screens show how many days are unmarked.
- **Frozen once the month's payroll is approved:** the action refuses (`month_frozen`), and so does the `AttendanceDay_frozen` trigger for any insert, update or delete. Saving attendance and approving payroll take the same per-month advisory lock, so the two can't cross.

## The pay calculation (`calculatePay`, pure)

The monthly salary less unpaid time, at salary ÷ days in the month, rounded to the poisha. Time is counted in half days so a half day is exact.

| Day | Paid? |
|---|---|
| Present, day off, casual / sick / annual leave, unmarked | Yes |
| Half day | Half |
| Absent, unpaid leave | No |
| Before the join date or after the last day | No |

Example: ৳30,000 in a 30-day month with one absence, one day of unpaid leave and one half day is ৳30,000 × 55 ⁄ 60 = ৳27,500.

## Payroll runs (`PayrollRun`, `PayrollLine`)

| Step | Who | What happens |
|---|---|---|
| Build | `HR.create` | For the business month or an earlier one. One line per person employed at any time that month, with a snapshot of their salary, payment details and the month's attendance summary. Number `PAY-202610-1`. **Rebuilding** a draft recomputes every line but keeps the additions, deductions and notes already entered (a deduction larger than the new pay is capped, and its note says so). |
| Additions and deductions | `HR.edit` | Per line, each with a note: overtime or a festival bonus; an advance recovered or tax withheld. The net pay can't go below zero (`negative_net`). |
| Discard | `HR.delete` | A draft only, with a reason. It stays on record as `VOID`, and the month can be built again (the next number, `-2`). |
| Approve | `HR.approve` (OWNER) | Only once the month is over (business date on or after its last day). Never by whoever built or last changed the run (the OWNER excepted). **Refused as `out_of_date`** if building it now would give different people, pay or payment details (someone joined, a salary changed, attendance was corrected): rebuild first. Freezes the run and the month's attendance. |
| Paid | `HR.edit` | The date the salaries went out: from the month's first day to the business date. |

**The database enforces it as well:**
- one live run per month (`liveMonth` is unique and empty only when void);
- lines change only while their run is a draft;
- an approved run can only become paid, with nothing else changing;
- paid and void runs are final;
- runs are never deleted;
- the net pay is earned + additions − deductions and never negative (check constraint).

## In the books

When the books are kept (Phase F, a start date set), the hourly sweep picks payroll up like every other source, once each:

| Source key | Date | Debit | Credit |
|---|---|---|---|
| `payroll:<run>` (approved or paid) | Last day of the month | Salaries and wages (6100): gross | Salaries payable (2100): net · Salary deductions held (2110): deductions |
| `payroll-paid:<run>` | The paid date | Salaries payable: net | Petty cash (cash), bank, mobile wallet (bKash, Nagad): by each line's method |

- The migration adds the three accounts. If the accountant had already used one of the codes, the next free code is taken. The system key is what postings use.
- A run with nothing to pay posts nothing.
- A run whose month ends before the books' start date isn't accrued. If it is paid after the start date, salaries payable goes negative by that amount until an opening balance or a manual journal covers it (as with bills from before the start, Phase F L3).
- "Salary deductions held" is cleared by the accountant with a manual journal when the tax is deposited, or against the advance it recovers.

**Fix found while testing:** the petty cash count compared the box with every entry ever posted. It now compares with the books up to the count date (`submitPettyCashCountAction`). Nothing in production is dated after the business date, so this changes nothing there, but test data dated in the future had exposed it.

## Tests

- `src/lib/hr/constants.test.ts`: the pay calculation (paid and unpaid days, joiners and leavers, rounding) and the two posting shapes.
- `src/lib/hr/hr.db.test.ts`, against a real database: staff records (numbering, idempotency, checks, stale edits, the masked audit diff, linking a login, no deletes), attendance (dates, employment, clearing, audit) and a full payroll month (build, discard, rebuild keeping additions, notes, the net floor, approval rules, `out_of_date`, freezing in the action and the database, payment, both journal entries, posting once). Each run uses its own random month far in the future, so runs on a shared test database never meet.
- `permission-enforcement.test.ts`: the nine HR actions × every role.

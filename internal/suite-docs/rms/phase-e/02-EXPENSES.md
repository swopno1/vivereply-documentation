# Phase E §2 and §4: expenses

Defaults (00-PLAN.md):
- running costs that aren't stock (electricity, fuel, repairs, transport and so on);
- every expense is approved by someone other than whoever entered or last changed it (the OWNER excepted);
- not paid from a front-desk cash drawer, which holds guest money only (Phase B2).

## 1. Data and rules

Migration `20261012110000_expenses` (additive):

| Field | What | Integrity |
|---|---|---|
| `expenseNumber` | `EX-YYYYMM-NNNN`: the business month it was entered and a monthly `Sequence` | Unique; format checked. |
| `expenseDate` | When the money was spent | A real date, no later than the business date it is entered on and at most 366 days before it. |
| `category` | UTILITIES, FUEL, REPAIRS, TRANSPORT, SUPPLIES, MARKETING, STAFF_WELFARE, FEES_TAXES, BANK_CHARGES, OTHER | Check. |
| `description` | What it was for | 3 to 300 characters (check). |
| `amountPoisha` | Amount | ৳0.01 to ৳1 crore (check). |
| `paymentMethod` | CASH, BANK, BKASH, NAGAD, CARD, CHEQUE | Check. |
| `payee`, `supplierId`, `reference` | Who was paid (free text, or a supplier from the supplier list), and the bill, voucher or transaction number | Optional. An archived supplier can't be named. |
| `status` | SUBMITTED, then APPROVED or REJECTED | **Reviewed fields** are set exactly when the expense is no longer submitted, and a rejection always has a reason (check). **Final once reviewed:** who entered it and when never change, and rows are never deleted (`Expense_guard` trigger). |
| `submittedBy`, `updatedBy`, `reviewedBy` | Who entered it, who last changed it, who reviewed it | |

### Who does what

No matrix change. The `EXPENSE` row grants: OWNER all; MANAGER V C E A; ACCOUNTANT V C E A X; AUDITOR V X.

| Action | Grant |
|---|---|
| `submitExpenseAction` | `EXPENSE.create` (MANAGER, ACCOUNTANT, OWNER) |
| `updateExpenseAction` (while it waits) | `EXPENSE.edit` |
| `reviewExpenseAction` (approve, or reject with a reason) | `EXPENSE.approve`, never one you entered or last changed (`own_expense`), unless you are the OWNER |
| CSV export | `EXPENSE.export` (ACCOUNTANT, OWNER, AUDITOR) |

The usual pair is the accountant entering and a manager approving, or the other way round. A manager who corrects the accountant's amount can't then approve it; the owner does.

Every action is audited: `EXPENSE_SUBMITTED`, `EXPENSE_UPDATED` (before and after), `EXPENSE_APPROVED` and `EXPENSE_REJECTED`. A double submit records one expense (idempotency key).

### Not in this section

- **Payment:** nothing is posted to a cash drawer, bank or ledger. Petty cash, bank accounts and journal postings are Phase F.
- **Receipts:** no photo or file of the bill (the reference field carries its number).
- **Budgets:** no budgets or recurring expenses.

## Tests

**`src/lib/expenses/expenses.db.test.ts`:**
- **Entering:**
  - the accountant and a manager enter expenses, numbered by month;
  - a double submit records one;
  - a future date, a date over a year back, a short description, a zero, fractional or oversize amount, an unknown category and an unknown supplier are refused;
  - the storekeeper and the auditor can't enter;
  - a supplier can be named.
- **Review:**
  - the accountant can't approve their own;
  - the manager who corrected it can't either;
  - the OWNER approves;
  - a reviewed expense can't be reviewed again or edited;
  - a rejection needs a reason;
  - the auditor can't review;
  - the OWNER may approve their own;
  - the audit trail lists every step.
- **Database:** a rejection without a reason, changing who entered it, changing a reviewed expense and deleting are refused by the database itself.

**`src/lib/expenses/constants.test.ts`:** expense numbers and month ranges.

**`permission-enforcement.test.ts`:** 3 new actions × every role.

## 2. Screens

| Page | Who | What |
|---|---|---|
| `/admin/expenses` | `EXPENSE.view` | **Waiting for approval:** every expense still waiting, any month, oldest first, highlighted with a count. **Month view** (`?month=YYYY-MM`, default the business month): previous and next month (not past the current one), the approved total and the waiting total, approved totals by category (largest first), then the month's expenses by date. Rejected amounts are struck through. **Buttons:** "New expense" (`create`), "Export month (CSV)" (`export`). |
| `/admin/expenses/new` | `EXPENSE.create` | **Fields:** date (up to the business date), amount, category, paid by, what it was for, paid to, supplier (optional, from the supplier list), and the bill or transaction number. A cash expense reminds that expenses don't come from a front-desk drawer. The form's idempotency key covers a double click. |
| `/admin/expenses/[id]` | `EXPENSE.view` | **Details:** amount, status, number, description, category, date and method, payee or supplier, reference; who entered it, who last changed it if someone else did, and the review with its note. **Edit** in place while waiting (`edit`). **Approve, or reject with a required note** (`approve`, never your own; the person who entered or changed it sees why they can't). |
| `GET /api/admin/expenses/export?month=YYYY-MM` | `EXPENSE.export` | **CSV:** every expense dated in the month, any status: number, date, category, description, amount, method, payee, supplier, reference, status, who entered and reviewed it, and the note. Formula-safe cells, UTF-8 BOM, audited (`EXPENSES_EXPORTED`). |

**Sidebar:** "Expenses" (`EXPENSE.view` plus the `expenses` flag), after Purchasing.
- **Who sees it:** OWNER, MANAGER, ACCOUNTANT and AUDITOR.
- **Landing pages:** unchanged.
- **Docs:** `01-ROLES-AND-PERMISSIONS.md` §6 is updated.

**Module flag:** `expenses` is live and on by default.

**Daily sheet:** the owner summary adds "Expenses awaiting approval" while the module is on.

### Live check (production build, scratch DB, 360px)

| As | Checked |
|---|---|
| ACCOUNTANT (English) | **Sidebar:** Dashboard, Inventory, Purchasing, Expenses, Bookings. **Entered:**<br>• ৳12,450.50, electricity, bKash, Palli Bidyut Samity, ref TRX-8812AB (`EX-202610-0001`);<br>• ৳3,200 of generator diesel in cash, which showed the cash-drawer note.<br>**Own expense:** shows "You entered or last changed this expense, so someone else approves it." and no approve button. **Export:** both rows, with "Test Manager" as reviewer of the first. No overflow; every tap target ≥ 44px. |
| MANAGER (Bengali) | **Approval:** approved the electricity bill. **List:** অনুমোদনের অপেক্ষায় (১) with the diesel; অক্টোবর ২০২৬: অনুমোদিত ১২,৪৫০.৫০৳, অপেক্ষায় ৩,২০০৳; by category ইউটিলিটি (বিদ্যুৎ, গ্যাস, পানি) ১২,৪৫০.৫০৳. **Daily sheet:** "অনুমোদনের অপেক্ষায় ক্রয় আদেশ ০" and "অনুমোদনের অপেক্ষায় খরচ ১". No overflow; no tap target under 44px. |

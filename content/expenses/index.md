# Expenses — Staff Training Module

**Page:** `/admin/expenses` — running costs that aren't stock.
**Audience:** staff entering expenses (primary), managers (approval).
**Time to complete:** about 20 minutes.
**Prerequisite:** none.

## Learning objectives

After this module you can:

- Explain what belongs in expenses (and what doesn't).
- Read the month view: approved, waiting, by category.
- Work the approval queue correctly — including the separation rule.

## 1. What expenses are

*"Running costs that aren't stock: bills, fuel, repairs, transport."*
Electricity bill, generator diesel, a plumber's visit, staff transport —
anything the property spends that isn't buying stock and isn't a guest
charge. Stock lives in Inventory; guest charges live on folios; everything
else cash-out lives here.

**Critical boundary:** *"Expenses are not taken from a front-desk cash
drawer."* An expense is a recorded, approved cost — it never debits your
cash shift. If you paid cash out of pocket, record the expense with method
Cash; the drawer is untouched.

## 2. The page layout

**Waiting for approval** comes first — every SUBMITTED expense across all
time, oldest first. This is the manager's queue; as a submitter, this is
where you watch yours.

Then **one month at a time** (`?month=YYYY-MM`, defaulting to the business
month), with a previous/next navigator:

- **Approved \{amount}** — what this month cost, approved.
- **Waiting \{amount}** — submitted but not yet approved (in amber).
- **Approved by category** — where the money went: Utilities, Fuel and
  generator, Repairs and maintenance, Transport, Office and small supplies,
  Marketing, Staff welfare, Fees/licences/taxes, Bank and mobile-money
  charges, Other.
- **Expenses this month** — the full list, newest first; rejected ones
  struck through.

**Export month (CSV)** downloads the month for the accountant (export
permission).

## 3. The approval workflow

Every expense is **approved by someone else** — the system's core rule:

| Status | Meaning |
|---|---|
| **Waiting** (Submitted) | Entered, awaiting a manager |
| **Approved** | Accepted into the books |
| **Rejected** | Sent back, struck through |

Open an expense to see its full record: date, method, paid-to, reference,
who entered it and when, who last changed it, and the review line.

- **Approve / Reject** (manager). Rejecting **requires a note** — the
  submitter needs to know what to fix.
- **You cannot approve your own.** *"You entered or last changed this
  expense, so someone else approves it."* If you entered it, the approve
  button isn't yours — find another manager or the owner.

Expenses awaiting approval also surface in the **daily sheet's owner
summary** — they don't sit invisible.

## 4. Reading the numbers

**Approved by category** is the management view: which cost lines are
growing month over month. Fuel creeping up? Generator hours or a price
rise — ask. Repairs spiking? A maintenance problem hiding as expenses.
Use it in the monthly review, not just at year-end.

## 5. Troubleshooting

| Symptom | Check first |
|---|---|
| Can't approve an expense | You entered or last changed it — someone else must approve. |
| Expense missing from the month | Check the month navigator — it may be in a different month, or still in the approval queue. |
| "Not taken from a cash drawer" | Correct — expenses never touch cash shifts. Record the payment method instead. |
| Rejected expense | Read the reviewer's note, fix, and resubmit — don't re-enter as new. |

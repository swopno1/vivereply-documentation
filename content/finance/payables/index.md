# Payables — Staff Training Module

**Page:** `/admin/finance/payables` — what the property owes suppliers.
**Audience:** accountants, managers, owners.
**Time to complete:** about 15 minutes.
**Prerequisite:** the [Finance](..) module.

## Learning objectives

After this module you can track supplier bills, pay them, and read who is
owed what.

## 1. What the page is

Three views: **suppliers owed** (ranked by balance, largest first),
**open bills** (due-date order, overdue highlighted), **payments waiting**
(SUBMITTED, oldest first), and recent payments.

## 2. Bills

A supplier bill (`/admin/finance/payables/bills/new`): supplier, bill
number, supplier reference, dates, lines, amounts. Status OPEN until fully
paid. **Overdue bills** (due date past, still open) are the red flag —
they age into the ageing report and strain supplier relationships.

## 3. Payments

Paying a bill (`/admin/finance/payables/payments/new`): which bill(s), how
much, from which money account, the reference. Enters as SUBMITTED —
**a payment needs approval before it's real**, same separation-of-duties
pattern as everywhere else in this system.

## 4. Reading the balances

The supplier list is the payables truth: who is owed, how much, ranked.
The finance overview's "Owed to suppliers" and "Overdue" read from here.
Pay oldest-overdue first as a rule — unless the manager says otherwise for
a strategic supplier.

## 5. Troubleshooting

| Symptom | Check first |
|---|---|
| Bill won't close | It's only partly paid — the open balance keeps it OPEN. |
| Payment stuck waiting | Needs approval from someone other than the creator. |
| Supplier balance looks wrong | Check for unapproved payments and unposted bills. |

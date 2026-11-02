# Payables — Staff Training Module

**Page:** `/admin/finance/payables` — what the property owes suppliers.
**Audience:** accountants, managers, owners.
**Time to complete:** about 15 minutes.
**Prerequisite:** the [Finance](..) module.

## Learning objectives

After this module you can track supplier bills, pay them, and read who is
owed what.

## 1. What the page is

Four views: **suppliers owed** (ranked by balance, largest first),
**open bills** (due-date order, overdue highlighted), **payments waiting**
(SUBMITTED, oldest first), and recent payments.

## 2. Bills

A supplier bill (`/admin/finance/payables/bills/new`): supplier,
supplier reference, dates, note, lines, amounts. The bill number
(`BILL-YYYYMM-NNNN`) is assigned by the system — you never type it.
Status stays OPEN even when fully paid (the only other status is VOID):
paid bills simply drop off the open-bills list. **Overdue bills** (due
date past, still open) are the red flag —
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
| Bill still listed | It's only partly paid — bills leave the list once the open balance hits zero. |
| Payment stuck waiting | Needs approval from someone other than the creator. |
| Supplier balance looks wrong | Check for unapproved payments and unposted bills. |

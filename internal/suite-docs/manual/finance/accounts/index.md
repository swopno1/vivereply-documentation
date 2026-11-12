# Chart of Accounts — Staff Training Module

**Page:** `/admin/finance/accounts` — every ledger account.
**Audience:** accountants, owners.
**Time to complete:** about 10 minutes.
**Prerequisite:** the [Finance](..) module.

## Learning objectives

After this module you can read the chart of accounts and know what the
system accounts are.

## 1. What the page is

Every ledger account: code, name (English + Bengali), type
(Asset/Liability/Equity/Income/Expense), and balance. Money accounts
(cash drawers, bank, mobile-money, petty cash) carry the `isMoney` flag —
they're the ones the finance overview totals.

## 2. System accounts

A few accounts are structural — the system posts to them automatically:

- **GUEST_RECEIVABLE** — what guests owe (folio balances not yet
  collected); the overview's "Guests owe".
- **ACCOUNTS_PAYABLE** — what the property owes suppliers; the overview's
  "Owed to suppliers".
- **PETTY_CASH** — the petty tin.

Don't repurpose system accounts for manual entries — that's what manual
journals with proper accounts are for.

## 3. Troubleshooting

| Symptom | Check first |
|---|---|
| Account missing | It may be archived — archived accounts keep history but leave the list. |
| Balance looks wrong | Drill into the account's journal lines; check for unposted entries. |

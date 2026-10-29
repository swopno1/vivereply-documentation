# Finance — Staff Training Module

**Page:** `/admin/finance` — the books.
**Audience:** owners, accountants, managers.
**Time to complete:** about 25 minutes.
**Prerequisite:** none. This module is about money truth, not daily
operations.

## Learning objectives

After this module you can:

- Explain what the finance module is: the double-entry books behind every
  operational screen.
- Read the overview: money, what guests owe, what the property owes, what
  waits.
- Start the books correctly — and know why the start date matters.
- Know which sub-page does what.

## 1. What finance is

*"The books: money, what guests and suppliers owe, and every entry."*
Everything the resort records — a folio charge, a supplier bill, a cash
count — **posts itself as journal entries** from the books' start date.
Finance is where those entries live, reconcile, and report.

**This is not the dashboard.** The dashboard shows operational summaries
(revenue today, occupancy). Finance shows the *accounting* truth:
debits, credits, balances, and whether they reconcile.

## 2. Starting the books

Before anything else: **choose the first business date the books cover**
(`ledgerStartDate`). Everything the resort records from that date posts
itself. Enter **opening balances as a journal dated on that day**.

**Why the date matters:** postings before the start date don't exist in
the books. Pick the date deliberately (usually the first day of a month),
enter opening balances carefully, and never move it afterwards without the
accountant.

## 3. The overview

- **Money** — every money account (cash drawers, bank, bKash/Nagad
  merchant accounts, petty cash) with its balance.
- **Guests owe** — the guest-receivable balance: folio balances not yet
  collected.
- **Owed to suppliers** — accounts payable, with **overdue** highlighted
  in red.
- **Waiting for approval** — the queues: manual journals, supplier
  payments, petty cash counts, and **BanglaQR verifications** (the
  verification queue now lives here — see [its page](banglaqr-verification/)).
- **Records waiting to be posted** — auto-postings not yet in the books,
  with **Post now**.

## 4. The sub-pages

| Page | Docs | What it's for |
|---|---|---|
| `/admin/finance/accounts` | [Chart of Accounts](accounts/) | Every ledger account and its balance |
| `/admin/finance/journals` | [Journals](journals/) | Every entry; manual journals waiting |
| `/admin/finance/payables` | [Payables](payables/) | Supplier bills and payments |
| `/admin/finance/petty-cash` | [Petty Cash](petty-cash/) | The petty tin: counts and transfers |
| `/admin/finance/months` | [Months](months/) | Closing the month's books |
| `/admin/finance/reports` | [Reports](reports/) | Trial balance, P&L, balance sheet, ageing |
| `/admin/payments/banglaqr-verification` | [BanglaQR Verification](banglaqr-verification/) | Guest payments waiting for a human check |

## 5. Permissions

Viewing needs FINANCE.view. Creating (journals, bills, payments, counts)
needs create. **Approving** differences and journals needs approve.
**Closing months** needs approve; **reopening** needs edit (owner).
Deleting/overriding is owner-only. Money truth is guarded in layers —
that's the point.

## 6. Troubleshooting

| Symptom | Check first |
|---|---|
| Books show nothing | The start date isn't set — start the books first. |
| Balances look wrong | Check for unposted records (Post now) and the waiting queues. |
| Page gated | The accounting module flag or FINANCE.view — check settings and your role. |

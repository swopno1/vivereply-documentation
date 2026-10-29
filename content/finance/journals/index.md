# Journals — Staff Training Module

**Page:** `/admin/finance/journals` — every accounting entry.
**Audience:** accountants, owners.
**Time to complete:** about 15 minutes.
**Prerequisite:** the [Finance](..) module.

## Learning objectives

After this module you can read journal entries, work the manual-journal
approval queue, and understand reversals.

## 1. What the page is

Two sections: **manual journals waiting** (SUBMITTED, oldest first) and
**the latest 100 entries**, filterable by source (`?source=`).

**Sources** — where an entry came from:

| Source | Meaning |
|---|---|
| MANUAL | Entered by hand (see below) |
| AUTO | Posted automatically by operations (folio charges, payments…) |
| SUPPLIER_BILL | A supplier bill |
| SUPPLIER_PAYMENT | Paying a supplier |
| TRANSFER | Money moved between accounts |
| PETTY_CASH_COUNT | A count difference posted |
| REVERSAL | A correction of another entry |

## 2. Manual journals

For the things operations don't post themselves: opening balances,
corrections, accruals. Create needs the create permission
(`/admin/finance/journals/new`); the journal enters as SUBMITTED and waits.
**Approving posts it to the books.** Like every approval in this system,
you can't approve your own.

## 3. Reversals — how corrections work

Posted entries are **never edited or deleted**. A wrong entry is corrected
with a **reversal**: a new entry that exactly undoes it, linked to the
original. The audit trail shows both — what was wrong *and* the fix. This
is non-negotiable accounting discipline, and the system enforces it.

## 4. Troubleshooting

| Symptom | Check first |
|---|---|
| Entry won't edit | Correct — posted entries are never edited. Post a reversal. |
| Journal stuck in waiting | It needs approval from someone other than the creator. |
| Numbers don't reconcile | Check for unposted records and reversed entries in the list. |

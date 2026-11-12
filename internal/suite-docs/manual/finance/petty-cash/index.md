# Petty Cash — Staff Training Module

**Page:** `/admin/finance/petty-cash` — the petty tin and transfers.
**Audience:** accountants, managers, cashiers.
**Time to complete:** about 15 minutes.
**Prerequisite:** the [Finance](..) module.

## Learning objectives

After this module you can count the petty tin, approve differences, and
move money between accounts.

## 1. What the page is

The PETTY_CASH ledger account: its **balance**, the last 20 counts, the
last 20 journal lines touching it, and the last 10 **transfers** between
money accounts.

## 2. Counts — the familiar count-and-approve pattern

Same honesty mechanism as cash shifts and stock counts: **count what's in
the tin, then compare against the book**. Unlike those counts this one
isn't strictly blind — the balance shows at the top of the page — so
count the tin first and read the screen second. Counting needs the create
permission; **approving a difference needs approve** — and as always, you
can't approve your own count (unless you are the owner). Approved
differences post as journal entries (source PETTY_CASH_COUNT).

## 3. Transfers

Moving money between accounts: bank → petty cash, bKash → bank, and so
on. Each transfer is a journal entry (source TRANSFER) with both sides —
money doesn't appear or disappear, it moves. The last 10 are listed for
the audit trail.

## 4. Troubleshooting

| Symptom | Check first |
|---|---|
| Count difference won't approve | You counted it — someone else approves (unless you're the owner). That's the rule. |
| Balance doesn't match the tin | Unapproved counts and unposted transfers — clear the queues first. |
| Transfer missing a side | Impossible by construction — every transfer is double-entry. Report it as a bug. |

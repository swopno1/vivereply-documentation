# Months — Staff Training Module

**Page:** `/admin/finance/months` — closing the month's books.
**Audience:** accountants, owners.
**Time to complete:** about 10 minutes.
**Prerequisite:** the [Finance](..) module.

## Learning objectives

After this module you understand month-end close: what it does, who can
do it, and why reopening is restricted.

## 1. What the page is

Thirteen months at most: the current month plus the twelve before it —
fewer when the books' start date is recent. Each shows its state — open
or closed. Only a past month can close; the current month stays open.

## 2. Closing a month

**Closing needs the approve permission.** A closed month's entries are
final: the month is marked CLOSED (plus an audit row) and becomes
read-only history — no settlement entries are posted. Close months
promptly — an ever-open past month is an invitation to backdate.

**Before closing:** decide every SUBMITTED manual journal dated in that
month (the close refuses while any waits), post everything pending, and
reconcile the money accounts. Supplier payments and petty cash counts
aren't close-blockers, but a close on dirty queues bakes the dirt in.

## 3. Reopening

**Reopening needs the edit permission (owner).** It's deliberately harder
than closing — a reopened month lets history be rewritten, so it needs
the owner's explicit hand. Reopen only for genuine corrections, reclose
immediately after, and record why.

## 4. Troubleshooting

| Symptom | Check first |
|---|---|
| Can't close | You need approve permission; the month must be over; and no SUBMITTED manual journal dated in it may still wait. |
| Can't reopen | Owner-only — that's intentional. |
| Reports look wrong for a past month | It may have been reopened and changed — check with the owner/accountant. |

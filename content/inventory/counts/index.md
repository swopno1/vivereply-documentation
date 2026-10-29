# Stock Counts — Staff Training Module

**Page:** `/admin/inventory/counts` — the physical stock-take.
**Audience:** storekeeper/counter (primary), managers (approval).
**Time to complete:** about 15 minutes.
**Prerequisite:** the Inventory module.

## Learning objectives

After this module you can run a blind count, and (as a manager) review one
correctly.

## 1. Why counts exist

Book quantity (what the system thinks) and shelf quantity (what's really
there) drift apart — missed issues, spillage, miscounted deliveries. The
count reconciles them. It is the same honesty mechanism as the cash shift's
blind count, applied to the store.

## 2. Counting — blind, by design

**The count form never shows the book quantity.** *"Count what is on the
shelf. The book quantity isn't shown; differences go to a manager for
approval."* Count what's physically there, item by item; **leave an item
blank to skip it** (it won't be touched). Add an optional note, then
**Submit count**.

The count becomes **Awaiting approval**. Nothing in stock changes yet —
that's the point.

## 3. Reviewing — the manager's job

Each submitted count shows: who counted and when, how many items, how many
**with a difference**. Opening it shows per line: **Book** (what the system
thought), **Counted** (what was found), **Difference**, and the **value
effect** of that difference.

- **Approve** → each difference posts to stock as a count adjustment. Book
  becomes shelf.
- **Reject** → nothing changes; count again.

Approval needs a **reason** (required) — it becomes the audit record.

**Two integrity rules:**

1. **You can't approve your own count.** *"Another manager or the owner
   does."* Separation of duties, no exceptions.
2. Counts awaiting approval appear in the **daily sheet's owner summary** —
   they don't sit invisible.

## 4. Reading the result

A count with many differences is information, not failure: it tells you
*where* the process leaks. Patterns to watch: one item always short (check
its issue discipline), waste never recorded (train it), everything slightly
off (the last counter rushed — re-train on the blind method).

## 5. Troubleshooting

| Symptom | Check first |
|---|---|
| Can't start a count | You need the create permission. |
| Approve button missing on your own count | Correct — another manager or the owner approves. That's the rule. |
| "Reject" did nothing to stock | Correct — rejecting changes nothing; count again. |
| Differences keep recurring on one item | Process leak, not a counting problem — check how that item is issued and wasted. |

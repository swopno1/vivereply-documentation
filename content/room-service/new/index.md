# New Room-Service Order — Staff Training Module

**Page:** `/admin/room-service/new` — taking an order.
**Audience:** front desk (primary).
**Time to complete:** about 10 minutes.
**Prerequisite:** the Room Service module.

## Learning objectives

After this module you can take an order cleanly: right guest, right items,
right note.

## 1. The flow

1. **Choose a checked-in room.** The list shows only guests with status
   CHECKED_IN — room service is for in-house guests, full stop. If nobody is
   checked in, the page says so; there's nothing to take an order for.
   (Opening from a booking with `?booking=` preselects that stay.)
2. **Add items** from the menu. Sold-out items are marked and can't be
   added — don't promise them; offer an alternative.
3. **Add a note for the kitchen** (optional but encouraged): *"less spicy,
   no onion"*. Allergies go here, always.
4. Check the summary (*\{count} items · \{amount}*) and **Place order** — the
   ticket appears on the kitchen board instantly (*"Order \{order} sent to
   the kitchen."*).

## 2. Two facts that prevent mistakes

- **The guest is charged at delivery, not now.** Tell the guest the total
  as information; the folio charge happens when the kitchen marks it
  delivered.
- **If the guest checks out mid-order**, the stay closes and the order
  can't be charged — a manager cancels it. Don't take orders for guests
  leaving within the hour without warning the kitchen.

## 3. Troubleshooting

| Symptom | Check first |
|---|---|
| Guest not in the list | They're not checked in — room service is in-house only. |
| "An item is sold out" | The kitchen marked it; refresh and re-pick with the guest. |
| Menu is empty | A manager adds items on the Menu page — escalate, don't improvise. |

# Room Service — Staff Training Module

**Page:** `/admin/room-service` — the kitchen ticket board.
**Audience:** kitchen staff (primary), front desk, managers.
**Time to complete:** about 25 minutes reading, then one supervised shift.
**Prerequisite:** none.

## Learning objectives

After this module you can:

- Explain the ticket lifecycle and what each status means.
- Move tickets correctly — and know why delivery is the money moment.
- Read the waiting timer and act before it turns red.
- Cancel properly (reason required) and understand the checkout block.

## 1. What the board is

One card per order ticket, oldest first, phone-first with large buttons,
**refreshing every 30 seconds** so the kitchen sees each other's work.
Two sections: **To do** (open tickets) and **Finished today** (collapsed
history).

**Permissions.** Viewing needs room-service-view. *Creating orders* needs
the create permission (front desk). *Moving tickets* needs the edit
permission (kitchen). Cancelling a fresh order needs create or edit; once
it's past New, cancelling needs a manager's approve. Money figures are
hidden from kitchen roles — **the kitchen works from dishes, not prices**;
the desk and managers see totals.

## 2. The ticket lifecycle

| Status | Meaning | Colour |
|---|---|---|
| **New** | Just placed, kitchen hasn't started | amber |
| **Preparing** | Kitchen is on it | blue |
| **Ready** | Done, waiting for delivery | green |
| **Delivered** | With the guest — **charged to the folio** | grey |
| **Cancelled** | Cancelled with a reason — **nothing charged** | grey, struck |

Buttons advance one step at a time: *Start preparing → Mark ready → Mark
delivered*.

**The money rule — read this twice:** the guest is **charged when the order
is delivered**, not when it's placed. Marking delivered pops a confirmation
(*"Mark \{order} delivered? \{amount} goes on the guest's folio."*) because
that click is the sale. Never mark delivered for food still in the kitchen.

**Cancelling** always asks *why* (at least 3 characters, required) and
charges nothing. The reason is kept on the record.

**Conflict handling.** If someone moved the ticket first, you get *"Someone
else updated this order. The board has been refreshed."* — re-do your action
on the fresh state.

## 3. Reading a ticket

- **Room \{unit}** + order number + guest name.
- The dishes with quantities (and line totals, if you can see money).
- The **kitchen note** in amber — *"less spicy, no onion"* — read it before
  cooking, not after.
- *"Ordered \{time} by \{name}"* and the total.
- The **waiting timer**: minutes since the order was placed. It turns **red
  at 30 minutes** — a red timer is an escalation, not decoration. If you see
  red, finish it or tell the manager why you can't.

## 4. Connections that constrain you

- **Checkout is blocked** while a room has an open order: *"Room service
  \{orders} is still open. Deliver or cancel it before check-out."* Front
  desk will come asking — deliver or cancel promptly.
- Undelivered orders appear on the **night-audit checklist**.
- Delivered orders post a **folio charge** → the guest's bill → collected
  revenue when paid.

## 5. Daily routine

**Kitchen:** keep *To do* empty in order — oldest red timers first. **Front
desk:** place orders accurately (room, dishes, notes); warn guests of real
wait times; clear open tickets before any checkout. **Manager:** watch for
chronic red timers — that's a staffing or menu signal.

## 6. Troubleshooting

| Symptom | Check first |
|---|---|
| Can't move a ticket | You need the edit permission; or someone moved it first (refresh). |
| Delivery confirmation surprises you | The amount shown goes on the folio *now* — confirm only when food is with the guest. |
| Cancel won't save | A reason (≥3 characters) is required. |
| Checkout blocked by room service | Deliver or cancel the open ticket — the block lifts immediately. |
| "This guest isn't checked in" | Room service is for in-house guests only — check the stay status. |

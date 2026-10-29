# Purchase Order Detail — Staff Training Module

**Page:** `/admin/purchasing/[id]` — one order, end to end.
**Audience:** managers, storekeepers.
**Time to complete:** about 15 minutes.
**Prerequisite:** the [Purchasing](..) module.

## Learning objectives

After this module you can approve an order, receive goods against it, and
edit it within the rules.

## 1. What the page is

The order's full picture: number, status, supplier, dates, lines (ordered
vs received per line), totals, and history. From here:

- **Edit** (`/admin/purchasing/[id]/edit`) — while it's still DRAFT (or
  per policy before approval). After approval, the order is a commitment:
  changes go through cancellation + a new order, not silent edits.
- **Approve** — SUBMITTED → APPROVED. The approver is someone other than
  the drafter, same separation-of-duties pattern as everywhere else.
- **Receive** (`/admin/purchasing/[id]/receive`) — goods arriving. Only
  against APPROVED or PARTIALLY_RECEIVED orders.

## 2. Receiving — the critical step

Receiving is where money becomes stock. For each line: **quantity actually
received**, and the price per unit from the order. Short deliveries are
normal — receive what arrived; the line shows the outstanding remainder,
and the order becomes PARTIALLY_RECEIVED.

**Check the goods before you receive them.** Quantity, condition, and that
it's the right item. A receipt posted is an inventory fact — the average
cost updates and the stock count rises. Receiving blind is how phantom
stock is born.

**Supplier bills** (the finance side) come from the same event — the
[bill in payables](../../finance/payables/) should match what was
received, not what was ordered.

## 3. Closing and cancelling

- **RECEIVED** — everything arrived. The order is complete.
- **CLOSED** — filed and done.
- **CANCELLED** — for orders that will never complete (supplier can't
  deliver, duplicate order). Cancelling frees the supplier/item from the
  open-order block.

## 4. Troubleshooting

| Symptom | Check first |
|---|---|
| Receive button missing | The order must be APPROVED — DRAFT and SUBMITTED can't receive. |
| Line shows outstanding forever | The supplier short-delivered and won't complete — cancel the order or the remainder. |
| Received quantity wrong | This is an inventory correction now — adjust via the stock count flow, with a note. |

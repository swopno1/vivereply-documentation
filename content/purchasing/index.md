# Purchasing — Staff Training Module

**Page:** `/admin/purchasing` — purchase orders.
**Audience:** managers, storekeepers, owners.
**Time to complete:** about 20 minutes.
**Prerequisite:** the [Inventory](../inventory/) module (this is where its
orders land).

## Learning objectives

After this module you can read the PO list, follow an order's lifecycle,
and know which sub-page does what.

## 1. What the page is

Purchase orders, in three bands: **waiting for approval first**, then
**open**, then **recently finished** (30). Each row: PO number
(`PO-202610-0007` — business month + monthly sequence), status, supplier,
expected date, total, line count.

## 2. The PO lifecycle

| Status | Meaning |
|---|---|
| **DRAFT** | Being built, not sent |
| **SUBMITTED** | Waiting for approval |
| **APPROVED** | Sent to the supplier — goods can arrive against it |
| **PARTIALLY_RECEIVED** | Some lines arrived |
| **RECEIVED** | Everything arrived |
| **CLOSED** | Done and filed |
| **CANCELLED** | Cancelled |

**Open** = DRAFT, SUBMITTED, APPROVED, PARTIALLY_RECEIVED. Open orders
**block** archiving their supplier or items — the system won't let you
delete a supplier mid-order.

**Receiving** happens only against APPROVED or PARTIALLY_RECEIVED orders,
and each receipt posts the goods into inventory (the [stock receive
flow](../inventory/move/receive/)). The PO and the inventory receipt are
two sides of the same event — they must agree.

## 3. The sub-pages

| Page | Docs | What it's for |
|---|---|---|
| `/admin/purchasing/new` | [New Order](new/) | Drafting a PO (can start from a low-stock item) |
| `/admin/purchasing/[id]` | [Order Detail](order/) | The order, its lines, approval, receiving |
| `/admin/purchasing/suppliers` | [Suppliers](suppliers/) | Who the property buys from |

**Limits:** 50 lines per order; ৳2 crore max total.

## 4. Troubleshooting

| Symptom | Check first |
|---|---|
| Can't archive a supplier/item | An open PO references it — close or cancel the order first. |
| Receiving blocked | The PO must be APPROVED (not DRAFT or SUBMITTED). |
| PO total looks wrong | Line quantities × prices — check for a typo before approval. |

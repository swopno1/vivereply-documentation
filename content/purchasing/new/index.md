# New Purchase Order — Staff Training Module

**Page:** `/admin/purchasing/new` — drafting a PO.
**Audience:** managers, storekeepers.
**Time to complete:** about 10 minutes.
**Prerequisite:** the [Purchasing](..) module.

## Learning objectives

After this module you can draft a purchase order — including starting one
from a low-stock alert.

## 1. What the page is

A PO form: supplier (active suppliers only), expected date, and up to 50
lines — each an inventory item, quantity, and unit price. The total
updates as you build; the ceiling is ৳2 crore.

**Starting from low stock:** the inventory low-stock list links here with
`?item=` — the form opens with that item preselected, so the reorder loop
is one click: flag → draft → approve → receive.

## 2. Drafting discipline

- **One supplier per PO.** Split across suppliers, split the orders —
  receiving and billing both key off the supplier.
- **Quantities in the item's unit.** The stock unit locks once stock has
  moved — order in the unit the item is counted in.
- **Prices are the order's prices**, not the item's average cost. The
  average cost updates when the goods are *received*, not when ordered.
- Save as **DRAFT** while building; **SUBMIT** when it's ready for
  approval. A submitted PO is a request — it becomes an order only when
  approved.

## 3. Troubleshooting

| Symptom | Check first |
|---|---|
| Item missing from the picker | It's archived — archived items can't be ordered. |
| Can't submit | You need PURCHASE create permission; the order must have at least one line. |
| Total exceeds ৳2 crore | Split into two orders — the cap is per order. |

# Issue Stock — Staff Training Module

**Page:** `/admin/inventory/move?kind=ISSUE` — stock leaving the store.
**Audience:** storekeeper (primary).
**Time to complete:** about 10 minutes.
**Prerequisite:** the Inventory module, [Movements overview](../).

## Learning objectives

After this module you can issue stock to departments without corrupting
the cost books.

## 1. The flow

1. Add a line per item: choose the item, enter the **quantity**, and pick
   the **receiving department** — Kitchen, Housekeeping, Front desk,
   Maintenance, or Other.
2. **Add another item** as needed, review, **Save** — *"Saved. Stock
   updated."*

No price is entered: the store values issued stock at **average cost**
automatically.

## 2. The department matters

Kitchen consumption, housekeeping supplies, and maintenance spares land in
different cost buckets in the books. Issuing everything to "Other" — or to
the wrong department — misstates departmental costs and poisons every
report built on them. Pick the department that actually took the goods;
"Other" is a last resort, not a habit.

## 3. Troubleshooting

| Symptom | Check first |
|---|---|
| Department costs look wrong in reports | Past issues went to the wrong department — check the item's movement history. |
| Can't issue more than on hand | The page shows on-hand beside each item — you can't issue what isn't there. |

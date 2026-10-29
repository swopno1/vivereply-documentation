# Receive Stock — Staff Training Module

**Page:** `/admin/inventory/move?kind=RECEIVE` — a delivery into the store.
**Audience:** storekeeper (primary).
**Time to complete:** about 10 minutes.
**Prerequisite:** the Inventory module, [Movements overview](../).

## Learning objectives

After this module you can receive a delivery so the books stay honest.

## 1. The flow

1. Add a line per item delivered: choose the item (or open with `?item=`
   preselected), enter the **quantity** and the **price per unit in taka**.
   The page shows *"\{qty} on hand"* beside each item — glance at it and
   sanity-check against the shelf before saving.
2. Fill **supplier** and **invoice/reference** (optional fields). Fill them
   anyway: when a bad batch has to be traced, the invoice ref is the thread
   you pull.
3. **Add another item** as needed, review the total value, **Save** —
   *"Saved. Stock updated."*

## 2. Why the price matters

The price you enter **updates the item's average cost** — the number the
item page and the stock valuation use. A typo here misprices the item until
the next delivery corrects it. This is the one field worth double-checking
before every save.

## 3. Troubleshooting

| Symptom | Check first |
|---|---|
| "Enter a price per unit in taka" | Receiving requires a valid price — it's what updates average cost. |
| "Enter a quantity (up to three decimals)" | Quantities are numeric, max 3 decimals. |
| Average cost looks wrong afterwards | The last receive price was likely mistyped — check the item's history. |
| "That line is worth more than ৳1 crore" | Quantity or price typo — recheck both. |

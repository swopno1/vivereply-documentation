# Inventory — Staff Training Module

**Page:** `/admin/inventory` — the main store's stock.
**Audience:** storekeeper (primary), managers, kitchen, housekeeping.
**Time to complete:** about 20 minutes reading, then one supervised week.
**Prerequisite:** none.

## Learning objectives

After this module you can:

- Read the stock list: what's on hand, what's low, what it's worth.
- Add and manage items (units, reorder levels) without breaking history.
- Receive, issue, and waste stock correctly.
- Run a blind stock count and understand the approval step.

## 1. What the page is

*"Stock in the main store: what is on hand, what came in and what went
out."* One row per item: name (English + Bengali), category (Food,
Beverages, Cleaning, Guest amenities, Linen, Maintenance, Other), unit
(kg, g, litre, ml, pcs, pack, bottle, box, roll), **on-hand quantity**,
and the reorder level.

**Money visibility.** Stock *values* are shown only to roles that handle
stock money (export/approve permission). A storekeeper sees quantities;
managers see what they're worth. If you see quantities but no values,
that's correct for your role.

## 2. Low stock — the signal that runs purchasing

An item is **low** when its on-hand quantity is **at or below its reorder
level** — the level you set per item meaning "order more now". Low items get
a badge, a banner counts them (*"Items at or below their reorder level:
\{count}"*), and a **Low stock only** filter shows just them.

**The reorder level is a decision, not data.** Set it at the quantity that
covers lead time: how much you use between ordering and delivery. Too low =
stockouts; too high = cash sleeping on shelves. Review levels quarterly, or
after any stockout.

Low-stock items also appear in the **daily sheet's owner summary** ("Stock
items to reorder") — the manager sees them every morning whether you report
them or not. Report them anyway.

## 3. Items: add, edit, archive

**Adding an item** (create permission): name in English, Bengali name
(optional but recommended), category, **unit**, reorder level.

**The unit is permanent.** *"The unit can't change once stock has moved."*
Choose carefully at creation — kg vs g, pcs vs pack — because every past
movement was recorded in that unit and history is never rewritten.

**Archiving** (instead of deleting): *"Archive \{name}? Its history
stays."* Archived items leave the list but keep every movement, count, and
cost record. Never delete stock history — auditors and the data-flow
reconciliation depend on it.

The **item page** shows the full movement history (who, what, to which
department or from which supplier, invoice refs) and the **average cost**
per unit — which updates every time you receive at a new price.

## 4. The three movements

From the main page (create permission), several items at once:

| Movement | Meaning | What you enter |
|---|---|---|
| **Receive** | A delivery into the store | What arrived, quantity, **price per unit** (updates average cost); supplier + invoice ref optional but wise |
| **Issue** | Stock leaving the store for a department | Quantity + **to department** (Kitchen, Housekeeping, Front desk, Maintenance, Other) |
| **Waste** | Spoiled, broken, expired | Quantity + **reason** (required) |

Quantities go to three decimals (2.500 kg). Any line worth more than
৳1 crore is rejected — check your quantity and price.

**Discipline:** record movements when they happen. Receiving "tomorrow" or
issuing "from memory" is how book and shelf drift apart — and the drift is
discovered at count time, as your variance.

## 5. Where to go next

- **Movements in detail:** [Stock Movements](move/) — receive/issue/waste
  walkthrough.
- **Counts:** [Stock Counts](counts/) — the blind count and its approval.

## 6. Troubleshooting

| Symptom | Check first |
|---|---|
| Values missing on the list | Your role doesn't have stock-money permission — quantities are what you need. |
| Can't change an item's unit | Locked once stock has moved — by design. Create a new item if truly needed. |
| "That line is worth more than ৳1 crore" | Quantity or price typo — recheck both. |
| Low banner won't clear | On-hand is still at/below reorder level — receive stock or lower the level deliberately (manager). |

# Phase D §1–2: inventory

## 1. Items, the stock ledger and stock counts

Migration `20261011100000_inventory` (additive).

| Table | What | Integrity |
|---|---|---|
| `StockItem` | Name (EN, optional BN), category, unit, reorder level, **on-hand quantity and stock value** | Category and unit are from fixed lists. On hand and value are never negative, and there is no value without stock (`StockItem_on_hand`). Items are archived, never deleted (trigger). |
| `StockMovement` | The ledger, one row per RECEIVE, ISSUE, WASTE or ADJUST. Signed quantity and value changes; unit cost (receive), department (issue), supplier, reference, reason, count (adjust), business date, idempotency key, who | Each kind has its direction and required fields (`StockMovement_direction`). Append-only (trigger). |
| `StockCount` / `StockCountLine` | A submitted count: per item the book quantity at submit (`expectedMilli`), the counted quantity and the difference. Then approved or rejected, with who, when and why | difference = counted − expected. Lines are append-only; a reviewed count is final; nothing is deleted (triggers). |

**Quantities:**
- Stored as integers in thousandths of the unit: 1.5 kg is `1500`. There is no floating point anywhere, and the forms accept up to three decimals.
- **Units:** KG, G, L, ML, PIECE, PACK, BOTTLE, BOX and ROLL. The unit can't change once stock has moved (`unit_locked`).

**Valuation: weighted average cost** (`src/lib/inventory/stock.ts`):
- **Receive:** adds `quantity × unit cost`, rounded to the poisha.
- **Issue and waste:** take value in proportion to quantity (`value × out ÷ on hand`). The movement that empties the shelf takes all the value that is left, so no rounding residue stays on an empty item.
- **Count adjustment upward:** valued at the current average cost, or at the last price paid if the shelf was empty.
- **Precision:** large products are worked out with BigInt, so nothing is lost.

**Posting** (`postMovement`):
1. Lock the item row (`FOR UPDATE`).
2. Refuse to go below zero.
3. Write the movement and change the item's on hand and value by the same amounts.

A test checks after each scenario that the cached on hand and value equal the sum of the ledger.

| Action | Grant | Notes |
|---|---|---|
| `saveStockItemAction` | `create` (new) / `edit` (change) | |
| `archiveStockItemAction` | `edit` | Only with nothing on hand. |
| `recordStockMovementsAction` | `create` | Receive (unit cost; optional supplier and reference), issue (department) or waste (reason required), up to 50 lines. **All lines or none:** one line short of stock refuses the whole movement (`insufficient_stock`, naming the item). Items are locked in id order, so two movements can't deadlock. Idempotent per submit. |
| `submitStockCountAction` | `create` | **Blind:** the form never shows the book quantity, which is snapshotted inside the transaction. Idempotent. |
| `reviewStockCountAction` | `approve` | **Approve:** posts one ADJUST per line with a difference, applying the difference found to stock as it is now. If stock issued since the count makes that negative, the result is `would_go_negative` and nothing changes: reject and recount. **Reject:** changes nothing. A reason is always required. Nobody approves their own count except the OWNER. |

**Audit:**
- `STOCK_ITEM_ADDED`, `_UPDATED`, `_ARCHIVED`;
- `STOCK_RECEIVE`, `STOCK_ISSUE`, `STOCK_WASTE` (every line with its value);
- `STOCK_COUNT_SUBMITTED`, `_APPROVED`, `_REJECTED`.

**Corrections:** a movement is never edited. Stock is corrected only through an approved count, so nobody can quietly "fix" a shortage.

### Tests

**`src/lib/inventory/inventory.db.test.ts`:**
- **Items:** the storekeeper's item rules (unit locked, archive with stock); the kitchen refused.
- **Valuation:** average cost across two receipts.
- **Movements:** all-or-none on a short line; waste needs a reason; emptying the shelf leaves no value; a double submit posts once.
- **Concurrency:** two issues racing for the last stock; one goes through.
- **Counts:** blind snapshot; the storekeeper can't approve; an approval posts the adjustment; a manager can't approve their own count, the owner can; a reject changes nothing; an approval that would go negative is refused.
- **Database guards:** append-only ledger, undeletable items, never-negative stock.

**`src/lib/inventory/stock.test.ts`:** quantity parsing and formatting (with Bengali digits), valuation and rounding, low stock.

**`permission-enforcement.test.ts`:** 6 new action paths × every role.

**How blind the count is:** the count form never shows the book quantity, and it is snapshotted on the server. But the storekeeper can still see on-hand quantities on the stock list, because they need them to issue stock. So the stock count is blind **by procedure**, unlike the cash count, where the expected amount is never shown. The real control is that a difference changes stock only through a manager's approval with a reason, and never the counter's own.

## 2. Screens and export

| Page | Who | What |
|---|---|---|
| `/admin/inventory` | `INVENTORY.view` | **Toolbar:** stock value, then Receive, Issue, Waste (for `create`), Stock counts (with the number awaiting approval) and two CSV exports (for `export`). **List:** a low-stock banner; search (EN or BN name), a category filter and "low stock only"; one line per item with on hand (amber with "Low" at or below its reorder level) and value. **Add item** form. **Money:** values only for viewers with `export` or `approve`, so kitchen and housekeeping see quantities only. |
| `/admin/inventory/[id]` | `INVENTORY.view` | **Figures:** on hand, value and average cost per unit. **Edit and archive** for `edit`; the unit select is locked once stock has moved. **History:** the last 100 movements, with department, supplier, reference, reason, who and the value change. |
| `/admin/inventory/move?kind=RECEIVE\|ISSUE\|WASTE` | `INVENTORY.create` | **Lines:** up to 50, each an item select (an item can't be picked twice), a quantity (in the item's unit; "on hand" shown for issue and waste) and, for receipts, a price per unit with a running total value. **Kind-specific fields:** department (issue); supplier and reference (receive); a reason (waste). One idempotency key per submit, renewed after a save. |
| `/admin/inventory/counts` | `INVENTORY.view` (counting: `create`) | **List:** counts, those awaiting approval first. **New count:** a form of every active item by category, with no book quantities. Blank means not counted; there is an optional note. |
| `/admin/inventory/counts/[id]` | `INVENTORY.view` | **Lines:** each with book, counted and difference, largest difference first, plus the estimated value effect while pending (money viewers). **Review:** Approve or Reject with a required reason, for `approve` holders who didn't submit the count. A manager looking at their own count is told another manager or the owner approves it. |
| `GET /api/admin/inventory/export?type=stock\|movements[&from&to]` | `INVENTORY.export` | **CSV:** UTF-8 with a BOM (Excel opens Bengali correctly); quantities in units, money in taka; up to 50,000 movements. **Formula guard:** a text cell starting with `= + - @` is prefixed with `'`, so a spreadsheet won't run it. **Refusals:** the guard runs outside any try (403 on refusal), and a switched-off module gives 404. **Audit:** each export writes `INVENTORY_EXPORTED`. |

**Sidebar and landing pages:**
- **Sidebar:** "Inventory" (`INVENTORY.view` plus the `inventory` flag), after Room Service.
- **Who sees it:** OWNER, MANAGER, HOUSEKEEPING, KITCHEN, STOREKEEPER, ACCOUNTANT and AUDITOR.
- **STOREKEEPER** now lands on it, instead of the "nothing to show yet" page.

**Daily sheet:** the owner summary adds "Stock items to reorder" and "Stock counts awaiting approval".

### Live check (production build, scratch DB, 360px)

| As | Checked |
|---|---|
| STOREKEEPER (English) | **Setup:** lands on `/admin/inventory`. Added rice (kg, reorder 10, with a BN name) and hand soap (pcs, reorder 20). **Receipt:** 25 kg at ৳120 and 50 pcs at ৳35 from "Rahman Traders" (running total ৳4,750). **Issue:** an issue of 30 kg was refused ("Not enough Basmati rice in stock. Nothing was saved."), then 18 kg went to the kitchen. **Waste:** 2 soaps, with a reason. **Result:** the list shows rice 7 kg, "Low", ৳840; soap 48 pcs, ৳1,680; stock value ৳2,520. **Count:** counted rice 6.5 and soap 48 on the blind form (no book figures); after submitting there was no review form for the storekeeper. Every tap target ≥ 44px; no overflow. |
| MANAGER (Bengali) | **Count:** shows খাতা ৭ কেজি · গোনা ৬.৫ কেজি, −০.৫ কেজি, about −৬০৳. Approved with a Bengali reason, and the count shows অনুমোদিত with the note. **Result:** rice is now ৬.৫ কেজি (৭৮০৳); stock value ২,৪৬০৳. **Daily sheet:** the owner summary shows "রিঅর্ডার করতে হবে এমন স্টক আইটেম ১" and "অনুমোদনের অপেক্ষায় স্টক গণনা ০". |
| KITCHEN | The list shows no ৳ and no Receive, Issue, Waste or export controls. The export URL returns 403. Opening the move page renders the "forbidden" page; the form is never sent, as for other protected pages. |

**Fixed live:** "1 items at or below…" now reads "Items at or below their reorder level: 1."

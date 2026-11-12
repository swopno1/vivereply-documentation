# Phase E §1 and §3: suppliers and purchase orders

Defaults (00-PLAN.md):
- every order is approved before it goes out, never by whoever created, submitted or last edited it (the OWNER excepted);
- goods are received against an approved order, at its agreed price, never more than ordered.

## 1. Data and rules

Migration `20261012100000_purchasing` (additive):

| Table | What | Integrity |
|---|---|---|
| `Supplier` | Name, contact person, phone, email, address, note | **Name:** 1 to 120 characters, one active supplier per name, case-insensitive (partial unique index); an archived supplier's name can be reused. **Never deleted:** archived instead (trigger), and only with no open order. |
| `PurchaseOrder` | `PO-YYYYMM-NNNN` (business month plus a monthly `Sequence`), supplier, status, expected date, note, total, who created / last edited / submitted / approved it and when, the approver's send-back note, and for a closed or cancelled order who ended it, when and why | **Each status carries its steps' fields** (check). **Total:** ৳0 to ৳2 crore. **Moves** (`PurchaseOrder_guard` trigger): DRAFT → SUBMITTED or CANCELLED; SUBMITTED → APPROVED, DRAFT (sent back) or CANCELLED; APPROVED → PARTIALLY_RECEIVED, RECEIVED or CANCELLED; PARTIALLY_RECEIVED → RECEIVED or CLOSED. RECEIVED, CLOSED and CANCELLED are final. **Fixed:** the number, creator and key; the supplier and total change only on a draft. **Never deleted.** |
| `PurchaseOrderLine` | Stock item, quantity ordered (thousandths), agreed price per whole unit, line total, quantity received | **Line total** = quantity × price, rounded to the poisha (check). **Received** is between 0 and the quantity ordered (check). **Lines** are added, changed or removed only on a draft; afterwards only the received quantity moves, only up, and only on an approved or part-received order (`PurchaseOrderLine_guard` trigger). One line per item per order. |
| `PurchaseReceipt` | One delivery: the supplier's invoice or delivery-note number, note, value, business date, who received it and when | Append-only (trigger). |
| `PurchaseReceiptLine` | Order line, item, quantity, price, value, and the `StockMovement` it posted (unique) | Value = quantity × price (check). Append-only (trigger). |

### Who does what

No matrix change. The `PURCHASE` row grants: OWNER all; MANAGER V C E A X; STOREKEEPER V C E; ACCOUNTANT V A X; AUDITOR V X.

| Action | Grant |
|---|---|
| `saveSupplierAction` (new) | `PURCHASE.create` |
| `saveSupplierAction` (change), `archiveSupplierAction` | `PURCHASE.edit` |
| `createPurchaseOrderAction` (a draft, or `submit: true` to send it straight for approval), `submitPurchaseOrderAction` | `PURCHASE.create` |
| `updatePurchaseOrderAction` (a draft only) | `PURCHASE.edit` |
| `cancelPurchaseOrderAction`, draft or submitted | `PURCHASE.edit` |
| `cancelPurchaseOrderAction`, approved with nothing received | `PURCHASE.approve`: the supplier may already have the order |
| `reviewPurchaseOrderAction` (approve, or send back with a note) | `PURCHASE.approve`, never your own order (below) |
| `closePurchaseOrderAction` (part received; the rest will never come) | `PURCHASE.approve` |
| `receivePurchaseOrderAction` | `PURCHASE.edit` (STOREKEEPER, MANAGER, OWNER: each also has `INVENTORY.create`) |

Every action is audited:
- `SUPPLIER_ADDED`, `_UPDATED` (before and after) and `_ARCHIVED`;
- `PURCHASE_ORDER_DRAFTED`, `_UPDATED` (before and after), `_SUBMITTED`, `_APPROVED`, `_SENT_BACK`, `_CANCELLED`, `_CLOSED_SHORT` and `_RECEIVED`.

### Ordering

- **Content:** 1 to 50 lines, one per stock item; quantity up to three decimals; price per whole unit up to ৳10,00,000; a line up to ৳1 crore and the order up to ৳2 crore. The supplier and every item must be active.
- **Totals** are worked out on the server from quantity × price, the same rounding as a stock receipt.
- **Double submits:** the form's idempotency key means a double click makes one order.
- **Approval:** an approver can't approve an order they created, submitted or last edited (`own_order`), unless they are the OWNER. A manager who changes a storekeeper's draft therefore needs the accountant or the owner to approve it. Sending back returns the order to draft with the note, which shows on the order until it is submitted again.

### Receiving

In one transaction, with the order row locked (`FOR UPDATE`):

1. The order must be approved or part received (`wrong_status` otherwise).
2. Each line's quantity must be no more than what is still to come (`over_receipt`, and nothing is saved).
3. One `PurchaseReceipt` is written, then for each line, in item-id order (the same lock order as every stock movement):
   - a stock `RECEIVE` movement at the **order's agreed price**, with the supplier's name and the reference `PO-…` (plus the supplier's invoice number when given);
   - the receipt line, linked to that movement;
   - the received quantity added to the order line.
4. The order becomes RECEIVED when every line is complete, otherwise PART RECEIVED.

Two deliveries at once can't over-receive: the second waits for the order lock and then sees what the first received (tested). A double submit records one delivery.

**Ending an order:**
- **Cancel:** an order nobody has received anything against, with a reason.
- **Close short:** an approver closes a part-received order whose rest will never come, with a reason.

**Inventory:** an item still on an open order can't be archived (`on_order`). Inventory's own "Receive stock" stays for small buys without an order.

## Tests

**`src/lib/purchasing/purchasing.db.test.ts`:**
- **Suppliers:** add and edit; a duplicate name in another case is refused; the kitchen and the accountant can't add; a supplier or item on an open order can't be archived; an archived supplier takes no orders and can't be deleted.
- **Orders:** totals from the server (2.5 kg × ৳120.50 = ৳301.25); a double submit makes one order; bad quantities, prices, duplicate items, impossible dates and oversize lines are refused; editing a draft replaces its lines; a submitted order can't be edited.
- **Approval:** the storekeeper can't approve; send back needs a note; the manager who edited can't approve; the accountant can; the OWNER may approve their own; the audit trail lists every step.
- **Receiving:**
  - part deliveries post stock at the order's price, with the PO number and invoice reference on the movement;
  - over-receipt refuses the whole delivery;
  - a double submit records one delivery;
  - the order becomes received when complete;
  - the accountant can't receive;
  - two simultaneous deliveries never receive more than ordered.
- **Ending:** the storekeeper can't cancel an approved order or close one short; once something has arrived only closing short works; a cancelled order takes no delivery.
- **Database:** an approved line's price, new lines on an approved order, moving backwards, changing an approved order's total, over-receiving, shrinking a received quantity, editing a delivery, changing a finished order and deleting an order are all refused by the database itself.

**`src/lib/purchasing/constants.test.ts`:** order numbers, calendar dates, the quantity still to come.

**`permission-enforcement.test.ts`:** 11 new guarded paths × every role.

## 3. Screens

| Page | Who | What |
|---|---|---|
| `/admin/purchasing` | `PURCHASE.view` | **Lists:** orders awaiting approval (highlighted, with a count), the other open orders, and the last 30 finished. Each row shows the supplier, PO number, number of items, total, expected date and status. **Buttons:** "New order" (`create`), "Suppliers", "Export orders (CSV)" (`export`). |
| `/admin/purchasing/new` | `PURCHASE.create` | **Order:** supplier, expected delivery date, note, and item lines (item, quantity in the item's unit, price per unit) with a running total. **Buttons:** "Submit for approval" or "Save draft". `?item=` starts with that stock item. The form's idempotency key covers a double click. |
| `/admin/purchasing/[id]` | `PURCHASE.view` | **Order:** lines (ordered, received once approved, price, line total), the total, and who drafted, submitted, approved or ended it, and when. **Next steps, by status and grant:** submit and edit (draft); approve, or send back with a note (approvers, never their own order; the creator sees why they can't); receive goods; close short or cancel, with a required reason. A sent-back note shows on the draft. **Deliveries:** each with time, who, value, items, and the invoice number. |
| `/admin/purchasing/[id]/edit` | `PURCHASE.edit` | The same form, for a draft only (otherwise back to the order). |
| `/admin/purchasing/[id]/receive` | `PURCHASE.edit` | **Lines** with something still to come, each showing what's left and its price. **"Everything still to come arrived"** fills them in; blank lines are skipped. **Delivery details:** the supplier's invoice or delivery note, a note, and the value at the order's prices. An over-receipt is caught on the form and again on the server. |
| `/admin/purchasing/suppliers` | `PURCHASE.view` | Active suppliers with contact details (tap to call) and their open-order count. Add (`create`), edit and archive (`edit`, confirmed). |
| `GET /api/admin/purchasing/export` | `PURCHASE.export` | **CSV:** one row per order line: number, status, supplier, dates, item, ordered, received, price, totals, who created, approved or ended it, and why. `?month=YYYY-MM` picks one business month. Formula-safe cells, UTF-8 BOM for Excel, audited (`PURCHASE_ORDERS_EXPORTED`). |

**Sidebar:** "Purchasing" (`PURCHASE.view` plus the `purchase` flag), after Inventory.
- **Who sees it:** OWNER, MANAGER, STOREKEEPER, ACCOUNTANT and AUDITOR.
- **Landing pages:** unchanged. STOREKEEPER still lands on Inventory, and on Purchasing when Inventory is off.
- **Docs:** `01-ROLES-AND-PERMISSIONS.md` §6 is updated, and its test checks it.

**Module flag:** `purchase` is live, so it can be switched in Settings > Modules. In this template it stays **off by default** (brief §7, "enabled per client"); an OWNER switches it on.

**Daily sheet:** the owner summary adds "Purchase orders awaiting approval" while the module is on.

### Live check (production build, scratch DB, 360px)

| As | Checked |
|---|---|
| STOREKEEPER (Bengali, then English) | **Sidebar:** ইনভেন্টরি, ক্রয়. **Supplier:** added "Rahman Traders" with a phone number. **Order:** 25 kg basmati rice at ৳120 and 10 L soybean oil at ৳185.50 gave "Total ৳4,855"; submitting gave `PO-202610-0001`, "Awaiting approval", with only "Cancel order" offered. **Delivery:** "Everything still to come arrived", then rice changed to 20 kg (value ৳4,255). 26 kg was refused on the form ("More Basmati rice than is still to come…"). The order showed "Part received" and the delivery with "Invoice INV-4471"; inventory showed rice 20 kg (৳2,400) and oil 10 L (৳1,855). No overflow; every tap target ≥ 44px. |
| MANAGER (Bengali) | **List:** অনুমোদনের অপেক্ষায় (১) with the order. **Detail:** "আদেশ ২৫ কেজি · প্রতি কেজি ১২০৳". Approved with অনুমোদন করুন, and the status became অনুমোদিত. No overflow; no tap target under 44px. |
| ACCOUNTANT (English) | **Landing:** Dashboard. **Sidebar:** Dashboard, Inventory, Purchasing, Bookings. **Close short:** with a reason: "Closed short … by Test Accountant: Supplier has no more basmati this month". **Export:** the CSV has both lines (rice "25","20"; oil "10","10") and the reason. |
| AUDITOR (English) | **Access:** sees the list and the order with no buttons; export 200; `/admin/purchasing/new` shows "403 - Access Denied". |

**Fixed live:**
- A submitted order showed "received 0 kg" before anything could arrive; it now shows received quantities only once the order is approved.
- With only an order awaiting approval, "Open orders" said "No open orders." under it; that empty card is now hidden.

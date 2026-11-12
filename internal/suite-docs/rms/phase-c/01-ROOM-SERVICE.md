# Phase C §1–2: room service

Owner decisions (2026-10-09):
- menu, orders and the kitchen board;
- the guest is charged **on delivery**;
- **in-house guests only.**

## 1. Data and rules

Migration `20261010100000_room_service` (additive):

| Table | What | Integrity |
|---|---|---|
| `MenuItem` | Name (EN), optional BN name, category, description, price in poisha, available, sort order, archived | **Price:** ৳0.01 to ৳1,00,000. **Category:** one of BREAKFAST, MAINS, SNACKS, DESSERTS, DRINKS, OTHER. **Name:** 1 to 120 characters. **Never deleted:** a removed item is archived. |
| `RoomServiceOrder` | `RS-YYYYMMDD-NNN` (business date plus a daily `Sequence`), stay, room number at order time, status, note, total, who placed it and when, each step's time and user, the cancel reason, the folio line | **Each status carries its steps' fields:** Delivered has the folio line, Cancelled has a reason. **Final orders:** a delivered or cancelled order can't change. **Fixed fields:** the stay, total, number and who placed it never change. **Never deleted:** order rows can't be removed. All of this is enforced by checks and the `RoomServiceOrder_final` trigger. |
| `RoomServiceOrderItem` | Name, BN name and unit price **copied at order time**, quantity (1–50), line total | The line total must equal price × quantity. Lines are written once and never changed or deleted (trigger). |

### Who does what

There is no matrix change. The `ROOM_SERVICE` row grants: OWNER all; MANAGER V C E A X; FRONT_DESK V C; HOUSEKEEPING V; KITCHEN V E; AUDITOR V X.

| Action | Grant |
|---|---|
| `placeRoomServiceOrderAction` | `ROOM_SERVICE.create` (desk, managers) |
| `advanceRoomServiceOrderAction` (NEW → PREPARING → READY → DELIVERED) | `ROOM_SERVICE.edit` (kitchen, managers) |
| `cancelRoomServiceOrderAction`, while NEW | `create` or `edit`: the desk, or the kitchen, which can't make it |
| `cancelRoomServiceOrderAction`, once started | `ROOM_SERVICE.approve` (managers): food may be wasted |
| `saveMenuItemAction`, `archiveMenuItemAction` | `ROOM_SERVICE.approve`: prices are a manager's |
| `setMenuItemAvailableAction` (sold out / back) | `ROOM_SERVICE.edit` (kitchen) |

Every action is audited:
- `ROOM_SERVICE_ORDER_PLACED`, `_PREPARING`, `_READY`, `_DELIVERED` and `_CANCELLED`;
- `MENU_ITEM_ADDED`, `_UPDATED`, `_ARCHIVED`, `_SOLD_OUT` and `_AVAILABLE`.

### Placing an order

- **Who:** only for a stay that is **checked in**; otherwise the result is `not_in_house`.
- **What:**
  - 1 to 30 lines and 1 to 50 of each item. A repeated item is merged into one line.
  - Every item must be on the menu and available; otherwise `item_unavailable`.
- **Prices:** read from the menu inside the transaction, with the booking row locked. The client sends only item ids and quantities.
- **Double submits:** the form's idempotency key (scoped to the booking) means a double click places one order; the second call returns the first.

### Moving an order

- **Stale screens:** each move names the status the screen showed. The order row is locked (`FOR UPDATE`), and a different status returns `stale`. Two taps on "Mark delivered" deliver once; this is tested.
- **Delivery,** in one transaction:
  1. Lock the order and the booking.
  2. The stay must still be checked in (`stay_closed` otherwise; a manager cancels the order).
  3. Post one `EXTRA_CHARGE` folio line: category `ROOM_SERVICE`, description `RS-…: 2× Chicken biryani, 1× Lassi`, idempotency key `room-service:<order>`, created by whoever marked it delivered.
  4. Link the line to the order and mark the order delivered.
- **Cancellation:** a reason is always required, and nothing is charged.
- **After delivery:** a complaint is handled by a manager voiding the folio line, as for any charge.

### Check-out

`updateBookingStatus(…, "COMPLETED")` returns `code: "room_service_open"` with the order numbers while any order of the stay is NEW, PREPARING or READY. The desk delivers or cancels the order first, so food can't leave the building unbilled.

## Tests

**`src/lib/room-service/room-service.db.test.ts`:**
- **Menu:** a manager adds and prices items; bad prices and categories are refused; kitchen marks items sold out; the desk can't.
- **Orders:**
  - only for checked-in stays, and only available items;
  - prices come from the menu, and repeated items merge;
  - a double submit places one order;
  - kitchen can't take orders.
- **Moves:**
  - the full kitchen flow;
  - stale moves;
  - two simultaneous deliveries charge once;
  - the folio line, check-out blocked while the order is open, and the final order refused by the database.
- **Cancel:** the desk while new; a manager once started; the kitchen and the desk refused once started; a reason required; nothing charged.
- **Board:** open orders oldest first; order lines immutable.

**`src/lib/room-service/orders.test.ts`:** order numbers, the charge description and the move table.

**`permission-enforcement.test.ts`:** 6 new actions × every role.

## 2. Screens

| Page | Who | What |
|---|---|---|
| `/admin/room-service` (board) | `ROOM_SERVICE.view` | **Tickets:** every open ticket, oldest first, one card per order. Each card shows the room (large), the order number, the guest, the status, minutes waiting (red after 30), the items, the note (highlighted), and who took it. **Buttons:** "Start preparing" → "Mark ready" → "Mark delivered" (confirmed) for `edit`. "Cancel" with a required reason for whoever may cancel at that status. **Finished today:** a collapsed list. **Refresh:** every 30 seconds while on screen. **Money:** totals only for those who take orders or manage, so the kitchen sees dishes, not prices (its delivery confirmation leaves the amount out too). |
| `/admin/room-service/new` | `ROOM_SERVICE.create` | **Room:** pick a checked-in room (sorted by room number; `?booking=` preselects). **Items:** grouped by category, with − / + steppers (44px); sold-out items are struck through. A kitchen note, then "3 items · ৳1,050" and "Place order". The form's idempotency key is renewed after each order. |
| `/admin/room-service/menu` | `ROOM_SERVICE.view` | Items by category, with the BN name where there is one. **Kitchen** (`edit`): "Mark sold out" / "Back on the menu". **Managers** (`approve`): add, edit (name EN/BN, category, price, description, order in list) and remove (archive, with confirmation). |

**Sidebar and landing pages:**
- **Sidebar:** "Room Service" (`ROOM_SERVICE.view` plus the `roomService` flag), after Housekeeping.
- **Who sees it:** OWNER, MANAGER, FRONT_DESK, HOUSEKEEPING, KITCHEN and AUDITOR.
- **KITCHEN** now lands on the board instead of the "nothing to show yet" page.
- **Docs:** `01-ROLES-AND-PERMISSIONS.md` §6 and `03-TEST-USERS.md` are updated, and their tests check them.

**Elsewhere:**
- **Folio:** "Room service: RS-20261009-001: 2× Chicken biryani, 1× Mango lassi", localized ("রুম সার্ভিস: …").
- **Check-out:** "Room service RS-… is still open. Deliver or cancel it before check-out."
- **Night audit:** lists orders not yet delivered, with a link to the board.

### Live check (production build, scratch DB, 360px)

| As | Checked |
|---|---|
| MANAGER (English) | Added three items (one with a BN name) on the menu page. Every tap target ≥ 44px; no overflow. |
| FRONT_DESK (English) | The new-order page lists the two checked-in rooms. Two biryani and one lassi with a note give "3 items · ৳1,050"; placing it gave "Order RS-20261009-001 sent to the kitchen." The board shows the ticket with prices. Checking that guest out was stopped: "Room service RS-20261009-001 is still open…". |
| KITCHEN (Bengali) | Lands on `/admin/room-service`. The ticket shows "২× চিকেন বিরিয়ানি, ১× আমের লাচ্ছি" and the note, with no ৳ anywhere. Moved it through তৈরি শুরু করুন → প্রস্তুত হয়েছে → ডেলিভারি হয়েছে. The menu page offers only "শেষ চিহ্নিত করুন". |
| FRONT_DESK (Bengali) | The folio shows "রুম সার্ভিস: RS-20261009-001: 2× Chicken biryani, 1× Mango lassi". No overflow. |

**Fixed live:** the kitchen's delivery confirmation showed the amount; it now says only that the charge goes on the folio.

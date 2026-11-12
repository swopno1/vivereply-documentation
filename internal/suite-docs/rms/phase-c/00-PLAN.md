# Phase C: room service

Branch `phase-c-room-service`, from `main` at `2a46543` (Phase B2 merged).

The `ROOM_SERVICE` module, listed as Phase C in `01-ROLES-AND-PERMISSIONS.md`.

The Phase A2/B rules still apply:
- Additive migrations only.
- No route path changes.
- No new runtime dependencies.
- Fail closed, and audit every write.
- Every screen in EN and BN, working at 360px.
- One commit per section.
- `pnpm lint` and `pnpm build` before each commit.
- Gateway suites whenever payment code is touched.

## Owner decisions (2026-10-09)

| Topic | Decision |
|---|---|
| Scope | **Menu, orders and the kitchen board.** A manager keeps the menu, the desk takes orders for a room, the kitchen works from a ticket board, and the charge goes on the guest's folio. Guest QR ordering and automatic guest messages come later. |
| When the guest is charged | **On delivery.** The charge goes on the folio when the order is marked delivered. An order cancelled before delivery is never charged. A complaint after delivery is a manager's void, as on any folio line. |
| Who can order | **In-house guests only:** checked-in stays, charged to the room. No outside diners and no restaurant till in v1. |

## Permissions (no matrix change)

The `ROOM_SERVICE` row: OWNER all; MANAGER V C E A X; FRONT_DESK V C; HOUSEKEEPING V; KITCHEN V E; AUDITOR V X.

| Action | Grant | Roles |
|---|---|---|
| See the board, the orders and the menu | `ROOM_SERVICE.view` | OWNER, MANAGER, FRONT_DESK, HOUSEKEEPING, KITCHEN, AUDITOR |
| Take an order for a room; cancel it while it is still new | `ROOM_SERVICE.create` | OWNER, MANAGER, FRONT_DESK |
| Move an order (start, ready, delivered); mark a menu item sold out or back | `ROOM_SERVICE.edit` | OWNER, MANAGER, KITCHEN |
| Add or change menu items and prices; cancel an order already started | `ROOM_SERVICE.approve` | OWNER, MANAGER |

Every screen also needs the `roomService` module flag, which becomes live.

## Sections

**§1 Menu and orders (data and rules).**
- **Schema:**
  - `MenuItem`: name in EN and an optional BN name, category, price in poisha, available, archived.
  - `RoomServiceOrder`:
    - a daily number `RS-YYYYMMDD-NNN` from the `Sequence` table;
    - the stay and its room;
    - status: `NEW` → `PREPARING` → `READY` → `DELIVERED`, or `CANCELLED`;
    - who did each step and when;
    - the folio line the delivery posted.
  - `RoomServiceOrderItem`: the name and price copied at order time, the quantity and the line total.
- **Order:**
  - Only for a checked-in stay.
  - Only available, unarchived items.
  - Prices are read on the server; the client sends only items and quantities.
  - An idempotency key stops a double submit from placing two orders.
- **Moves:** each step is conditional on the status the screen showed (`stale` otherwise) and audited.
- **Delivery:** in one transaction, with the order and booking rows locked, it:
  - posts one `EXTRA_CHARGE` folio line (category `ROOM_SERVICE`, key `room-service:<order>`);
  - links the line to the order;
  - marks the order delivered.
- **Cancel:**
  - while `NEW`: the desk or the kitchen;
  - once started: a manager;
  - a reason is always required.
- **Check-out:** blocked while the stay has an open order (not delivered or cancelled), so no food goes unbilled.

**§2 Screens.**
- **Board, `/admin/room-service`:** tickets by status, oldest first, refreshing every 30 seconds. Kitchen staff advance them with large buttons. The desk sees totals; the kitchen doesn't need money.
- **New order, `/admin/room-service/new`:** pick an in-house room, add menu items with quantities and a note, and see the total.
- **Menu, `/admin/room-service/menu`:** managers add, edit and archive items; kitchen marks items sold out.
- **Navigation:** a "Room Service" sidebar item; KITCHEN users land on the board.
- **Elsewhere:**
  - The folio shows "Room service: RS-…".
  - The night audit lists open orders.
  - The booking's check-out explains an open order.

**§3 Verification report.**

## Not in Phase C

- Guest QR ordering from the room.
- Automatic guest messages.
- Outside diners and a restaurant till.
- Recipes and kitchen stock (Phase D, inventory).
- VAT and service charge (Phase F): menu prices are tax-inclusive.

# Phase D: inventory

Branch `phase-d-inventory`, stacked on `phase-c-room-service`, which itself sits on `hardening/production-finalization`. Merge in that order.

The `INVENTORY` module, listed as Phase D in `01-ROLES-AND-PERMISSIONS.md`.

The Phase A2/B rules still apply:
- Additive migrations only.
- No route path changes.
- No new runtime dependencies.
- Fail closed, and audit every write.
- Every screen in EN and BN, working at 360px.
- One commit per section.
- `pnpm lint` and `pnpm build` before each commit.

## Defaults applied (2026-10-09)

The owner said "Continue" without a brief. These are the recommended defaults, in line with earlier decisions (the blind cash count of B2). Each is easy to change.

| Topic | Default |
|---|---|
| Scope | **Stock items, stock in and out, stock counts, low-stock alerts, CSV export.** Purchase orders and supplier records are Phase E. Deducting stock from room-service dishes (recipes) is P2. |
| Stores | **One main store.** Stock is issued to departments: kitchen, housekeeping, front desk, maintenance, other. |
| Movements | Receive (with unit cost), issue (to a department), waste (with a reason). **Never below zero:** issuing more than is on hand is refused. Corrections come only from an approved stock count. |
| Valuation | **Weighted average cost.** Stock value moves with each receipt and is taken out in proportion with each issue or waste. |
| Stock count | **Blind on the form:** the count form doesn't show the book quantity. Differences become adjustments only when a manager approves them; nobody approves their own count except the OWNER. (Unlike the cash count, the storekeeper can still see stock levels on the stock list, which they need for issuing, so the count is blind by procedure. The control is the manager's approval.) |
| Alerts | Each item has a reorder level. Items at or below it are listed on the inventory page and counted in the daily sheet's owner summary. Email alerts wait for the notifications engine. |

## Permissions (no matrix change)

The `INVENTORY` row: OWNER all; MANAGER V C E A X; HOUSEKEEPING V; KITCHEN V; STOREKEEPER V C E X; ACCOUNTANT V X; AUDITOR V X.

| Action | Grant |
|---|---|
| See stock, items and history | `INVENTORY.view` |
| Add an item; receive, issue or waste stock; enter and submit a stock count | `INVENTORY.create` (STOREKEEPER, MANAGER, OWNER) |
| Edit an item (name, category, reorder level; the unit only before its first movement); archive an item with no stock | `INVENTORY.edit` |
| Approve or reject a stock count (this posts the adjustments) | `INVENTORY.approve` (MANAGER, OWNER) |
| Export CSV | `INVENTORY.export` |

Every screen also needs the `inventory` module flag, which becomes live.

## Sections

- **§1 Items, the stock ledger and stock counts.**
  - `StockItem`: quantities stored in thousandths, as integers.
  - `StockMovement`: append-only; one row per receive, issue, waste or adjustment, with signed quantity and value changes. The item's on-hand quantity and value are updated with the item row locked; database checks keep both from going negative.
  - `StockCount` and its lines: submitted with the book quantity snapshotted (never shown to the counter), then approved (adjustments posted) or rejected by a manager.
  - Actions are idempotent and audited.
- **§2 Screens and export.**
  - `/admin/inventory`: stock list, low-stock filter, search.
  - `/admin/inventory/[id]`: item details and history.
  - `/admin/inventory/move`: multi-line receive, issue or waste.
  - `/admin/inventory/counts` and `/counts/[id]`: counts and their approval.
  - `/api/admin/inventory/export`: CSV.
  - Sidebar "Inventory"; STOREKEEPER lands on it; the daily sheet's owner summary shows low stock and counts awaiting approval.
- **§3 Verification report.**

## Not in Phase D

- Purchase orders and suppliers (Phase E).
- Recipe-based deduction from room service.
- Several stores.
- Department requests (requisitions).
- Expiry or batch tracking.
- Email alerts.

# Phase C §3: verification report

Branch `phase-c-room-service`, from `main` at `2a46543` (Phase B2 merged).

| § | Commit | What |
|---|---|---|
| 1 | `a0a3b36` | Menu and orders: schema, rules, charge on delivery, check-out waits for open orders; plan (00-PLAN.md) |
| 2 | `1c8ab86` | Screens: board, new order, menu; sidebar; localized folio line |

## Summary

**Room service end to end:**
- A manager keeps the menu (EN and BN names, categories, prices); the kitchen marks dishes sold out.
- The desk takes an order for a checked-in room.
- The kitchen works the tickets on a phone or tablet: start → ready → delivered.
- Delivery puts one charge on the guest's folio. An order cancelled before delivery is never charged.
- Check-out waits until every order of the stay is delivered or cancelled.

**Owner decisions applied (2026-10-09):**
- menu, orders and the kitchen board;
- charged on delivery;
- in-house guests only.

**Permission matrix:** unchanged. Every action maps to the existing `ROOM_SERVICE` grants (00-PLAN.md). The sidebar gains "Room Service"; KITCHEN now has a landing page.

**Module flag:** `roomService` is live in Settings > Modules.

**Migration:** one, additive: `20261010100000_room_service`. It applies cleanly to a fresh `resort_test` and to `resort_dev`, and `prisma migrate diff` shows no drift.

## Gates (at `1c8ab86`)

| Gate | Result |
|---|---|
| `pnpm lint` (ESLint, guard scripts, money check) | 0 problems |
| i18n parity | OK |
| `pnpm test` | 720 passed (595 DB tests skipped without a `*_test` DB) |
| Full suite on a fresh `resort_test` | 1,314 passed, 1 skipped (the migrations check) |
| `pnpm test:db` | 240 passed |
| `pnpm build` | Clean. New dynamic pages: `/admin/room-service`, `/new`, `/menu`. Public pages are unchanged. |
| Gateway suites, each on a fresh `resort_test` (the booking actions changed) | Nagad 255, SSLCommerz 334, bKash 157, BanglaQR 96: all passed |
| Live: production build, scratch DB, 360px | MANAGER and FRONT_DESK in English, KITCHEN and FRONT_DESK in Bengali (01 §2) |

**New test files:**
- `room-service/room-service.db.test.ts` (5)
- `room-service/orders.test.ts` (3)

**Updated test files:**
- `permission-enforcement.test.ts`: 6 new actions × every role.
- `permissions.test.ts`, `module-flags.test.ts`: sidebar and landing pages.
- `modules.db.test.ts`: room service is now live.

## Found and fixed during Phase C

| # | Problem | Fix |
|---|---|---|
| FC-1 | The kitchen's delivery confirmation showed the bill amount, though the board hides money from the kitchen. | A separate confirmation without the amount. |

## Limitations and follow-ups

| # | Limitation |
|---|---|
| L1 | **No guest ordering from the room** (QR code). The desk takes every order, by phone or in person. |
| L2 | **No outside diners or restaurant till.** Room service is for checked-in guests, charged to the room (owner decision). |
| L3 | **No VAT or service charge** lines. Menu prices are tax-inclusive until Phase F. |
| L4 | **No recipes or stock.** Selling a dish doesn't reduce kitchen stock (Phase D, inventory). "Sold out" is set by hand. |
| L5 | **No kitchen alerts.** The board refreshes every 30 seconds, with no sound or push. A ticket waiting 30 minutes or more shows its wait in red. |
| L6 | **No order edits.** To change an order, cancel it (with a reason) and place a new one. |
| L7 | **Complaints after delivery** are a manager's void of the folio line. The order itself stays "Delivered". |
| L8 | **One menu.** There are no time-of-day menus (breakfast hours) and no modifiers or add-ons. Use the kitchen note. |
| L9 | **Carried over:** the night-audit cron line must be in the server's crontab (Phase B L11). The bKash audit test flake (Phase B L13) didn't occur in this phase. |

## Not merged

`main` is unchanged. The two feature commits and this report are on `phase-c-room-service` for the owner's review.

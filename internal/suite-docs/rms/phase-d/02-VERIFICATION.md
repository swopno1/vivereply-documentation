# Phase D §3: verification report

Branch `phase-d-inventory`, stacked on `phase-c-room-service`, which sits on `hardening/production-finalization`. Merge them in that order.

| § | Commit | What |
|---|---|---|
| 1 | `c9a7c46` | Items, append-only stock ledger at weighted average cost, blind stock counts with manager approval; plan (00-PLAN.md) |
| 2 | `0c1d570` | Screens (stock list, item, move, counts) and CSV export; sidebar; daily sheet owner summary |
| fix | `01f0581` | Phase B2 follow-up: cash voids filed after a shift's count without comparing clocks |

## Summary

**Inventory:**
- The storekeeper keeps the stock list: items in EN and BN, categories, units and reorder levels. They receive deliveries (several items at once, with price and supplier), issue stock to departments, and record waste with a reason.
- **Never below zero:** an over-issue refuses the whole movement.
- **Valuation:** weighted average cost, exact to the poisha. The last unit out takes the remaining value.
- **Corrections:** stock is corrected only through a stock count that a manager approves with a reason, and never the counter's own (the OWNER excepted).
- **Elsewhere:** low stock is flagged on the list and in the daily sheet's owner summary. Stock and the movement ledger export to CSV.
- **Money:** kitchen and housekeeping see quantities, not money.

**Defaults applied:** the owner said "Continue" without a brief, so the recommended options were used (00-PLAN.md):
- one store;
- no purchase orders (Phase E);
- no recipe deduction;
- blind counts on the form, with manager approval;
- low-stock list, with no email.

**Permission matrix:** unchanged. The sidebar gains "Inventory", and STOREKEEPER now has a landing page.

**Module flag:** `inventory` is live.

**Migrations:** two, both additive:
- `20261011100000_inventory`;
- `20261011110000_cash_shift_void_order`, which replaces a trigger function only.

They apply cleanly to a fresh `resort_test` and to `resort_dev`, with no drift.

## Gates (at `01f0581`)

| Gate | Result |
|---|---|
| `pnpm lint` | 0 problems |
| i18n parity | OK |
| `pnpm test` | 730 passed (603 DB tests skipped without a `*_test` DB) |
| Full suite on a fresh, migrated `resort_test` | 1,332 passed, 1 skipped |
| `pnpm test:db` | 258 passed, twice in a row |
| `pnpm build` | Clean. New dynamic routes: `/admin/inventory`, `/[id]`, `/move`, `/counts`, `/counts/[id]`, `/api/admin/inventory/export` |
| Gateway suites, each on a fresh `resort_test` (cash code touched by the fix) | Nagad 255, SSLCommerz 334, bKash 157, BanglaQR 96: all passed |
| Live: production build, scratch DB, 360px | STOREKEEPER (EN), MANAGER (BN), KITCHEN (01 §2) |

**New test files:**
- `inventory/inventory.db.test.ts` (10)
- `inventory/stock.test.ts` (3)

**Updated test files:**
- `cash/cash.db.test.ts`: the void-ordering regression test.
- `permission-enforcement.test.ts`: 7 new guarded paths × every role.
- `permissions.test.ts` and `module-flags.test.ts`: sidebar and landing pages.
- `modules.db.test.ts`: inventory is live.

## Found and fixed during Phase D

| # | Problem | Fix |
|---|---|---|
| FD-1 | **Phase B2 bug:** one `pnpm test:db` run failed the cash "void after close" test. The void's time (rounded by Postgres) and the shift's `closedAt` (truncated through JavaScript) can tie or cross in a tight race, so a void after the count could be shown as part of it. | The close sets `closedAt` to at least the latest line on the shift, and the trigger stamps a void on a counted shift strictly after `closedAt`. Deterministic, with a regression test (`01f0581`). |
| FD-2 | "1 items at or below their reorder level". | "Items at or below their reorder level: 1." |

## Limitations and follow-ups

| # | Limitation |
|---|---|
| L1 | **Stock counts are blind only on the form.** The storekeeper sees stock levels on the list, because they need them to issue stock. The control is the manager's approval of every difference, not secrecy. |
| L2 | **No purchase orders or supplier records** (Phase E). A receipt carries the supplier's name and an invoice reference as text. |
| L3 | **Room service doesn't reduce stock.** There are no recipes yet; the kitchen's use is recorded as an issue to the kitchen. |
| L4 | **One store.** Stock issued to a department leaves inventory; there are no department sub-stores, transfers or requisitions. |
| L5 | **No expiry dates or batches**, so no first-expiry-first-out. Spoilage is recorded as waste. |
| L6 | **Low stock isn't sent anywhere.** It shows on the list and in the daily sheet; email alerts wait for the notifications engine. |
| L7 | **Stock counts don't freeze stock.** A difference is applied to stock as it is at approval. If stock issued since the count makes that negative, the approval is refused (reject and recount). |
| L8 | **Upward adjustments on an empty shelf** are valued at the last price paid, or ৳0 if the item was never received. |
| L9 | **Carried over:** the night-audit cron line must be in the server's crontab (Phase B L11). |

## Not merged

`main` is unchanged. Phase D is on `phase-d-inventory`, on top of `phase-c-room-service` and `hardening/production-finalization`.

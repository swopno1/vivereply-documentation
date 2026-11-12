# Phase E §5: verification report

Branch `phase-e-purchasing`, from `main` at `288b05b` (Phases C and D merged).

| § | Commit | What |
|---|---|---|
| 1 | `8cca4d5` | Suppliers, purchase orders with approval, receiving against an order into stock; plan (00-PLAN.md) |
| 2 | `5e03a4d` | Expenses: entered, approved or rejected by someone else, final once reviewed |
| 3 | `f0ba17f` | Purchasing screens and CSV export; sidebar; daily sheet owner summary |
| 4 | `6ba4805` | Expense screens and CSV export; sidebar; daily sheet owner summary |

## Summary

**Purchasing:**
- **Suppliers:** the storekeeper keeps the list.
- **Orders:** the storekeeper drafts an order (items, quantities, agreed prices) and submits it. A manager, the accountant or the owner approves it, or sends it back with a note; nobody approves an order they created, submitted or last edited, except the OWNER.
- **Receiving:** goods are received against the approved order, in one delivery or several. Each delivery posts to inventory at the order's price, in the same transaction; more than was ordered is refused.
- **Ending:** an order is cancelled before anything arrives, or closed short after.

**Expenses:**
- **Entering:** a manager or the accountant enters running costs (bills, fuel, repairs, …) with date, category, amount, how it was paid, and payee or supplier.
- **Approval:** someone other than whoever entered or last changed an expense approves or rejects it; a rejection needs a reason. A reviewed expense is final.
- **Reporting:** a month view shows approved and waiting totals and approved totals by category.

**Defaults applied** (00-PLAN.md): every order and every expense needs a second person's approval; receipts post at the order price; expenses never come from a front-desk cash drawer; no payables, petty cash or ledger postings (Phase F).

**Permission matrix:** unchanged. The sidebar gains "Purchasing" and "Expenses". Landing pages are unchanged; STOREKEEPER lands on Purchasing when Inventory is off.

**Module flags:** `purchase` and `expenses` are live.
- **Expenses** is on by default.
- **Purchasing** stays off by default in this template, as the brief's `brand.config.ts` block has it ("enabled per client"). An OWNER switches it on in Settings > Modules.

**Migrations:** two, both additive:
- `20261012100000_purchasing`;
- `20261012110000_expenses`.

They apply cleanly to a fresh `resort_test` and to `resort_dev`, and `prisma migrate diff` shows no drift.

## Gates (at `6ba4805`)

| Gate | Result |
|---|---|
| `pnpm lint` (ESLint, guard scripts, money check) | 0 problems |
| i18n parity | OK |
| `pnpm test` | 751 passed (616 DB tests skipped without a `*_test` DB) |
| Full suite on a fresh, migrated `resort_test` | 1,366 passed, 1 skipped (the migrations check). This includes the four gateway suites; no payment code changed in this phase. |
| `pnpm test:db` | 292 passed, twice in a row |
| `pnpm build` | Clean. **New dynamic routes:** `/admin/purchasing`, `/new`, `/[id]`, `/[id]/edit`, `/[id]/receive`, `/suppliers`, `/admin/expenses`, `/new`, `/[id]`, `/api/admin/purchasing/export` and `/api/admin/expenses/export`. |
| Live: production build, scratch DB, 360px | STOREKEEPER (BN and EN), MANAGER (BN), ACCOUNTANT (EN), AUDITOR (EN): see 01-PURCHASING.md §3 and 02-EXPENSES.md §2 |

**New test files:**
- `purchasing/purchasing.db.test.ts` (8)
- `purchasing/constants.test.ts` (3)
- `expenses/expenses.db.test.ts` (5)
- `expenses/constants.test.ts` (2)

**Updated test files:**
- `permission-enforcement.test.ts`: 16 new guarded paths × every role.
- `permissions.test.ts`, `module-flags.test.ts`: sidebar and landing pages.
- `modules.db.test.ts`: the "not built" example is now payroll.

## Found and fixed during Phase E

| # | Problem | Fix |
|---|---|---|
| FE-1 | A submitted order showed "received 0 kg" before anything could arrive. | Received quantities show once the order is approved. |
| FE-2 | With only an order awaiting approval, "Open orders" said "No open orders." under it. | That empty card is hidden while orders await approval. |

## Limitations and follow-ups

| # | Limitation |
|---|---|
| L1 | **No payables.** Supplier bills, what is owed to each supplier and payments to suppliers wait for Phase F (finance). A delivery records the supplier's invoice number only. |
| L2 | **The order price is the receipt price.** If the supplier charges differently, the difference is the accountant's (Phase F), or the order is closed short and re-ordered. There is no purchase price variance. |
| L3 | **No petty cash.** Expenses record how they were paid but post nowhere: not to a cash drawer, bank or ledger. |
| L4 | **No attachments.** No photo of a bill or receipt; the reference field carries its number. |
| L5 | **No approval limits.** Every order and expense needs a second person, whatever the amount; there are no "under ৳500 needs no approval" rules or budgets. |
| L6 | **No requisitions.** Departments don't request stock through the system; the storekeeper orders directly. |
| L7 | **No sending.** Purchase orders aren't emailed or printed for the supplier; the order page and the CSV are the record. |
| L8 | **Purchasing is off by default** in this template (brief §7). Switch it on in Settings > Modules. |
| L9 | **Carried over:** the night-audit cron line must be in the server's crontab (Phase B L11). |

## Not merged

`main` is unchanged. Phase E is on `phase-e-purchasing` (from `main` at `288b05b`) for the owner's review.

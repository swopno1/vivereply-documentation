# Phase F: finance and accounting

Branch `phase-f-finance`, from `main` at `3357500` (Phase E merged).

The `FINANCE` module's new screens, behind the `accounting` and `finance` flags (Phase F in `01-ROLES-AND-PERMISSIONS.md`).

The Phase A2/B rules still apply:
- Additive migrations only.
- No route path changes.
- No new runtime dependencies.
- Fail closed, and audit every write.
- Every screen in EN and BN, working at 360px.
- One commit per section.
- `pnpm lint` and `pnpm build` before each commit.

The payment code is not touched: the ledger **reads** payments, refunds and folio lines; it never writes to them.

## Defaults applied (2026-10-09)

The owner asked for "finance and accounting, including what's owed to suppliers, petty cash and journal entries" without further choices. These are the recommended defaults, in line with earlier phases (a second person approves money going out). Each is easy to change.

| Topic | Default |
|---|---|
| Books | **Double entry, in poisha.** A chart of accounts suited to a small resort is created by the migration (cash, bank, mobile wallet, guest balances, stock, owed to suppliers, revenue by kind, costs, and one expense account per Phase E expense category). The accountant can add accounts and rename them; nothing is deleted. |
| Journal entries | **Append-only and always balanced:** the database refuses an entry whose debits and credits differ, and never changes or deletes one. A mistake is corrected by a reversing entry. |
| Manual journals | **Entered by the accountant, posted when someone else approves them** (the OWNER excepted), like stock counts and expenses. Opening balances are a manual journal on the books' start date. |
| Automatic postings | Everything the resort already records posts itself, idempotently, from the **books start date** onward. **Folio:** room nights, charges, discounts, desk payments and refunds. **Online payments:** online payments and refunds. **Stock:** stock received, used, wasted and counted. **Spending:** approved expenses and cash-drawer differences. **Runs:** hourly (`/api/cron/ledger-posting`) and from a "Post now" button. |
| Owed to suppliers | **Supplier bills** turn received goods (or other costs) into what is owed. The order price was already in stock, so any difference on the bill goes to "purchase price differences". **Supplier payments** are entered against bills and **post only when someone else approves them**. Each supplier has a balance and an ageing view. |
| Petty cash | An account like any other. **Topping up** is a transfer (for example from the bank). **Cash expenses** (Phase E, paid in cash) come out of petty cash. **Counting the box:** a difference needs someone else's approval and goes to "cash over / short". |
| Transfers | Money moving between the resort's own accounts: desk cash banked, card or gateway settlement received (with the charges), petty cash topped up. Posted directly; no money leaves the business. |
| Months | **Closing a month** stops anything new being dated in it (database trigger). An approver closes a month; only the OWNER reopens one, with a reason. Anything that arrives late for a closed month is posted on the current business date with a note. |
| Reports | Trial balance, profit and loss, balance sheet, the ledger of any account, supplier balances and ageing, and the petty cash book. CSV export. |
| VAT | **Not in this phase.** Prices stay tax-inclusive as entered. VAT and supplementary duty need the client's registration details (open question, 00 §10). |

## Permissions (no matrix change)

`FINANCE`: OWNER all; MANAGER V A; ACCOUNTANT V C A X; AUDITOR V X.

| Action | Grant |
|---|---|
| See the books, reports, bills, payments and petty cash | `FINANCE.view` |
| Set the books start date; add or rename accounts; enter manual journals, supplier bills, supplier payments, transfers and petty cash counts; reverse an entry; post now | `FINANCE.create` (ACCOUNTANT, OWNER) |
| Approve manual journals, supplier payments and petty cash differences (never your own, the OWNER excepted); close a month | `FINANCE.approve` (MANAGER, ACCOUNTANT, OWNER) |
| Reopen a closed month | `FINANCE.edit` (OWNER only) |
| CSV export | `FINANCE.export` |

**Flags:**
- **`accounting`:** the books, journals, months and reports.
- **`finance`:** supplier bills, supplier payments, petty cash and transfers. It needs `accounting` on too.

Both become live but stay **off by default** in this template, as the brief's `brand.config.ts` block has them. The existing gateway payment admin keeps working whatever the flags say (01 §3 note 1).

## Sections

- **§1 The books.** Accounts, journal entries and lines (balanced, append-only), months and their closing, the books start date, manual journals with approval, reversals.
- **§2 Automatic postings.** Posting rules for folio lines, online payments and refunds, stock movements, approved expenses and cash-drawer differences; idempotent sweep; cron route and "Post now".
- **§3 Suppliers, petty cash and transfers.** Supplier bills (against received goods or other costs), supplier payments with approval and allocation to bills, petty cash counts, transfers.
- **§4 Screens.** Finance home, journals, accounts and their ledgers, months, payables, petty cash, transfers.
- **§5 Reports.** Trial balance, profit and loss, balance sheet, ageing; CSV export.
- **§6 Verification report.**

## Not in Phase F

- VAT, supplementary duty and tax invoices.
- Bank statement import and reconciliation, and gateway settlement matching (transfers record settlements by hand).
- Budgets, fixed assets and depreciation, payroll postings (Phase G), multi-currency.
- Year-end closing entries (the balance sheet shows profit to date instead).

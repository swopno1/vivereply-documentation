# Phase E: purchasing and expenses

Branch `phase-e-purchasing`, from `main` at `288b05b` (Phases C and D merged).

The `PURCHASE` and `EXPENSE` modules, listed as Phase E in `01-ROLES-AND-PERMISSIONS.md`.

The Phase A2/B rules still apply:
- Additive migrations only.
- No route path changes.
- No new runtime dependencies.
- Fail closed, and audit every write.
- Every screen in EN and BN, working at 360px.
- One commit per section.
- `pnpm lint` and `pnpm build` before each commit.

## Defaults applied (2026-10-09)

The owner asked to continue with "purchase orders, suppliers and expenses" without further choices. These are the recommended defaults, in line with earlier decisions (manager approval of stock counts and cash differences, never your own). Each is easy to change.

| Topic | Default |
|---|---|
| Suppliers | A simple supplier list: name, contact person, phone, email, address, note. Archived, never deleted. No supplier balances or payments (Phase F, payables). |
| Purchase orders | **Every order is approved before it goes out.** The storekeeper drafts it (supplier, items, quantities, agreed prices) and submits it. A manager, the accountant or the owner approves it or sends it back with a note. Nobody approves an order they created or last edited, except the OWNER. |
| Receiving | Goods arrive **against an approved order**, in one delivery or several. Each delivery posts a stock receipt to inventory at the **order's agreed price**, so stock value can't be changed at the door. More than was ordered is refused. An order that will never be completed is closed short by an approver, with a reason. |
| Stock without an order | Inventory's "Receive stock" stays for small cash buys at the market. Purchase orders are the controlled route, not the only one. |
| Expenses | Running costs that aren't stock: electricity, fuel, repairs, transport, and so on. **Every expense is approved by someone other than whoever entered or last changed it** (the OWNER excepted). Rejected expenses stay on record. |
| Paying | Expenses record how they were paid (cash, bank, bKash, Nagad, card, cheque). They are **not** taken from a front-desk cash drawer: the desk drawer holds guest money only (Phase B2). Petty cash is a Phase F account. |
| Reports | Month view of expenses by category; purchase orders and expenses export to CSV. The daily sheet's owner summary counts orders and expenses waiting for approval. |

## Permissions (no matrix change)

`PURCHASE`: OWNER all; MANAGER V C E A X; STOREKEEPER V C E; ACCOUNTANT V A X; AUDITOR V X.
`EXPENSE`: OWNER all; MANAGER V C E A; ACCOUNTANT V C E A X; AUDITOR V X.

| Action | Grant |
|---|---|
| See suppliers and purchase orders | `PURCHASE.view` |
| Add a supplier; draft and submit a purchase order | `PURCHASE.create` (STOREKEEPER, MANAGER, OWNER) |
| Edit or archive a supplier; edit or cancel a draft or submitted order; receive goods | `PURCHASE.edit` |
| Approve or send back an order; cancel an approved order with nothing received; close an order short | `PURCHASE.approve` (MANAGER, ACCOUNTANT, OWNER) |
| Export purchase orders | `PURCHASE.export` |
| See expenses | `EXPENSE.view` |
| Enter an expense | `EXPENSE.create` (MANAGER, ACCOUNTANT, OWNER) |
| Change an expense not yet reviewed | `EXPENSE.edit` |
| Approve or reject an expense | `EXPENSE.approve` |
| Export expenses | `EXPENSE.export` (ACCOUNTANT, OWNER) |

Every screen also needs its module flag (`purchase`, `expenses`), which become live. `brand.config.ts` keeps this template's defaults from the brief: `expenses` on, `purchase` **off** ("enabled per client"). An OWNER switches Purchasing on in Settings > Modules.

## Sections

- **§1 Suppliers and purchase orders.** `Supplier`, `PurchaseOrder` (`PO-YYYYMM-NNNN`), its lines, and `PurchaseReceipt` with lines, each receipt line linked to the stock movement it posted. Database checks and triggers keep the status fields consistent, received quantities within what was ordered, and receipts append-only. Actions are idempotent and audited.
- **§2 Expenses.** `Expense` (`EX-YYYYMM-NNNN`): date, category, amount, how it was paid, payee or supplier, reference; submitted, then approved or rejected and final.
- **§3 Purchasing screens.** `/admin/purchasing` (orders), `/new`, `/[id]` (detail, approval, receiving), `/[id]/edit`, `/suppliers`; CSV export; sidebar "Purchasing".
- **§4 Expense screens.** `/admin/expenses` (month view, approvals), `/new`, `/[id]`; CSV export; sidebar "Expenses"; daily sheet owner summary.
- **§5 Verification report.**

## Not in Phase E

- Supplier bills, payables and payments to suppliers; petty cash; journal postings (Phase F, finance).
- Receipt photos or attachments (needs the storage review; the expense's reference field carries the bill number).
- Budgets and budget-versus-actual (Phase F).
- Requisitions from departments, and purchase price variance (the order price is the receipt price).
- Recurring expenses.

# Phase F §4: finance screens

Every page needs `FINANCE.view` and the `accounting` flag. The payables and petty cash pages also need the `finance` flag. A sub-menu on every page (scrolling sideways on a phone) links Overview, Journal entries, Chart of accounts, Owed to suppliers, Petty cash and transfers, Reports and Months. The two `finance` pages are hidden while that flag is off.

| Page | Who | What |
|---|---|---|
| `/admin/finance` | `FINANCE.view` | **Start the books:** before a start date is set, `create` sees the date form; everyone else is told the accountant or owner sets it. **Afterwards:** the start date, how many records are waiting to be posted, and "Post now" (`create`) with the result. **Balances:** every money account (each linking to its ledger), guest balances, owed to suppliers and the overdue amount. **Waiting for approval:** manual journals, supplier payments and petty cash counts, with links. |
| `/admin/finance/journals` | `FINANCE.view` | Manual journals waiting, then the latest 100 entries (filter by source), each with number, date, source, total and "Reversed". "New journal" (`create`). |
| `/admin/finance/journals/new` | `FINANCE.create` | **Header:** date (from the start date to today), memo, and "Opening balances", which fixes the date to the start date. **Lines:** account, debit or credit, memo, and a supplier when the account is "owed to suppliers". **Live check:** debits, credits and "Balanced" or "Out by ৳…". Submitting goes to the journal's page. |
| `/admin/finance/manual/[id]` | `FINANCE.view` | **The journal:** its lines and status, and who submitted and reviewed it. **Approval:** approve, or reject with a note (`approve`, never your own; the submitter sees why they can't). A posted journal links to its entry. |
| `/admin/finance/journals/[id]` | `FINANCE.view` | **The entry:** lines (each account links to its ledger), source, who posted it, and what it reverses or is reversed by. **"Reverse this entry"** with a reason (`create`, manual entries and transfers only). Other entries say they are corrected where they came from. |
| `/admin/finance/accounts` | `FINANCE.view` | **The chart:** accounts by type, each with its balance in its own direction (red when against it) and "Used by automatic postings" on system accounts. **Changes** (`create`): add (code, type, names, "holds money" for assets), rename, archive (not system accounts; zero balance). |
| `/admin/finance/accounts/[id]` | `FINANCE.view` | **The ledger:** from and to dates (default this business month), brought forward, then every line with its entry, memo, supplier, debit or credit and running balance. |
| `/admin/finance/months` | `FINANCE.view` | **Months:** the current month and up to twelve before it, from the start date: open or closed, who closed or reopened it and why. **Close** (`approve`, finished months only, confirmed). **Reopen** with a reason (`edit`: OWNER). |
| `/admin/finance/payables` | `FINANCE.view` + `finance` | **Lists:** payments waiting for approval; what's owed by supplier (advances shown as such); open bills by due date (overdue in red) with open and waiting amounts; recent payments. "Enter a bill" and "Pay a supplier" (`create`). |
| `/admin/finance/payables/bills/new` | `FINANCE.create` | **Header:** supplier, the supplier's invoice number, note, bill and due dates. **Lines:** the supplier's deliveries not yet billed (tick to include; the billed amount starts at the order-price value), and other costs on allowed accounts. Live total. |
| `/admin/finance/payables/bills/[id]` | `FINANCE.view` | **The bill:** lines (deliveries show their order-price value), total, paid, waiting and open, payments against it, who entered it, and its journal entry. **"Void bill"** with a reason (`approve`, only with nothing paid or waiting). |
| `/admin/finance/payables/payments/new` | `FINANCE.create` | **Payment:** supplier, date, amount, method. "Paid from" offers money accounts except the desk drawer, defaulting by method (cash → petty cash, bank or cheque → bank, bKash or Nagad → wallet). Reference, note. **Allocation:** the supplier's open bills, each with a button that fills its open amount; allocated and advance shown. |
| `/admin/finance/payables/payments/[id]` | `FINANCE.view` | **The payment:** allocations, any advance, who entered and reviewed it, its journal entry. **Approve,** or reject with a note (`approve`, never your own). **"Void payment"** with a reason (`approve`, approved payments). |
| `/admin/finance/petty-cash` | `FINANCE.view` + `finance` | **Balance:** petty cash. **Waiting counts:** counted, books and difference; approve or reject with a reason (`approve`, never your own). **Count the box** (`create`): a match says so. **Move money** (`create`): from, to, amount, charges, date, what it was. **History:** recent petty cash entries, counts and transfers. |

**Sidebar:** "Finance" (`FINANCE.view` plus the `accounting` flag), after Expenses.
- **Who sees it:** OWNER, MANAGER, ACCOUNTANT and AUDITOR.
- **Landing pages:** unchanged (ACCOUNTANT still lands on the dashboard).
- **Docs:** `01-ROLES-AND-PERMISSIONS.md` §6 is updated.

**Module flags:** `accounting` and `finance` are live in Settings > Modules, both off by default in this template (the brief's values).

**Tap targets:** every link, button and input is at least 44px.

**Phone width:** forms stack to one column at 360px, and the sub-menu scrolls sideways.

The live check at 360px is in `06-VERIFICATION.md`.

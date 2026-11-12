# Phase F §5: reports

`/admin/finance/reports` (`FINANCE.view`, `accounting` flag): one page with four tabs. The arithmetic is in pure functions in `src/lib/ledger/reports.ts`, unit-tested on a small hand-made set of books.

| Report | Dates | What |
|---|---|---|
| Trial balance | As of a date | **Rows:** every account with a balance, on its side (debit or credit), each linking to its ledger. **Check:** totals of both sides and "Balanced". |
| Profit and loss | From and to (default this business month) | **Income:** in its own direction; discounts given show as negative income. **Expenses:** each account. **Result:** profit or loss. |
| Balance sheet | As of a date | **Sides:** assets, then liabilities and equity. **Profit to date:** all income less all expenses up to the date, shown with equity (there are no year-end closing entries). **Check:** "Balanced" when both sides agree. |
| Supplier ageing (`finance` flag) | As of a date | **Per supplier:** what is still open on bills dated up to the date, by days past the due date: not yet due, 1–30, 31–60, 61–90, over 90 days late. Payments waiting for approval still count as open. **Totals:** for each bucket. |

**Warnings:** when records are still waiting to be posted (§2), the page says how many, so a report is never read as complete when it isn't.

**At 360px:** tabs and the finance menu scroll sideways. Trial balance rows show one amount labelled "Debit" or "Credit" rather than two columns.

## CSV export

`GET /api/admin/finance/export` (`FINANCE.export`: ACCOUNTANT, OWNER, AUDITOR):
- `type=trial|balance|ageing` with `to`;
- `type=pnl` with `from` and `to`;
- `type=journal` with `from` and `to`: every journal line in the range, with entry number, source, memo, account, debit, credit, supplier and who posted it.

**Checks:** a bad type or date is a 400. Ageing also needs the `finance` flag.

**Format:** formula-safe cells and a UTF-8 BOM. Each download is audited as `FINANCE_EXPORTED`.

## Tests

- **`src/lib/ledger/reports.test.ts`:**
  - **Trial balance:** sides and equal totals.
  - **Profit and loss:** a discount reduces income.
  - **Balance sheet:** assets equal liabilities, equity and profit to date.
  - **Ageing:** bucket edges.
- **`src/lib/ledger/reports.db.test.ts`** (whatever the other test files have posted):
  - **Agreement:** the trial balance balances; the balance sheet balances; profit to date on the balance sheet equals profit and loss from the beginning.
  - **Export:** each of the five exports downloads with a BOM; a memo starting with `=` is neutralised; the downloads are audited.
  - **Refused:** a range without `from` and an unknown type are 400; the manager can't export.
- **`permission-enforcement.test.ts`:** the export × every role.

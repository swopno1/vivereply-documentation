# Phase F §1: the books

Double entry, in poisha. Every entry is balanced and written once; mistakes are corrected by reversing entries.

## 1. Data and rules

Migration `20261013100000_ledger` (additive; it also adds `Settings.ledgerStartDate` and creates the starting chart of accounts):

| Table | What | Integrity |
|---|---|---|
| `LedgerAccount` | Code, name (EN, optional BN), type (asset, liability, equity, income, expense), system key, holds money (yes/no) | **Code:** 4 to 6 digits, unique. **Fixed:** code, type and system key never change (trigger). **Never deleted:** archived only, and only when its balance is zero and it isn't a system account. |
| `JournalEntry` | `JE-YYYYMM-NNNNN` (entry month plus a monthly `Sequence`), entry date, memo, source (manual, automatic, supplier bill, supplier payment, transfer, petty cash count, reversal), source key, the entry it reverses, who posted it and when | **Balanced:** a deferred trigger checks at commit that each entry has at least two lines, that debits equal credits, that every line carries the entry's date, and that every accounts-payable line names a supplier. **Open months only:** nothing is dated in a closed month (trigger). **One entry per source** (unique source key), and a reversal reverses exactly one entry. **Append-only:** never changed or deleted. |
| `JournalLine` | Account, debit or credit (exactly one above zero), memo, supplier | Check on the amounts; append-only. |
| `AccountingPeriod` | A month (`YYYY-MM`): open or closed, who closed it, who reopened it and why | A month with no row is open. Never deleted. |
| `ManualJournal`, `ManualJournalLine` | A journal the accountant typed in: date, memo, opening balances (yes/no), lines; who submitted and reviewed it; the entry it posted | **Review fields** are set exactly when it is reviewed. **Posted** journals have their entry; **rejected** ones have a reason. **Final once reviewed**; what was submitted never changes; lines are append-only (triggers). |

### The starting chart of accounts

| Code | Account | System key |
|---|---|---|
| 1000 | Front desk cash | `DESK_CASH` (money) |
| 1010 | Petty cash | `PETTY_CASH` (money) |
| 1020 | Bank account | `BANK` (money) |
| 1030 | bKash / Nagad merchant wallet | `MOBILE_WALLET` (money) |
| 1040 | Card payments to be settled | `CARD_CLEARING` (money) |
| 1050 | Online payments to be settled | `GATEWAY_CLEARING` (money) |
| 1090 | Payments to identify | `SUSPENSE` |
| 1100 | Guest balances | `GUEST_RECEIVABLE` |
| 1200 | Stock in store | `INVENTORY` |
| 2000 | Owed to suppliers | `ACCOUNTS_PAYABLE` |
| 2010 | Goods received, bill not entered | `GOODS_NOT_BILLED` |
| 3000 | Owner's capital | `OWNER_EQUITY` |
| 4000 | Room revenue | `ROOM_REVENUE` |
| 4100 | Room service (food and drinks) | `FOOD_REVENUE` |
| 4200 | Other guest charges | `OTHER_GUEST_INCOME` |
| 4900 | Discounts given | `DISCOUNTS` |
| 5000 | Stock used | `STOCK_USED` |
| 5100 | Stock losses (waste and counts) | `STOCK_LOSSES` |
| 5200 | Purchase price differences | `PRICE_DIFFERENCE` |
| 5300 | Cash over / short | `CASH_OVER_SHORT` |
| 6000–6090 | One account per Phase E expense category: utilities, fuel, repairs, transport, supplies, marketing, staff welfare, fees and taxes, bank charges, other | `EXPENSE_<CATEGORY>` |

The accountant can add accounts (a second bank account, a loan, fixed assets) and rename any account, in English and Bengali.

### Who does what

No matrix change. The `FINANCE` row grants: OWNER all; MANAGER V A; ACCOUNTANT V C A X; AUDITOR V X.

| Action | Grant |
|---|---|
| `setLedgerStartDateAction`: the first business date the books cover. Set once, before any entry exists; not in the future. | `FINANCE.create` |
| `saveLedgerAccountAction` (add or rename), `archiveLedgerAccountAction` | `FINANCE.create` |
| `submitManualJournalAction` | `FINANCE.create` |
| `reviewManualJournalAction` (post, or reject with a reason) | `FINANCE.approve`, never your own (`own_journal`), the OWNER excepted |
| `reverseJournalEntryAction` (a manual entry or a transfer; once; on the business date; with a reason) | `FINANCE.create` |
| `closeMonthAction` | `FINANCE.approve` |
| `reopenMonthAction` (with a reason) | `FINANCE.edit` (OWNER only) |

**Audited:**
- `LEDGER_START_DATE_SET`;
- `LEDGER_ACCOUNT_ADDED`, `_UPDATED` (before and after) and `_ARCHIVED`;
- `MANUAL_JOURNAL_SUBMITTED`, `_POSTED` and `_REJECTED`;
- `JOURNAL_ENTRY_REVERSED`;
- `MONTH_CLOSED` and `MONTH_REOPENED`.

### Rules

- **Posting:** every entry goes through `postEntry()` (`src/lib/ledger/post.ts`).
  - Lines are netted to one side and zero lines dropped.
  - The rest must balance, in an open month.
  - The number comes from the entry month's sequence.
  - **Idempotent:** an entry with a source key that was already posted returns the first.
- **Manual journals:**
  - **Lines:** balanced; amounts up to ৳2 crore a line (the columns are 32-bit; a larger opening balance is split over lines); active accounts; a supplier on any accounts-payable line.
  - **Date:** from the books start date to today's business date, in an open month.
  - **Opening balances** are a manual journal marked "opening", dated exactly on the start date.
  - **Double submits:** one per submit (idempotency key).
  - **Posting:** someone else approves it.
- **Reversals:** only manual entries and transfers. Entries posted automatically, from bills or from supplier payments are corrected where they came from (a folio void, a bill void, a payment void), so the books never disagree with the desk or the store.
- **Months:**
  - **Closing:** only a month before the current business month, and not while a manual journal dated in it is waiting.
  - **After closing:** anything new for that month is refused by the database. Automatic postings that arrive late are dated on the current business date (§2).
  - **Reopening:** OWNER only, with a reason.

## Tests

**`src/lib/ledger/ledger.db.test.ts`:**
- **Start date:** set once; not in the future; not by the manager.
- **Accounts:**
  - the 30 system accounts exist;
  - the accountant adds one; a duplicate or malformed code is refused;
  - renaming keeps the code and type;
  - system accounts, and accounts with a balance, can't be archived; once the balance is back to zero it can;
  - the database refuses changing the code and deleting;
  - the manager can't add.
- **Manual journals:**
  - unbalanced, before the start date, an "opening" journal off the start date, a payable without a supplier and a two-sided line are all refused;
  - a double submit records one;
  - the submitter can't post it and the auditor can't review it;
  - the manager posts it, giving entry `JE-202104-…` with both lines;
  - a rejection needs a reason and posts nothing.
- **Reversal:**
  - a transfer is reversed with its sides swapped, once;
  - an automatic entry can't be reversed here.
- **Months:**
  - a month not yet over can't close, nor one with a journal waiting;
  - once closed, a manual journal, `postEntry()` and a direct insert dated in it are all refused;
  - the manager can't reopen; the OWNER reopens with a reason.
- **Database:** an unbalanced entry, a one-line entry, a two-sided line, a payable without a supplier, and changing or deleting entries and lines are all refused.

**`src/lib/ledger/constants.test.ts`:** entry numbers, debit-normal types, natural balances.

**`permission-enforcement.test.ts`:** 8 new actions × every role.

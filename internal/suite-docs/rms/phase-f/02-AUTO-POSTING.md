# Phase F §2: automatic postings

Everything the resort already records posts itself to the books, from the books start date on. No migration: the sweep only **reads** the source tables. The payment, folio, stock and expense code is unchanged.

## Posting rules

| Source (source key) | Date | Debit | Credit |
|---|---|---|---|
| Folio room night (`folio:<id>`) | Its business date | Guest balances | Room revenue |
| Folio extra charge | Its business date | Guest balances | Room service (food and drinks) for room service, food and minibar; otherwise other guest charges |
| Folio discount | Its business date | Discounts given | Guest balances |
| Folio desk payment | Its business date | Money by method: cash → front desk cash; card → card payments to be settled; bKash / Nagad → merchant wallet; bank transfer → bank; other → payments to identify | Guest balances |
| Folio desk refund | Its business date | Guest balances | Money by method (as above) |
| Folio void (a reversal line) | Its business date | The original line's sides, swapped | |
| Online payment (`payment:<id>`): bKash, Nagad, SSLCommerz, BanglaQR; succeeded, including ones later refunded | The property-time date it was paid | Online payments to be settled | Guest balances |
| Online refund, completed (`bkash-refund:`, `nagad-refund:`, `sslcommerz-refund:<id>`) | The property-time date it completed | Guest balances | Online payments to be settled |
| Stock received (`stock:<id>`) | Its business date | Stock in store | Goods received, bill not entered (cleared by the supplier bill, §3) |
| Stock issued to a department | Its business date | Stock used | Stock in store |
| Stock wasted | Its business date | Stock losses | Stock in store |
| Stock count adjustment | Its business date | Up: stock in store. Down: stock losses | The other one |
| Approved expense (`expense:<id>`) | Its expense date | The expense category's account (6000–6090) | Cash → petty cash; bank, cheque or card → bank; bKash / Nagad → merchant wallet |
| Cash drawer difference, signed off (`cash-shift:<id>`) | The property-time date the shift closed | Over: front desk cash. Short: cash over / short | The other one |

**Amounts:**
- Folio lines, payments and refunds post their amount.
- Stock movements post their value change (weighted average cost, Phase D). Movements worth ৳0 are skipped.
- Expenses post their amount. Rejected or still-waiting expenses never post.
- Cash drawer differences post the shift's variance, only after a manager signs it off. A balanced shift posts nothing.

**What the books then show:**
- **Guest balances** equals what guests owe on their folios: charges, minus discounts and payments, plus refunds.
- **Front desk cash** equals cash taken minus cash refunded, plus or minus signed-off differences. Money banked from the drawer is a transfer (§3).
- **Stock in store** equals the inventory value from the start date on.

## How it runs

`runLedgerPosting()` (`src/lib/ledger/auto.ts`):

1. Without a books start date, it does nothing (`no_start_date`).
2. It finds each source with no entry for its source key yet, dated from the start date. Online payments and refunds are dated in the property's timezone.
3. It posts each in its own transaction through `postEntry()`, oldest date first.
   - **Closed months:** a source dated in a closed month is posted on the current business date instead, with the note "(for 2022-03-10; that month is closed)".
4. It reports how many it posted, by source and late, and which failed and why. One failure doesn't stop the others.

**Safe to repeat:** running twice, or two runs at the same time, posts each source once. The unique source key refuses the second; tested with two runs in parallel.

**Triggers:**
- **Hourly:** `POST /api/cron/ledger-posting`. It uses the cron secret in the header and skips while the `accounting` module is off. It answers 500 when any source failed, so the existing cron alerting notices. The crontab line is in `docs/DEPLOYMENT.md` §7.2c.
- **"Post now":** `runLedgerPostingAction` (`FINANCE.create`), audited as `LEDGER_POSTING_RUN` with the counts. The finance screens show how many sources are waiting.

## Tests

**`src/lib/ledger/auto.db.test.ts`:**
- **A stay:**
  - a night, a room-service charge, an extra bed, a discount, a card payment and its void, a bKash desk payment, an online payment and a completed online refund;
  - after a run, guest balances is ৳2,350, exactly what the folio says is owed;
  - revenue is split by kind; the card and its void net to zero;
  - the online payment is dated in Dhaka time;
  - a line before the start date isn't posted;
  - a second run posts nothing new.
- **Stock and spending:**
  - 10 kg received at ৳120, 4 kg issued and 1 kg wasted give stock ৳600, goods not billed ৳1,200, stock used ৳480 and losses ৳120;
  - a cash fuel expense comes out of petty cash and a cheque for electricity out of the bank;
  - a waiting expense doesn't post;
  - a ৳500 short drawer posts to cash over / short.
- **Edge cases:** a folio line dated in a closed month posts on the business date with the note. Two runs in parallel post five new lines once each, with no failures.
- **Post now:** the accountant runs it and it is audited; the manager can't.

**`src/lib/ledger/auto.test.ts`:** every posting rule, money accounts by method, and income accounts by charge category.

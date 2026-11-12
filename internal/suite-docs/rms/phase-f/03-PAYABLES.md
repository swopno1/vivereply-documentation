# Phase F §3: what's owed to suppliers, petty cash and transfers

Every action here posts to the books in the same transaction as the record it writes, through `postEntry()` (§1).

## 1. Data and rules

Migration `20261013110000_payables` (additive):

| Table | What | Integrity |
|---|---|---|
| `SupplierBill` | `BILL-YYYYMM-NNNN` (bill month), supplier, the supplier's invoice number, bill and due dates, note, total, its journal entry; when voided, who did it, when, why and the reversing entry | **Due date** on or after the bill date. **Total:** ৳0.01 to ৳2 crore. **Void fields** are set exactly when void. **One open bill per supplier and invoice number** (case-insensitive partial unique index; a voided bill frees it). **Fixed:** what was billed never changes; only a void changes an open bill, and a void is final; never deleted (trigger). |
| `SupplierBillLine` | A delivery against a purchase order (with the value it went into stock at), or an account with a description; the amount billed | **Line kind:** exactly one of delivery or account. **Values:** a delivery line carries its stock value. **Amounts** above zero. Append-only. |
| `SupplierPayment` | `PAY-YYYYMM-NNNN` (payment month), supplier, date, method (cash, bank, cheque, bKash, Nagad), the money account it came out of, reference, amount, status, who entered and reviewed it, its journal entry; when voided, who, when, why and the reversing entry | **Moves:** SUBMITTED → APPROVED or REJECTED; APPROVED → VOID; the rest final. **Fields:** approved and void payments have their entry, a rejection has a reason, a void has its void fields. **Fixed:** what was paid never changes; never deleted (trigger). |
| `SupplierPaymentAllocation` | Which bills a payment settles, and how much of each | Amount above zero; append-only; one per payment and bill. |
| `PettyCashCount` | Date, counted, book balance, difference, note, status (matched, waiting, approved, rejected), who counted and reviewed it, the entry for an approved difference | **Difference** = counted − book. **Status:** matched exactly when the difference is zero; approved exactly when it has an entry; a rejection has a reason. **Final once reviewed:** the count never changes; never deleted. |

### Who does what

| Action | Grant |
|---|---|
| `createSupplierBillAction` | `FINANCE.create` |
| `voidSupplierBillAction` (nothing paid or waiting against it; with a reason) | `FINANCE.approve` |
| `submitSupplierPaymentAction` | `FINANCE.create` |
| `reviewSupplierPaymentAction` (approve, or reject with a reason) | `FINANCE.approve`, never your own (`own_entry`), the OWNER excepted |
| `voidSupplierPaymentAction` (an approved payment that didn't happen; with a reason) | `FINANCE.approve` |
| `recordTransferAction` | `FINANCE.create` |
| `submitPettyCashCountAction` | `FINANCE.create` |
| `reviewPettyCashCountAction` (approve or reject a difference, with a note) | `FINANCE.approve`, never your own, the OWNER excepted |

Every action needs both the `accounting` and the `finance` module flags.

**Audited:**
- `SUPPLIER_BILL_ENTERED` and `_VOIDED`;
- `SUPPLIER_PAYMENT_SUBMITTED`, `_APPROVED`, `_REJECTED` and `_VOIDED`;
- `TRANSFER_RECORDED`;
- `PETTY_CASH_COUNTED`, `PETTY_CASH_DIFFERENCE_APPROVED` and `PETTY_CASH_COUNT_REJECTED`.

**Dates:** every date entered (a bill, a payment, a transfer) must be a real day from the books start date to today's business date, in an open month.

### Supplier bills

A bill turns received goods, or any other cost, into what's owed to the supplier. It posts **at once**:

| Line | Debit | Credit |
|---|---|---|
| Delivery against an order | Goods received, bill not entered: the delivery's stock value | |
| The bill differs from the order price | Purchase price differences: billed − stock value (a credit when the bill is lower) | |
| Any other cost (transport, a service, goods bought without an order) | The chosen account | |
| Total | | Owed to suppliers, on that supplier |

**Rules:**
- **Accounts:** a line may charge an expense account, a non-money asset, or "goods received, bill not entered" (for stock received without an order). It may not charge money, guest balances, income or equity.
- **Deliveries:**
  - a delivery must be the supplier's own, received from the books start date on;
  - it is billed only once while that bill is open (checked under a lock on the supplier row);
  - after the delivery's stock posting (§2) and the bill, its "goods received, bill not entered" nets to zero (tested).
- **Invoice numbers:** the same invoice number can't be entered twice for a supplier.
- **Voiding** reverses the bill's entry on the business date, frees its deliveries and invoice number, and is refused while any payment is waiting or approved against it.

### Supplier payments

- **Money account:** a payment comes out of a money account: bank, petty cash, wallet, or one the accountant added. **The front-desk drawer is refused**, because it holds guest money only.
- **Allocation:** a payment is allocated to that supplier's open bills, never more than is still open on each. Payments still waiting count against the bill, so two payments can't both pay the same bill. Whatever isn't allocated is an advance: the supplier's balance goes negative.
- **Approval:** someone other than whoever entered it approves it. Approval posts on the payment date: debit owed to suppliers (that supplier), credit the money account. A rejection posts nothing.
- **Voiding** (a bounced cheque): an approved payment's entry is reversed on the business date, and its bills are open again.

### Transfers

Money moving between the resort's own money accounts:
- desk cash banked;
- card or online settlements received, less the processor's charges;
- petty cash topped up from the bank.

The amount leaves the "from" account; the "to" account receives it less any charges, which go to bank and mobile-money charges. Transfers post directly (no money leaves the business) and are reversed with `reverseJournalEntryAction` (§1). A double submit posts once.

### Petty cash

- **The account:** petty cash is account 1010.
  - **Topped up** by a transfer.
  - **Spent** by cash expenses (Phase E): approved cash expenses post out of it (§2).
  - **Supplier payments** can be made from it.
- **Counting:**
  1. The posting run (§2) goes first, so waiting cash expenses are already out.
  2. The count is compared with the book balance.
  3. A match is recorded and final.
  4. A difference waits for someone else, who approves it (cash over / short, on the business date) or rejects it so it's counted again.

### Balances

`src/lib/ledger/balances.ts` reads the books:
- **Account balances.**
- **Each bill:** paid, waiting and still open.
- **Each supplier:** what's owed, as credits minus debits on "owed to suppliers" for that supplier.

## Tests

**`src/lib/ledger/payables.db.test.ts`** (on real deliveries made through Phase E's purchasing actions):
- **Bills:**
  - a ৳1,200 delivery billed at ৳1,250, plus ৳300 transport, posts goods not billed ৳1,200, price difference ৳50, transport ৳300, and ৳1,550 owed;
  - goods not billed for that delivery nets to zero after the stock posting;
  - a double submit makes one bill;
  - refused: the same invoice number in another case, billing a delivery twice, another supplier's delivery, a money account, a date before the start, a due date before the bill;
  - the manager can't enter bills.
- **Payments:**
  - refused: from the desk drawer; over-allocated (beyond the bill, and beyond what a waiting payment leaves);
  - the submitter can't approve; the manager can, and the bank and the supplier's balance move;
  - a bill with a payment can't be voided;
  - an advance leaves the supplier at −৳300;
  - a void reverses and reopens the bill;
  - a rejection needs a reason and posts nothing.
- **Voiding a bill:** it is reversed on the business date, the supplier's balance goes back to zero, and the delivery and invoice number can be billed again. A void is final.
- **Transfers:**
  - ৳10,000 of card settlement with ৳150 charges puts ৳9,850 in the bank;
  - a double submit posts once;
  - refused: the same account, a non-money account, charges as large as the amount.
- **Petty cash:**
  - a top-up and a cash expense;
  - a count equal to the book balance is matched;
  - a ৳20 short count waits; the counter can't approve it; the manager approves and petty cash drops by ৳20;
  - the count can't be reviewed again or changed.
- **Database:** refuses changing a bill's or payment's figures, skipping a payment's approval, editing allocations and deleting a bill.

**`permission-enforcement.test.ts`:** 8 new actions × every role.

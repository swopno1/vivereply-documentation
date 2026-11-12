# Phase B §2: guest folio

**What it is:** the folio is the running bill of one booking, at `/admin/bookings/[id]/folio`. A **Folio** button on the booking page links to it.

**Who can use it:** anyone with `FRONT_DESK.view` (OWNER, MANAGER, FRONT_DESK, AUDITOR), while the `frontDesk` module is enabled. AUDITOR sees it read-only.

## 1. Where the money comes from

| On the folio | Stored in | Notes |
|---|---|---|
| Room charges, extra charges, discounts, desk payments, desk refunds | `FolioLine` (new, migration `20261008110000_folio`) | Append-only: a DB trigger refuses `UPDATE` and `DELETE`. A correction is a **reversal** line. |
| Online payments (bKash, Nagad, SSLCommerz, BanglaQR) | `Payment` rows with `source = GATEWAY` and status `SUCCESS`, `PARTIALLY_REFUNDED` or `REFUNDED` | Read, not copied. Payment code is untouched. |
| Online refunds | `BkashRefund`, `NagadRefund`, `SSLCommerzRefund` with status `COMPLETED` | Read, not copied. |

**Balance due** = charges − discounts − payments + refunds. A negative balance means the guest is in credit.

**Projected balance** also counts the room nights not yet posted. They are priced at what is left of the booking total, spread over the remaining nights, with the remainder poisha on the first nights. So the posted nights always add up to the booking total, even if a manager changes the total mid-stay.

## 2. `FolioLine`

- **Fields:**
  - `kind`: `ROOM_CHARGE`, `EXTRA_CHARGE`, `DISCOUNT`, `PAYMENT`, `REFUND` or `TAX` (BZ-H1);
  - `amountPoisha`, always more than 0 (the kind gives the direction);
  - `businessDate` (§1);
  - `nightOf` (room charges and tax lines);
  - `category` (extra charges: early check-in, late check-out, extra bed, laundry, minibar, food, other; tax lines: `VAT` or `SD`);
  - `method` and `reference` (payments and refunds);
  - `reason`, `reversalOfId`, `idempotencyKey` (unique), `createdBy`.
- **Database checks:**
  - the amount must be more than 0;
  - the business date and night must be in `YYYY-MM-DD` format;
  - a room charge must name its night;
  - a payment or refund must have a method;
  - a line can't reverse itself.
- **What the trigger enforces:** a reversal must match its original's booking, kind and amount, and a reversal can't itself be reversed. `voidFolioLineAction` adds that a line can be reversed only once.
- **No double posting:** every action carries an idempotency key from the form, scoped to the booking. Inserts use `ON CONFLICT DO NOTHING`, so a double click, a retry or a re-run of the night audit posts once.
- **Locking:** every folio write locks the booking row, so caps and room postings are checked and written without races.

## 3. Actions (`src/app/actions/folio-actions.ts`)

| Action | Needs | Rules |
|---|---|---|
| `postFolioChargeAction` | `FRONT_DESK.create` | Amount ৳0.01–৳10,00,000. "Other" needs a description. Early and late fees default to the Settings values (FU-6). |
| `recordFolioPaymentAction` | `FRONT_DESK.create` | Methods: cash, card, bKash, Nagad, bank transfer, other. Every method except cash needs a reference (transaction ID, approval code). |
| `postFolioDiscountAction` | `FRONT_DESK.approve` | Needs a reason. The total discount can't exceed the stay's charges (posted, plus nights still to post). |
| `recordFolioRefundAction` | `FRONT_DESK.approve` | Needs a reason. Pays back desk money only, up to the net desk payments. Online payments are refunded from their gateway controls. |
| `voidFolioLineAction` | `FRONT_DESK.approve` | Needs a reason. Posts the reversal; the original stays visible, struck through. |

**On a finished stay:** for a stay that is over (checked out, cancelled or no-show), only a manager can post. Every action is audited (`FOLIO_*`, module `FRONT_DESK`) and needs OWNER 2FA.

## 4. Check-out settles the folio

`updateBookingStatus(…, "COMPLETED")` now:
1. **Posts the nights already slept but not yet posted:** nights before the later of the business date and the property's calendar date, within the stay. If the night audit was skipped, the guest is still charged correctly. An early departure is charged only the nights slept.
2. **Front desk is blocked while a balance is due.** The message gives the amount and says to collect it on the folio or ask a manager.
3. **A manager can check out with a balance due only with a reason.** The reason is written to the booking log and audited as `CHECKOUT_WITH_BALANCE_DUE`. The booking page asks for it in a prompt.

## 5. Desk money from earlier flows

- **`Payment.source`** (`GATEWAY` by default; gateway code never sets it). The migration marks as `DESK`:
  - offline-sale records (`PAID`, `PARTIAL`, `UNPAID`, `PAY_AT_CHECKIN`);
  - manual refund records: status `REFUNDED` with no gateway id (no bKash `paymentId`, no Nagad or SSLCommerz `merchantInvoiceNumber`, no BanglaQR `mode`).
- **Backfill:** each `PAID` record becomes a folio payment and each manual refund a folio refund. Both are dated by the property's business day of the record, with key `legacy-payment:<id>`.
  - **Part-paid records:** these stored the booking total, not the amount received, so they aren't copied. The folio shows a notice asking the desk to record the actual amount.
- **Tested on a scratch database:**
  - **Cases:** a paid sale, a part-paid sale, an unpaid sale, a manual refund, a refunded bKash payment and a Nagad success.
  - **Result:** exactly the two desk-money lines were created, the Dhaka date was right (19:00 UTC on 1 Sep is 2 Sep), and both gateway rows stayed `GATEWAY`.
- **From now on:**
  - A new offline sale marked paid writes its folio payment in the same transaction.
  - A manual refund at cancellation writes a folio refund.
  - The booking edit form refuses to flip a desk record's status. The money is on the folio.

## 6. Dashboard fix (FB-1)

**The bug:** before Phase B, the dashboard counted every `REFUNDED` payment as money received. That included the manual refund record written at cancellation, so a ৳1,000 cash refund showed as ৳1,000 more revenue.

**Collections now:**
- Online money comes from gateway rows, less gateway refunds.
- Desk money comes from folio payments, less folio refunds, net of voids. A void counts on the day it was posted.
- "Payments by method" now shows desk methods (cash, card, …) next to the gateways. A voided payment nets out.

## 7. Tests

| Suite | Covers |
|---|---|
| `src/lib/folio/ledger.test.ts` | Signs, night lists across month ends, exact rate split, a mid-stay price change still summing to the total, totals with gateway money |
| `src/app/actions/folio.db.test.ts` (12) | Charge and payment; a double submit posting once; balance and projection; validation; permissions (front desk, auditor); discount and refund caps; void and its limits; trigger refusals; finished stays; gateway payments and refunds read-only; check-out posting slept nights and blocking front desk; manager override audited; early departure; offline sale on the folio; desk-record status flip refused |
| `src/lib/dashboard/metrics.db.test.ts` | Updated: desk money from the folio, a manual refund record not counted (FB-1), a voided card payment netting out |
| `permission-enforcement.test.ts` | The five folio actions × every role |
| `room-units.db.test.ts` | Updated: check-out now needs a settled folio |

# 09 Money-Flow Audit (accountant-oriented)

Date: 2026-11-02

This report consolidates six read-only module audits plus an independent critic
re-verification pass. All scopes were inspected read-only; no files were edited
by the auditors. Every finding below traces to cited file:line evidence or is
marked unverified. No file paths are invented: all paths come from the module
reports. Unresolved items are carried verbatim in section 5.

Sources:

- revenue-in (prior result 5): booking totals, gateway capture/verify, dedupe,
  refunds, folio reads, desk payments.
- pricing-tax (prior result 1): tax engine, rates/promos, money/deposit helpers,
  booking creation paths, folio posting math, night-audit close, ledger
  auto-posting, dashboard metrics, schema money fields.
- money-out (prior result 2): expenses, purchasing, bills, supplier payments,
  journals, transfers, petty cash, payroll, auto-posting, approvals.
- cash-ops (prior result 4): cash shifts, front-desk today, daily sheet, night
  audit, room service, business day, folio cash mechanics.
- books-reports (prior result 3): ledger posting, balances, reports, finance
  actions, cron, metrics, permissions, audit viewer.
- guards-consistency (prior result 6): permission matrix, route/action guards,
  integer-money discipline, dashboard/folio/audit reader consistency, docs
  accuracy, formatting.
- critic (prior result 7): falsification re-audit of every material claim; 14
  surviving claims, 12 breaks/gaps. Closed three prior gaps (cron auth guarded,
  BanglaQR source=GATEWAY by default, no arrow-action gate evasion).

Cross-cutting summary for the accountant: stay-level totals are consistent
across quote/charge/folio/invoice (shared pure functions + stored heads + one
reconstruction formula `total-vat-sd+discount`), and every gateway verifies
capture server-to-server with layered dedupe. The structural gaps are:
(1) Stripe refunds/disputes are invisible to folio, night audit, and ledger
while subtracted on the dashboard; (2) settlement is a manual unlinked
transfer, fees never auto-post; (3) several single-control postings bypass the
two-person rule (bills, transfers, reversals, inventory issue/waste);
(4) deposit-basis incoherence on BanglaQR static and Stripe quote;
(5) tax reporting gaps (per-night stranding, DaySummary blind to tax, extras
untaxed, FolioView projected omits unposted tax).

## 1. How money flows

### Flow 1. Direct booking revenue (quote to invoice)

Modules: rates/pricing, tax, bookings API, folio, confirmation invoice.

1. Quote: nightly seasonal rates rounded per night
   (`travel-scaffold/src/lib/rates/pricing.ts:41-61`), promo validated and
   discounted (`pricing.ts:63-76`), VAT/SD computed on the discounted base
   (`travel-scaffold/src/lib/tax/tax.ts:32-40`), deposit derived
   (`travel-scaffold/src/lib/payments/deposit.ts:11-16`). Stepper estimate uses
   the same pure functions but raw date strings and skips validity windows
   (`BookingStepper.tsx:108-114`).
2. Booking create: server recomputes subtotal, promo, tax, deposit and stamps
   `totalAmountPoisha + vatPoisha + sdPoisha + promoCode + discountPoisha +
   depositPoisha` in one transaction with idempotency-key replay
   (`travel-scaffold/src/app/api/bookings/route.ts:187-289`;
   `travel-scaffold/prisma/schema.prisma:332-383`).
3. Charge basis: gateways charge `dueNowPoisha` (stamped deposit clamped to
   total, NULL = full) and the client amount must equal it exactly
   (`deposit.ts:19-23`; e.g. `stripe/create/route.ts:68-71`).
4. Capture verified server-to-server only (redirects never move money): bKash
   execute + Query (`execute-payment.ts`, `reconcile.ts`), Nagad Verify
   (`verify-payment.ts:71-77`), SSLCommerz Validator (`validate-payment.ts`),
   Stripe signed webhook (`adapter.ts:94-108`, `webhook.ts`), BanglaQR admin
   verify or bank webhook (`verification.ts`, `webhook-processor.ts`).
5. Settlement under booking lock with amount/invoice/trxID/paidElsewhere checks
   -> `Payment SUCCESS` + `Booking CONFIRMED` + log; mismatches park in
   `REVIEW_REQUIRED` (e.g. `bkash/execute-payment.ts:240-331`).
   Exception: Stripe webhook has no lock/paidElsewhere check and its booking
   confirm silently no-ops on non-PENDING bookings (MF-H1).
6. Folio accrues the bill: room nights + proportional tax + one promo discount
   as append-only idempotent lines (`folio.ts:241-352`); gateway SUCCESS
   payments read as negative entries; balance =
   charges-discounts-payments+refunds (`ledger.ts:73-81`).
7. Invoice renders stored heads verbatim, derives subtotal as
   `total-vat-sd+discount` (`ConfirmationClientView.tsx:160-179`).
8. Variants: staff offline bookings and PMS webhook bookings treat the entered
   total as tax-inclusive and back heads out via `splitInclusiveTotal`
   (`admin-actions.ts:139-142`, `pms/[provider]/route.ts:210-213`); self-modify
   reprices at current rates (`self-modify/route.ts:94-115`).

### Flow 2. Gateway settlement (capture to bank)

Modules: gateway payments, ledger sweep, transfers, reports.

1. Captured payments sit as `Payment` rows (`source=GATEWAY`, status SUCCESS /
   PARTIALLY_REFUNDED / REFUNDED;
   `travel-scaffold/prisma/schema.prisma:395-471`).
2. Hourly cron (or Post-now) sweeps them into the ledger as
   `GATEWAY_CLEARING dr / GUEST_RECEIVABLE cr`
   (`travel-scaffold/src/lib/ledger/auto.ts:177-185`; cron
   `route.ts:14-34`, Post-now `ledger-actions.ts:345-353`).
3. Settlement is a manually recorded TRANSFER from clearing to bank, optionally
   with a fee to `EXPENSE_BANK_CHARGES`
   (`finance-actions.ts:394-438`). There is no batch matching, no
   payment-to-transfer link, and gateway/processor fees never auto-post
   (MF-M18). Card payments accumulate in `CARD_CLEARING` the same way.
4. Reconcile crons close capture gaps (closed browser, timeouts,
   superseded-but-paid): bKash (`reconcile.ts:31-45`), Nagad
   (`reconcile.ts:40-59`), SSLCommerz poll (`refund.ts:254-330`), Stripe
   (`reconcile.ts:47-97`). UNKNOWN outcomes are never guessed.
5. BanglaQR static receipts and dynamic QR both key off the full total while
   other paths use dueNow (MF-H6); verified BanglaQR rows carry
   `source=GATEWAY` by schema default and are swept (critic-closed gap).

### Flow 3. Refunds (gateway, desk, disputes)

Modules: gateway refund ledgers, Server Actions, folio, ledger sweep.

1. Gateway refunds are always OWNER-approved (`FINANCE.edit`, OWNER-only) with
   MFA and retyped amounts (`bkash-actions.ts:66-86`, nagad/ssl/stripe
   equivalents; `permissions.ts:91`).
2. Under lock the action guards status/trxID/in-flight/window/remaining, writes
   a `REQUESTED` ledger row, calls the gateway, then records
   COMPLETED/FAILED/UNKNOWN (`bkash/refund.ts:68-185`; Nagad UNKNOWN resolved
   via portal `nagad/refund.ts:285-339`; SSLCommerz PENDING polled by cron
   `sslcommerz/refund.ts:174-188,254-330`).
3. Completed bKash/Nagad/SSLCommerz refunds add back to the folio balance
   (`folio.ts:108-115`) and post via the sweep (`auto.ts:187-206`).
   Stripe refunds do neither (MF-H2); Stripe disputes (incl. LOST chargebacks =
   real money out) have no posting path at all.
4. Desk refunds (front-desk cash/card/bank) post as folio REFUND lines, capped
   at net desk payments per booking (`folio-actions.ts:143-169,261-266`); cash
   needs the recorder's open shift (`folio-actions.ts:246-252`).
5. There is no BanglaQR refund path: no ledger model, generic route rejects
   unsupported providers, and desk refunds only pay back desk money (MF-M03).
6. Cancel-with-refund on Stripe/BanglaQR-paid bookings misroutes to DESK
   records instead of provider flows (MF-H3). Self-cancel flips
   CONFIRMED-paid bookings to CANCELLED with money untouched (MF-M02).
7. Legacy generic refund route never calls a gateway; it redirects per provider
   (`admin/payments/refund/route.ts:12-70`).

### Flow 4. Deposits / pay-at-property

Modules: deposit helpers, gateway create paths, BanglaQR, folio desk payments.

1. Deposit percent (Settings, NULL = full charge; `schema.prisma:959-964`)
   stamps `depositPoisha = round(total*pct/100)` at booking creation
   (`deposit.ts:11-16`, `bookings/route.ts:208-213`).
2. bKash/Nagad/SSLCommerz/Stripe-create all charge `dueNowPoisha` with
   exact-equality enforcement (e.g. `bkash/create-payment.ts:39-49`,
   `stripe/create/route.ts:68-71`); old attempts are superseded or TTL-blocked.
3. Incoherence: BanglaQR receipt submission, dynamic QR, and bank webhook all
   demand the FULL total (`receipt-submission.ts:130-141`,
   `dynamic-payment.ts:75-100`, `webhook-processor.ts:147-153`) while admin
   confirm demands dueNow (`verification.ts:85-146`), so deposit bookings
   cannot complete via BanglaQR static. Stripe quote converts the full total
   while create charges dueNow (`quote/route.ts:32` vs `create/route.ts:68`)
   (MF-H6).
4. Pay-at-property flips PENDING to PENDING_MANUAL_VERIFICATION with a flag;
   the balance is collected at the desk as folio PAYMENT lines
   (`pay-at-property/route.ts:38-46`, `folio-actions.ts:101-124`).
5. Offline PARTIAL bookings stay off-folio until recorded and are excluded from
   revenue with a count (`admin-actions.ts:190-201`, `metrics.ts:206-208`).

### Flow 5. Front-desk cash (shifts, drawer, variances)

Modules: cash shifts, folio cash lines, DB triggers, finance ledger.

1. Cashier opens a shift with an opening float stamped to the current business
   date (`cash-shift-actions.ts:52-53`; `CashShift` model).
2. Cash PAYMENT/REFUND folio lines stamp to the recorder's open shift; refused
   with `no_open_shift` if none (`folio-actions.ts:243-283`,
   `shift.ts:29-60`). Non-cash desk methods (CARD/BKASH/NAGAD/BANK_TRANSFER/
   OTHER per `folio/constants.ts:3-6`) carry no shift.
3. DB triggers enforce: shift only with method=CASH, new cash only on the
   recorder's own OPEN shift, voids on the original shift
   (migration `20261009110000_cash_shift:99-141`).
4. Close is blind-count: holder counts without seeing expected, count detail
   must equal counted; zero variance -> CLOSED else NEEDS_REVIEW
   (`cash-shift-actions.ts:82-141`; drawer math `shift.ts:71-80`).
5. Manager signs off NEEDS_REVIEW with a reason, never own unless OWNER
   (`cash-shift-actions.ts:144-173`); counted figures are DB-immutable
   (`CashShift_guard`). Voids on REVIEWED shifts are still allowed and silently
   stale the sign-off (MF-M13).
6. There is no safe-drop/float-adjustment log: mid-shift physical movements
   surface as unexplained variance (MF-M14). Desk cash posts to DESK_CASH
   while spending cash posts from PETTY_CASH (`auto.ts:19-47`): separate pools.
7. Only the REVIEWED variance posts to the ledger (`auto.ts:226-234`); floats
   and physical in/out depend entirely on folio lines having been recorded.

### Flow 6. Expenses / purchasing / payroll (money out)

Modules: expenses, purchasing, inventory, finance (bills/payments/transfers/
petty), HR/payroll, ledger sweep.

1. Expenses: MANAGER/ACCOUNTANT/OWNER submits (idempotent, backdate <= 366d,
   integer poisha <= 1cr; `expense-actions.ts:72-97`); edit only while
   SUBMITTED (`:123-136`); second person with EXPENSE.approve approves
   (submitter/editor barred unless OWNER; `:161-190`). No separate pay step
   exists (statuses SUBMITTED/APPROVED/REJECTED only). Sweep posts
   `EXPENSE_<category>` vs money account (`auto.ts:218-224`).
2. Purchasing: STOREKEEPER/MANAGER/OWNER drafts -> submits -> MANAGER/
   ACCOUNTANT/OWNER approves (self-approval blocked; `purchasing-actions.ts:
   218-363`); receive posts stock INVENTORY vs GOODS_NOT_BILLED at agreed price
   (`:417-499`, `auto.ts:114-117,208-216`).
3. Inventory ISSUE/WASTE moves value out single-actor (INVENTORY.create, no
   approval) and posts STOCK_USED/STOCK_LOSSES via sweep (MF-M12); only counts
   need INVENTORY.approve (`inventory-actions.ts:144-161,275-289`).
4. Bills: ACCOUNTANT/OWNER enters a supplier bill; posts IMMEDIATELY crediting
   ACCOUNTS_PAYABLE with no approval (MF-M08). Receipt lines clear
   GOODS_NOT_BILLED (price diff to PRICE_DIFFERENCE); direct-expense lines can
   charge any EXPENSE account, bypassing EXPENSE.approve (MF-M09).
   Guards: supplier lock, receipt-supplier match, billable-account exclusions,
   duplicate supplierRef blocked by partial unique index, bill immutable via
   trigger (`finance-actions.ts:135-154`; payables migration).
5. Supplier payments: submit from a money account (never desk cash) within
   open balances -> second-person approve -> posts AP vs money
   (`finance-actions.ts:234-356`); void reverses (`:359-384`). Zero-allocation
   (all-advance) payments allowed with no auto-apply or warning (MF-L09).
6. Payroll: attendance marked (frozen once approved; `hr-actions.ts:291-349`)
   -> draft build (salary less unpaid time, unmarked = PAID;
   `constants.ts:85-124`) -> line adjustments with notes (`:452-486`) -> OWNER
   ONLY approves after month-end with rebuild-match check (`:494-517`) ->
   mark-paid with run-level paidDate/paidBy (`:520-538`). Sweep posts accrual
   at month-end and payout per pay method (`auto.ts:90-111,236-248`).
7. Petty: top up via transfer; count runs the sweep first, MATCHED auto-finals,
   differences need FINANCE.approve and post PETTY_CASH vs CASH_OVER_SHORT
   (`finance-actions.ts:448-515`).
8. Transfers post immediately on FINANCE.create with no approval, fee to
   EXPENSE_BANK_CHARGES (`finance-actions.ts:394-438`) (MF-L08).
9. All money-out actions are MFA + permission gated server-side and audited in
   the same transaction (`auth-helpers.ts:112-118` + auditRow calls).

### Flow 7. Night-audit + daily-sheet close

Modules: night audit, business day, folio posting, daily sheet, front-desk
today, cash shifts, room service.

1. Night audit (manual by FRONT_DESK.approve holder after day-over with all
   arrivals decided, or 04:00 hourly cron fallback for yesterday+older;
   `audit.ts:246-327`, cron `route.ts:9-12`) locks the day row, checks gates,
   posts room nights, marks stayover dirty rooms, summarizes, closes the day
   and opens the next, and writes the audit row.
2. Posting: idempotent ROOM_CHARGE per unposted night (floor-split, remainder
   front-loaded; `ledger.ts:30-36`), TAX proportional to room share capped at
   stored heads (`folio.ts:309-336`, strands residue: MF-H4), promo DISCOUNT
   once (`folio.ts:339-350`). Checklist preview shows unposted ROOM only, no
   tax (`audit.ts:118-141`).
3. DaySummary snapshots room revenue, extras, discounts, desk pay/refund by
   method, online pay/refund, occupancy, unresolved (`audit.ts:183-237`). It
   omits Stripe refunds (MF-H2), has no tax fields at all (MF-M04), and never
   balances revenue vs payments (MF-L17).
4. Close gates ignore cash: open shifts and NEEDS_REVIEW variances are
   informational only (`audit.ts:69-70,110`; `NightAuditView.tsx:190-196`), and
   the 04:00 cron closes regardless (MF-L16).
5. Daily sheet carries no cash totals: only money-due balances (live stays use
   projectedBalance incl. unposted future nights, `sheet.ts:128`) and an owner
   NEEDS_REVIEW shift count (`sheet.ts:68,193,206`). Front-desk today is
   money-free by design (`today.ts:6-10`).
6. Room service: in-house-only order -> NEW->PREPARING->READY->DELIVERED;
   delivery atomically posts EXTRA_CHARGE (ROOM_SERVICE) to the folio with
   idempotency and CHECKED_IN guard (`room-service-actions.ts:62-196`).
   Checkout is blocked by open orders and any balance due (manager override
   with reason; `admin-actions.ts:354-398`), but CHECKED_IN->CANCELLED bypasses
   the open-orders guard (MF-L19). Voiding a delivered charge orphans revenue
   (MF-M15).

### Flow 8. Ledger / journals / reports

Modules: ledger post/auto/balances/reports, finance/ledger actions, metrics,
exports, audit viewer, permissions.

1. Accountant sets the books start date once, enters opening balances as manual
   journals (submit FINANCE.create validates balance/open-month; posts only on
   FINANCE.approve; `ledger-actions.ts:172-270`).
2. Daily sources record first (folio, gateway payments/refunds, stock,
   expenses, cash shifts, payroll); bills, transfers, and approved items post
   synchronously, everything else waits for the sweep.
3. Hourly cron or Post-now sweeps unposted sources into balanced AUTO entries
   with once-per-source keys; closed-month sources re-date to the business
   date with a memo (`auto.ts:265-297`). `postEntry` drops zero lines, nets
   two-sided lines, requires balance (>= 2 lines), rejects closed months, AP
   lines require supplierId, sourceKey idempotent (`post.ts:56-113`).
4. Sweep coverage: every FolioLine incl. reversals (`auto.ts:55-83,168-175`);
   gateway payments source=GATEWAY + collected statuses (`:177-185`); only
   bKash/Nagad/SSLCommerz COMPLETED refunds (`:187-206`, Stripe missing);
   stock value<>0, APPROVED expenses, REVIEWED variances, payroll
   accrual+paid (`:208-248`).
5. Supplier payments and petty differences post only after approval; voids and
   reversals create new entries dated today (never edit). Reversals cover
   MANUAL/TRANSFER only under single FINANCE.create control (MF-M11).
6. Month close: FINANCE.approve, past months only, blocks only SUBMITTED manual
   journals for that month (`ledger-actions.ts:303-323`); any CLOSED month can
   be reopened by OWNER with reason (`:326-342`). Closed months are
   append-blocked at app + DB level (triggers: append-only, open-month insert
   guard, deferred balance, account immutability, period no-delete;
   migration `20261013100000_ledger`).
7. Reports read different bases: trial/P&L/balance from ledger accountTotals
   (`reports.ts:102-112`; no year-end close, profit-to-date folded into
   equity); supplier ageing from source bills (`reports.ts:122-141`);
   dashboard KPIs recomputed from source tables incl. Stripe refunds
   (`metrics.ts:147-173`). Ageing-vs-AP and dashboard-vs-ledger can disagree
   with no tie-out view (MF-M16, MF-M17). Payments CSV is all-time, 3
   gateways, SUCCESS-only, gross (MF-H7).
8. Audit: every money mutation is permission-gated; admin/finance mutations
   write AuditLog rows in-transaction while gateway money uses PaymentAuditLog
   (Stripe refund audit is post-hoc best-effort); both viewable in the audit
   viewer (`viewer.ts:6-10`).
9. Display: admin screens use `formatBdt(poisha, lang)` (finance uses a U+2212
   wrapper); all CSVs use exact `poishaToTakaString`; money core is integer
   poisha with 1-poisha tolerance matching (`money.ts:8-89`).

## 2. Findings

ID prefix: MF-H = High, MF-M = Medium, MF-L = Low. "Fix size" maps each finding
to section 3 (minor = small code fix, significant = design/process change).
Merged rows cite every module report that flagged them.

| ID | Severity | Flow | Description | Evidence | Fix size |
|----|----------|------|-------------|----------|----------|
| MF-H1 | High | refunds / gateway settlement | Stripe webhook marks payment SUCCESS without booking lock or paidElsewhere check; amount mismatch only logged yet still CONFIRMED; booking confirm is a PENDING-gated updateMany that silently no-ops on non-PENDING bookings while the Stripe payment stays SUCCESS (double money). | travel-scaffold/src/lib/payments/stripe/webhook.ts:35-67 | minor |
| MF-H2 | High | refunds / folio / night-audit / ledger | Stripe refunds (and LOST disputes = real money out) invisible to folio, DaySummary, and ledger sweep, while dashboard subtracts them: folio understates balance due, DaySummary overstates net, GATEWAY_CLEARING/GUEST_RECEIVABLE stay overstated. | travel-scaffold/src/lib/folio/folio.ts:108-115,158-162; travel-scaffold/src/lib/night-audit/audit.ts:201-203,230; travel-scaffold/src/lib/ledger/auto.ts:187-206; travel-scaffold/prisma/schema.prisma:1974-1999,2004-2022; travel-scaffold/src/lib/dashboard/metrics.ts:154-158 | significant |
| MF-H3 | High | refunds | Cancel-with-refund lookup lists only BKASH/NAGAD/SSLCOMMERZ(+SUCCESS), so Stripe/BanglaQR/PARTIALLY_REFUNDED hits misroute to DESK REFUNDED + folio REFUND, violating desk-pays-desk-only and opening a double refund. | travel-scaffold/src/app/actions/admin-actions.ts:978-980,1006-1044 | minor |
| MF-H4 | High | night-audit / tax | Per-night tax posting uses min(round(share), remaining) cap with no remainder sweep, so round-down residue strands permanently (e.g. 100p over 3 nights posts 99p); the last-nights-absorb comment is false. Room charges self-correct; tax does not. | travel-scaffold/src/lib/folio/folio.ts:305-336; travel-scaffold/src/lib/folio/ledger.ts:44-53 | significant |
| MF-H5 | High | front-desk cash / folio | FolioView renders balance + unposted ROOM sum, omitting unposted tax, while loadFolio already computes projectedBalancePoisha incl. unpostedTax: staff see projected balance understated by remaining nights' VAT/SD. | travel-scaffold/src/app/admin/bookings/[id]/folio/FolioView.tsx:127,307; travel-scaffold/src/lib/folio/folio.ts:206,224 | minor |
| MF-H6 | High | deposits / gateway settlement | Deposit-basis incoherence: BanglaQR receipt/dynamic/webhook demand FULL total while admin confirm demands dueNow (deposit bookings cannot complete via static QR); Stripe quote converts FULL total while create charges dueNow (guest sees wrong figure). | travel-scaffold/src/lib/payments/banglaqr/receipt-submission.ts:130-141; travel-scaffold/src/lib/payments/banglaqr/verification.ts:93-101; travel-scaffold/src/lib/payments/banglaqr/dynamic-payment.ts:97; travel-scaffold/src/lib/payments/banglaqr/webhook-processor.ts:147; travel-scaffold/src/app/api/payments/stripe/quote/route.ts:32-33; travel-scaffold/src/app/api/payments/stripe/create/route.ts:68-71 | minor |
| MF-H7 | High | ledger / reports | Payments CSV documented as collected() consumer but computes all-time, 3 gateways, SUCCESS-only, no refunds/desk/Stripe/BanglaQR/cash: any CSV-to-dashboard comparison mismatches. | travel-scaffold/src/app/api/admin/reports/payments/route.ts:17-38; docs/manual/data-flow/index.md:68-69 | significant |
| MF-M01 | Medium | gateway settlement | bKash cross-gateway live list omits PARTIALLY_REFUNDED/REVIEW_REQUIRED/VERIFYING/VERIFY_PENDING, so a bKash session can open while another gateway is mid-verify: wider double-pay race window than Nagad/SSLCommerz. | travel-scaffold/src/lib/payments/bkash/payability.ts:14; travel-scaffold/src/lib/payments/nagad/payability.ts:19-26; travel-scaffold/src/lib/payments/sslcommerz/payability.ts:25-34 | minor |
| MF-M02 | Medium | refunds | Guests can self-cancel CONFIRMED paid bookings; booking flips to CANCELLED with SUCCESS payment untouched and refund only logged; tx update not status-guarded, racing a concurrent gateway confirm. | travel-scaffold/src/app/api/bookings/self-cancel/route.ts:23,60-69 | minor |
| MF-M03 | Medium | refunds | No BanglaQR gateway refund path (no refund model; generic route rejects unsupported providers) and desk refunds only pay back desk money: BanglaQR overpayments have no correct ledger path. | travel-scaffold/prisma/schema.prisma:730-750,762-786,807-834,1974-1999; travel-scaffold/src/app/api/admin/payments/refund/route.ts:67-70; travel-scaffold/src/app/actions/folio-actions.ts:261-265 | significant |
| MF-M04 | Medium | night-audit / tax | DaySummary has no tax fields (roomLines kind=ROOM_CHARGE only, dayLines exclude TAX); posted VAT/SD never appear in the closed-day summary; checklist preview likewise excludes tax. | travel-scaffold/src/lib/night-audit/audit.ts:141,155-174,188-189 | significant |
| MF-M05 | Medium | direct booking revenue | Admin edit updates total/vat/sd only, leaving discountPoisha/depositPoisha stale against the new total (folio double-counts old discount), and re-splits heads at current rates instead of original rates. | travel-scaffold/src/app/actions/admin-actions.ts:808-843 | significant |
| MF-M06 | Medium | direct booking revenue / tax | No tax mechanism on extra charges: EXTRA_CHARGE posts income only with no TAX line (incl. room-service orders): food/minibar/laundry structurally untaxed while room revenue carries VAT/SD. | travel-scaffold/src/app/actions/folio-actions.ts:92-98; room-service-actions.ts:166 | significant |
| MF-M07 | Medium | direct booking revenue | Per-night revenue attribution diverges from quoted nightly rates: quote sums individually-rounded seasonal nights but folio/audit spread stay subtotal evenly via splitPoisha (stay totals match; peak-night revenue flattened). | travel-scaffold/src/lib/rates/pricing.ts:59; travel-scaffold/src/app/api/bookings/route.ts:189; travel-scaffold/src/lib/folio/ledger.ts:30-36; travel-scaffold/src/lib/folio/folio.ts:268-274 | significant |
| MF-M08 | Medium | expenses / purchasing / payroll | Supplier bills post to ledger on FINANCE.create with no second approval: one ACCOUNTANT moves P&L and payables immediately; inconsistent with expenses/payments/journals. | travel-scaffold/src/app/actions/finance-actions.ts:107-185 | significant |
| MF-M09 | Medium | expenses / purchasing / payroll | Approval bypass: bill accountId lines can charge any EXPENSE account (bypassing EXPENSE.approve) and a manual journal can debit expense/credit money with only FINANCE create+approve; same-actor SoD relies solely on self-blocks. | travel-scaffold/src/app/actions/finance-actions.ts:99,156-162; travel-scaffold/src/app/actions/ledger-actions.ts:172-270 | significant |
| MF-M10 | Medium | expenses / purchasing / payroll | OWNER is the only HR approver and the self-approval exception applies to OWNER: sole approver can build, approve, and mark-paid a payroll alone. | travel-scaffold/src/lib/permissions.ts:185-201; travel-scaffold/src/app/actions/hr-actions.ts:494-517 | significant |
| MF-M11 | Medium | ledger / journals | Single-control ledger writes: one FINANCE.create user can reverse a two-person manual journal, and transfers/bills post immediately on create with no approval. | travel-scaffold/src/app/actions/ledger-actions.ts:277-300; travel-scaffold/src/app/actions/finance-actions.ts:394-438,107-195 | significant |
| MF-M12 | Medium | expenses / purchasing / payroll | Inventory ISSUE/WASTE moves value out single-actor (INVENTORY.create, no approval) posting STOCK_USED/STOCK_LOSSES via sweep; only counts need approval. Request->approve->pay shape does not hold for stock outflow. | travel-scaffold/src/app/actions/inventory-actions.ts:144-161,275-289 | significant |
| MF-M13 | Medium | front-desk cash | Void-on-REVIEWED: void action never checks shift status and the trigger allows voids on non-OPEN shifts, while guard forbids any transition except NEEDS_REVIEW->REVIEWED: a signed-off drawer's truth can change with no re-review. | travel-scaffold/src/app/actions/folio-actions.ts:184-205; migration 20261011110000:15-29; migration 20261009110000:77-80 | significant |
| MF-M14 | Medium | front-desk cash | No safe-drop/float-adjustment log: expectedCash = float + folio lines only, no drawer-movement table, so legitimate mid-shift movements surface as unexplainable variance. | travel-scaffold/src/lib/cash/shift.ts:77-80; travel-scaffold/prisma/schema.prisma CashShift/FolioLine | significant |
| MF-M15 | Medium | front-desk cash | Room-service charge void orphans revenue: delivered order's EXTRA_CHARGE can be voided while order stays DELIVERED with folioLineId pointing at a voided line; guest served but no longer billed unless manually re-posted. | travel-scaffold/src/app/actions/folio-actions.ts:172-222; travel-scaffold/src/app/actions/room-service-actions.ts:173 | minor |
| MF-M16 | Medium | ledger / reports | Ageing (source bills) and ledger AP can disagree with no reconciliation: payments post full incl. unallocated advances, voids reverse in later months, SUBMITTED payments reduce bill balances without touching ledger; shown side by side with nothing tying them. | travel-scaffold/src/lib/ledger/reports.ts:122-141; travel-scaffold/src/app/actions/finance-actions.ts:331-342; travel-scaffold/src/lib/ledger/balances.ts:26-33; finance page.tsx:33-47 | significant |
| MF-M17 | Medium | ledger / reports | Dashboard (cash-collected from sources) and ledger (earned/posted) are different bases that silently diverge via unposted backlog, late re-dating, and the Stripe gap; only mitigation is the unposted banner. | travel-scaffold/src/lib/dashboard/metrics.ts:147-173; travel-scaffold/src/lib/ledger/auto.ts:277-280 | significant |
| MF-M18 | Medium | gateway settlement / ledger | Clearing accounts rely on manual settlement: GATEWAY_CLEARING/CARD_CLEARING accumulate via sweep, fees never auto-post; only a manual TRANSFER clears them. Forgotten settlements leave stale balances; no payment-to-transfer link or batch matching. | travel-scaffold/src/lib/ledger/auto.ts:183; travel-scaffold/src/app/actions/finance-actions.ts:394-438,422 | significant |
| MF-M19 | Medium | guards | BanglaQR receipt access guard split: URL issuance is FINANCE.view (incl. ACCOUNTANT/AUDITOR) but the receipt-file route requires MANAGER, so those roles get 403 on the local fallback (route is dev-only, severity capped). | travel-scaffold/src/app/actions/banglaqr-actions.ts:177-180; travel-scaffold/src/app/api/admin/payments/banglaqr/receipt-file/route.ts:7-15 | minor |
| MF-M20 | Medium | guards | Deferred payment status checks (bKash/Nagad/SSLCommerz actions + status route) require MANAGER while migrated BanglaQR siblings include ACCOUNTANT via FINANCE.approve: known tech debt, active inconsistency. | travel-scaffold/src/app/actions/bkash-actions.ts:122-125; nagad-actions.ts:152-155; sslcommerz-actions.ts:157-160; travel-scaffold/src/app/api/admin/payments/status/route.ts:11; travel-scaffold/src/app/actions/banglaqr-actions.ts:107 | significant |
| MF-M21 | Medium | guards | Admin-actions guards sit INSIDE try/catch returning {error}, swallowing forbidden() into a 200 error string instead of 403 (fail-closed, wrong shape); gate scripts only check presence. | travel-scaffold/src/app/actions/admin-actions.ts:79-81,255-259,282-287,913-915,1104-1108; travel-scaffold/src/app/actions/bkash-actions.ts:20-23 | minor |
| MF-M22 | Medium | guards / tax | Tax-model docs state absolutes (none computed, tax-inclusive by design) but code is mixed: online tax-exclusive, staff/PMS tax-inclusive. Accountant reading docs will misstate online invoices. | travel-scaffold/src/lib/tax/tax.ts:1-6; travel-scaffold/src/app/api/bookings/route.ts:205-210; travel-scaffold/src/app/actions/admin-actions.ts:141-142; pms route:211-213; docs/ops/money-flow.md:148-150; docs/manual/data-flow/index.md:381 | minor |
| MF-M23 | Medium | guards / reports | Money-flow claims dashboard anchors calendar date vs business-day sheet, but code anchors dashboard to businessDate; the reconciliation row equating Revenue Today to Daily Sheet cash total holds only for the owner-summary block, not money-due (forecast incl. unposted nights). | docs/ops/money-flow.md:186-189,464; travel-scaffold/src/lib/dashboard/metrics.ts:191-205; travel-scaffold/src/lib/daily-sheet/sheet.ts:128 | minor |
| MF-L01 | Low | gateway settlement | Stripe stores the full raw event in rawWebhookPayload vs masked summaries in bKash/Nagad/SSLCommerz paths: PII/log-size exposure. | travel-scaffold/src/lib/payments/stripe/webhook.ts:42 | minor |
| MF-L02 | Low | gateway settlement | Demo approvals write real SUCCESS Payment rows (DEMO- transactionId) counted by folio and self-cancel netPaid: simulate data pollutes accounting if the DB is ever reused for prod. Conditional: strictly env-gated (PAYMENT_MODE=simulate). | travel-scaffold/src/demo-payments/confirm.ts:128-138; travel-scaffold/src/demo-payments/simulate.ts:20-22 | minor |
| MF-L03 | Low | direct booking revenue | Stepper estimate can show a discount the server rejects: quote ignores validity window/uses and uses raw date strings vs server businessDate conversion. Display divergence only; server authoritative. | BookingStepper.tsx:109-112; travel-scaffold/src/app/api/promos/lookup/route.ts:34-39; travel-scaffold/src/app/api/bookings/route.ts:193,200-203 | minor |
| MF-L04 | Low | direct booking revenue | Self-modify reprices tax at current Settings rates, contradicting the documented keep-original-tax promise; a rate change between booking and date-change alters historical heads. | travel-scaffold/src/app/api/bookings/self-modify/route.ts:113-114 | minor |
| MF-L05 | Low | direct booking revenue | computeTaxBreakdown/splitInclusiveTotal do not round-trip exactly (additive vs proportional-backout rounding): re-splitting an unchanged total can shift heads by ±1p with subtotal absorbing. | travel-scaffold/src/lib/tax/tax.ts:37-38,53-55 | minor |
| MF-L06 | Low | direct booking revenue | Admin booking detail header serializes total only; staff editing the total cannot see the vat/sd/discount/deposit breakdown (visible only on folio page and guest invoice). | travel-scaffold/src/app/admin/bookings/[id]/page.tsx:75-96 | minor |
| MF-L07 | Low | direct booking revenue | Confirmation invoice BIN is live Settings, not stamped: a BIN change rewrites history on old invoices (accepted trade-off; heads themselves stored). | ConfirmationClientView.tsx:180-185; page.tsx:75 | minor |
| MF-L08 | Low | expenses / purchasing / payroll | Transfers post immediately on FINANCE.create with no approval, and the same permission creates new isMoney accounts. Only own-money-account moves (no direct third-party outflow), but false top-ups/settlements/fees need one actor. | travel-scaffold/src/app/actions/finance-actions.ts:394-438; travel-scaffold/src/app/actions/ledger-actions.ts:98-138 | significant |
| MF-L09 | Low | expenses / purchasing / payroll | Supplier payments may be submitted with zero allocations (all advance). Advances reduce book AP but no bill balance, so a bill can stay OPEN and be paid again while an unapplied advance exists; nothing warns or auto-applies. | travel-scaffold/src/app/actions/finance-actions.ts:247,263; travel-scaffold/src/lib/ledger/balances.ts:19-33 | significant |
| MF-L10 | Low | expenses / purchasing / payroll | No dedupe between receipt-based and direct-expense bill lines, or between two ref-less bills: same delivery/cost billable twice; only (supplier, supplierRef) and per-receipt-in-OPEN-bill guarded. | travel-scaffold/src/app/actions/finance-actions.ts:156-162 | significant |
| MF-L11 | Low | expenses / purchasing / payroll | No funds check anywhere: cash expenses/payroll auto-post out of PETTY_CASH and payments out of chosen money accounts even if balance goes negative; postEntry enforces balance, not solvency. | travel-scaffold/src/lib/ledger/auto.ts:218-224; travel-scaffold/src/lib/ledger/post.ts:56-113 | minor |
| MF-L12 | Low | expenses / purchasing / payroll | markPayrollPaid records only run-level paidDate/paidBy: no per-employee disbursement confirmation and no verification against actual bank/wallet outflows; ledger payment follows automatically. | travel-scaffold/src/app/actions/hr-actions.ts:520-538; travel-scaffold/src/lib/ledger/auto.ts:246 | minor |
| MF-L13 | Low | guards | OWNER self-approval exception uniform across expense/PO/payment/journal/payroll approvals: any single OWNER executes an outflow end-to-end. Intended for small properties; nullifies SoD at OWNER level. | travel-scaffold/src/app/actions/expense-actions.ts:175; purchasing-actions.ts:343; finance-actions.ts:327; ledger-actions.ts:244 | significant |
| MF-L14 | Low | ledger / journals | Posting lag: approvals only flip status; entries appear on next cron/Post-now (or petty-count trigger); closed-month items re-date to business date with memo. Accountant must run Post-now before trusting balances. | travel-scaffold/src/lib/ledger/auto.ts:265-297 | minor |
| MF-L15 | Low | front-desk cash | EXTRA_CHARGE_CATEGORIES lacks ROOM_SERVICE and manual charge validates against it, so staff cannot manually post/re-post RS-category lines; only the delivery path creates them (books handle it, desk UI does not). | travel-scaffold/src/lib/folio/constants.ts:8; travel-scaffold/src/app/actions/folio-actions.ts:86; travel-scaffold/src/app/actions/room-service-actions.ts:163-172; travel-scaffold/src/lib/ledger/auto.ts:51 | minor |
| MF-L16 | Low | night-audit | Business day closes with open/unreconciled shifts by design: close gates are arrivals/day-over/due only; open shifts and NEEDS_REVIEW variances informational, and 04:00 cron closes regardless. | travel-scaffold/src/lib/night-audit/audit.ts:176,255-260,69-70,110; NightAuditView.tsx:190-196 | significant |
| MF-L17 | Low | night-audit | No revenue-vs-payment balancing: summarize() reports room revenue and payments side by side but closeBusinessDay never compares them or blocks on mismatch. | travel-scaffold/src/lib/night-audit/audit.ts:183-237,246-310 | significant |
| MF-L18 | Low | front-desk cash | Shift/day boundary skew: shift carries open-date businessDate but lines carry post-date and audit groups by businessDate; a shift spanning midnight makes shift totals disagree with day totals, with no tie-out report. | travel-scaffold/src/app/actions/cash-shift-actions.ts:59; travel-scaffold/src/app/actions/folio-actions.ts:271; travel-scaffold/src/lib/night-audit/audit.ts:189 | significant |
| MF-L19 | Low | front-desk cash | Cancel-in-house bypasses the room-service guard: open-orders check runs only for COMPLETED while CHECKED_IN->CANCELLED is allowed, stranding open orders undeliverable. | travel-scaffold/src/app/actions/admin-actions.ts:354-359,306-310; travel-scaffold/src/app/actions/room-service-actions.ts:162 | minor |
| MF-L20 | Low | front-desk cash | Cash-refund cap is per-booking not per-drawer: booking-level REFUND-vs-PAYMENT nets, so a refund can exceed the paying shift's actual cash; drawer absorbs it as variance. | travel-scaffold/src/app/actions/folio-actions.ts:261-266 | minor |
| MF-L21 | Low | ledger / journals | Close-month gate ignores the auto-posting backlog: blocks only SUBMITTED manual journals, so a month can close with unposted folio/payment/stock/expense sources landing late next month. | travel-scaffold/src/app/actions/ledger-actions.ts:303-323 | minor |
| MF-L22 | Low | ledger / journals | Cash-shift sweep posts only the REVIEWED variance; opening floats and physical in/out have no posting of their own and depend entirely on folio lines recorded. | travel-scaffold/src/lib/ledger/auto.ts:226-234 | significant |
| MF-L23 | Low | ledger / journals | Stripe refund audit is post-hoc best-effort outside the refund transaction: a crash between completion and audit write loses the trail, unlike bKash/BanglaQR in-transaction audits. | travel-scaffold/src/app/actions/stripe-actions.ts:80-103; bkash audit.ts:6-17; verification.ts:104-135 | minor |
| MF-L24 | Low | ledger / journals | Sweep failure modes park entries silently in run.failed: unknown folio kind/tax category throws, missing EXPENSE account fails; cron surfaces only count + first key. A miscategorised expense blocks its posting until fixed. | travel-scaffold/src/lib/ledger/auto.ts:77,80,222; travel-scaffold/src/lib/ledger/post.ts:74; cron route.ts:23-25 | minor |
| MF-L25 | Low | ledger / reports | Unposted banner undercounts: countUnposted defaults to limit 500 while a run posts up to 2000; backlog above 500 shows as 500. | travel-scaffold/src/lib/ledger/auto.ts:253-257,269 | minor |
| MF-L26 | Low | ledger / journals | Reopen history single-slot: AccountingPeriod keeps only latest reopenedAt/By/Reason; repeated cycles overwrite who reopened before (full trail only in AuditLog MONTH_REOPENED rows). | travel-scaffold/prisma/schema.prisma:1617-1619 | minor |
| MF-L27 | Low | guards | COLLECTED_PAYMENT_STATUSES includes PAID but the query filters source=GATEWAY while PAID is DESK-only: dead entry, no miscount today; fail-open if a GATEWAY row ever carries PAID. | travel-scaffold/src/lib/dashboard/metrics.ts:29-34,149; travel-scaffold/prisma/schema.prisma:313-319; travel-scaffold/src/lib/folio/folio.ts:29 | minor |
| MF-L28 | Low | guards | Negative-money formats differ: finance screens use U+2212 minus + formatBdt(abs) while everywhere else raw formatBdt(negative) goes to Intl: same balance renders differently across pages. | travel-scaffold/src/app/admin/finance/shared.tsx:44-59; travel-scaffold/src/lib/money.ts:61-64 | minor |
| MF-L29 | Low | guards | No-float lint covers names, not math: script greps only legacy column names while live float money math exists (Stripe rate conversion + inline dup, PMS float taka input, settings feeBdt*100 unrounded, promo Math.round(taka*100) bypassing toPoisha). | scripts/check-no-float-money.sh:19-22; travel-scaffold/src/lib/payments/stripe/config.ts:63-69; travel-scaffold/src/lib/payments/stripe/refund.ts:43; pms route:36,210; travel-scaffold/src/lib/settings.ts:119-120; rates-actions.ts:50-53 | minor |
| MF-L30 | Low | guards | Legacy Float columns remain NOT NULL dual-written floats (rollback compat). Any reader outside typed ESLint coverage (raw SQL, BI) gets floats; risk confined to new untyped readers. | travel-scaffold/prisma/schema.prisma:134-136,351-353,402-404; travel-scaffold/src/lib/money-legacy.ts:12-22 | significant |

## 3. Fix plan

### Fix status (2026-11-02, Phase A)

Landed with failing-first tests, tsc 0, eslint clean, broad payments suite
583 green, Playwright smoke green: MF-H1 (gated webhook + new
`stripe/settlement.ts`), MF-H3 (cancel lookup), MF-H5 (FolioView
projection), MF-H6 (dueNow basis at 6 sites: BanglaQR receipt/dynamic/
webhook/token-cap/notify + Stripe quote), MF-M01 (bKash live list),
MF-M02 (self-cancel guarded write; CONFIRMED kept self-cancellable by
design, parity with staff flow), MF-H4 doc part (strand comment),
MF-H7 doc part (CSV consumer claim corrected). The BanglaQR MF-H6 DB test
is committed but unrunnable locally (no postgres; runs where
DATABASE_URL_TEST exists).

### 3A. Minor fixes to apply now (small, localized)

Each item names the file and the change. IDs in brackets link to findings.

1. Stripe webhook: lock booking, require PENDING + no paidElsewhere before
   SUCCESS; park amount mismatches in REVIEW_REQUIRED instead of
   confirm-with-log (`stripe/webhook.ts:35-67`). [MF-H1]
2. FolioView: display `folio.projectedBalancePoisha` (incl. unposted tax)
   instead of balance + room-only sum (`FolioView.tsx:127,307`). [MF-H5]
3. Deposit basis: use `dueNowPoisha` in BanglaQR receipt-submission (L131),
   dynamic-payment (L97), webhook (L147) and Stripe quote (L32) - or
   explicitly reject deposit bookings there with a clear error. [MF-H6]
4. Cancel routing: extend online lookup to STRIPE/BANGLAQR +
   PARTIALLY_REFUNDED/REFUNDED and route hits to provider flows
   (`admin-actions.ts:978-980`). [MF-H3]
5. Widen bKash `OTHER_GATEWAY_LIVE_STATUSES` to match Nagad/SSLCommerz lists
   (`bkash/payability.ts:14`). [MF-M01]
6. Self-cancel: guard tx update with where-status in SELF_CANCELLABLE and
   reconsider CONFIRMED-with-SUCCESS-payment self-cancel
   (`self-cancel/route.ts:68-69`). [MF-M02]
7. Store a masked summary in Stripe rawWebhookPayload like other gateways
   (`stripe/webhook.ts:42`). [MF-L01]
8. Admin booking header: serialize vat/sd/discount/deposit breakdown where
   staff edit the total (`admin/bookings/[id]/page.tsx:75-96`). [MF-L06]
9. Self-modify: preserve original effective tax rates from stored heads (or
   disclose the re-tax in the log note) (`self-modify/route.ts:113-114`).
   [MF-L04]
10. Correct the folio.ts:305-308 last-nights-absorb comment (or implement the
    sweep so it holds). [MF-H4 doc part]
11. Re-check bill open balances inside reviewSupplierPaymentAction, not only
    at submit time. [MF-L09 hardening]
12. Funds warning (not block) when approving CASH expenses or payments from an
    account with insufficient book balance. [MF-L11]
13. Record per-employee payout references on markPayrollPaid (e.g. bank advice
    number), not run-level paidDate only. [MF-L12]
14. Move requirePermission calls above try/catch in admin-actions.ts
    createOfflineBooking (:79-81), updateBookingStatus (:282-287),
    cancelBookingWithRefundDecision (:913-915) and same-file siblings so
    forbidden() propagates as 403. [MF-M21]
15. Remove dead PAID from COLLECTED_PAYMENT_STATUSES or comment why a DESK
    status is listed on a GATEWAY-filtered query (`metrics.ts:29-34`).
    [MF-L27]
16. Use toPoisha() in rates-actions.ts:53 FIXED promo path and Math.round in
    settings.ts:119-120 instead of bare *100; use poishaToMinorUnits() helper
    in stripe/refund.ts:43 instead of the inline duplicate. [MF-L29]
17. Standardize negative money: adopt the finance U+2212 form everywhere or
    drop the wrapper. [MF-L28]
18. Correct stale docs: money-flow tax paragraph (:148-150) and data-flow
    3.18 (:381) to the mixed model (online exclusive, staff/PMS inclusive);
    money-flow day-anchor 11.7 (:186-189); folio.ts:10-13 header once Stripe
    refunds are added. [MF-M22, MF-M23]
19. Extend check-no-float-money.sh with a pattern for amountTaka*100 style
    conversions (or an allowlist); document Payment.amount as ESLint-only
    coverage. [MF-L29]
20. Block month close (or warn) when countUnposted for that month is non-zero,
    not just pending manual journals (`ledger-actions.ts:311-312`). [MF-L21]
21. Raise countUnposted default limit or show 500+ when truncated
    (`auto.ts:253-257`). [MF-L25]
22. Move the Stripe REFUND_SUCCEEDED audit write inside the refund transaction
    (`stripe-actions.ts:95-103`). [MF-L23]
23. Validate expense category to EXPENSE_* account existence at submit/review
    time so sweep failures surface early (`auto.ts:222`). [MF-L24]
24. Grant HR.approve to the HR role (or document OWNER-only payroll approval)
    in `permissions.ts:195`. [MF-M10 doc part]
25. Extend the open-orders guard to CHECKED_IN->CANCELLED (reuse openOrdersFor)
    or surface an explicit warning. [MF-L19]
26. Include per-shift cash references (shift ids, counted/expected/variance
    snapshot) in DaySummary. [MF-L18 hardening]
27. Add ROOM_SERVICE to a shared system-category list (or document as
    system-only) so manual corrections and reports treat RS lines
    consistently. [MF-L15]
28. Show voids-after-close (afterClosePoisha lines) on shift detail and audit
    history so reviewers see post-count changes. [MF-M13 visibility part]
29. Surface unapplied advances per supplier on the payables page (AP book vs
    allocated bills) to prevent pay-again on open bills. [MF-L09]
30. RS void guard: block voiding a delivered order's EXTRA_CHARGE while the
    order stays DELIVERED (or force void-through-order so service and billing
    stay linked). [MF-M15]

### 3B. Significant suggestions (design / process changes, with rationale)

1. One shared refund reader for all gateways (incl. Stripe, plus a BanglaQR
   store when built), used by folio, night-audit summarize, dashboard, and
   the ledger sweep, with a payment+refund nets-to-zero regression test per
   gateway. Rationale: the same omission class has now bitten three readers
   independently; a helper makes the next gateway impossible to half-wire.
   [MF-H2]
2. Backfill posting for already-completed Stripe refunds (and LOST/WON dispute
   postings) so GATEWAY_CLEARING and GUEST_RECEIVABLE reconcile. Rationale:
   code fix alone leaves historical months permanently overstated. [MF-H2]
3. Add a BanglaQR refund ledger + OWNER flow (bank-transfer style,
   portal-resolved like Nagad UNKNOWN) so manual/bank money has a first-class
   refund path instead of unpostable desk entries. Rationale: today there is
   no correct ledger path at all for BanglaQR overpayments. [MF-M03]
4. Wire settlement: batch-level clearing view tying gateway SUCCESS payments
   to clearing transfers + fee capture, instead of free-form transfers; add an
   AP reconciliation view (ledger AP vs ageing vs unallocated advances).
   Rationale: manual unlinked transfers guarantee stale clearing balances and
   untraceable fees. [MF-M18, MF-M16]
5. Rebuild or relabel /api/admin/reports/payments: either compute it from
   collected()+byProvider() with window params, or rename it to describe what
   it is (gateway attempt success-rate, 3 gateways, all-time, gross) and
   remove the data-flow consumer claim. Rationale: an accountant-facing
   export that contradicts the dashboard is worse than none. [MF-H7]
6. Require FINANCE.approve (second person) before supplier bills post - at
   minimum for direct-expense (non-receipt) lines - and require second-person
   approval for reversals and transfers above a threshold (or restrict to
   FINANCE.approve). Rationale: bills, transfers, and reversals currently let
   one actor move P&L/payables/cash, defeating the two-person rule applied
   everywhere else. [MF-M08, MF-M09, MF-M11, MF-L08]
7. Add per-bill advance application: warn/block unallocated payments while the
   supplier has open bills, or auto-suggest allocations; add a cross-check
   preventing the same receipt value being billed via both receipt lines and
   direct-expense lines. Rationale: silent double-pay and double-bill paths.
   [MF-L09, MF-L10]
8. Tax remainder sweep in postRoomNights: after the nightly loop, post any
   (heads - postedTax) residue on the last night or as an adjustment line so
   lifetime posted tax always equals stored heads. Rationale: permanent
   under-posting of a statutory liability, however small per stay. [MF-H4]
9. Include tax in night-audit reporting: add vat/sd collected fields to
   DaySummary (query TAX lines alongside roomLines) and show projected tax in
   the checklist preview. Rationale: the closed-day record is currently blind
   to the tax collected that day. [MF-M04]
10. Decide and implement a tax policy for EXTRA_CHARGE (room service, minibar,
    laundry): auto-raise TAX lines at posting (needs rate stamping per
    charge) or explicitly document extras as tax-inclusive/out-of-scope for
    NBR filing. Rationale: structurally untaxed revenue needs an explicit
    filing position. [MF-M06]
11. Rework admin edit into a reprice action: recompute discount (revalidate
    stored promo) and deposit alongside total/vat/sd, and preserve
    original-rate heads unless staff explicitly choose current rates.
    Rationale: silent staleness corrupts folio math and deposit collection.
    [MF-M05]
12. Decide the void-on-REVIEWED policy (reopen to NEEDS_REVIEW vs adjusting
    entry) and enforce it in migration + void action. Rationale: sign-off
    that can be silently staled is not a control. [MF-M13]
13. Add a first-class drawer-movement log (safe drops, float top-ups/
    withdrawals, cash-to-safe) feeding expectedCash. Rationale: legitimate
    movements currently appear as variance, training reviewers to ignore
    variance. [MF-M14]
14. Build a cash tie-out report: per-day desk CASH by shift (with
    voids-after-close listed) reconciled to DaySummary deskPaymentsByMethod
    CASH, flagging open/NEEDS_REVIEW shifts at close time. Rationale: no
    report today ties drawer counts to day totals (also covers midnight
    skew). [MF-L18, MF-L16, MF-L17]
15. Require second approval for inventory ISSUE/WASTE above a threshold, or
    document single-actor stock outflow as accepted. Rationale: value leaves
    the books on one actor's action. [MF-M12]
16. Migrate the 8 deferred requireRole files to requirePermission per the
    5.3 targets (status checks to FINANCE.view, refunds to FINANCE.edit,
    settings/test-connection to SETTINGS.edit) to close the ACCOUNTANT gaps.
    Rationale: standing rule already requires this on next touch; gaps are
    live today. [MF-M20, MF-M19]
17. Fix cancel-with-refund provider routing structurally with
    assert-manual-refund guards per provider mirroring the bKash/Nagad/
    SSLCommerz ones (extends minor fix 4). Rationale: prevents double-refund
    by construction, not just by lookup coverage. [MF-H3]
18. Add deposit-mode end-to-end coverage per gateway
    (create->capture->confirm->folio balance) to lock the dueNow vs full-total
    basis; build an ops queue for REVIEW_REQUIRED payments and UNKNOWN/PENDING
    refunds with SLAs. Rationale: deposit coherence already broke twice; stuck
    money today waits on rows an OWNER must discover. [MF-H6, MF-L14]
19. Document the OWNER self-approval exception and OWNER-only payroll approval
    as accepted small-property risk, or add a second-OWNER / cooling-off rule
    for payroll. Rationale: SoD is currently null at OWNER level by a uniform
    exception, not by decision record. [MF-M10, MF-L13]

## 4. Accountant reconciliation checklist (monthly, and where)

Run these in order at each month end, before closing the month.

1. Post-now + backlog: run Post-now (finance home), then read the unposted
   banner. Remember it caps at 500 (MF-L25) and approvals alone post nothing
   (MF-L14). Do not close with a backlog (MF-L21).
2. Dashboard vs ledger: compare dashboard Revenue (cash-collected from
   sources, `metrics.ts:147-173`) to ledger revenue (trial/P&L from
   `reports.ts:102-112`). Explain the gap via unposted backlog, closed-month
   re-dating memos (`auto.ts:277-280`), and the Stripe-refund gap (MF-H2,
   MF-M17). Until the sweep covers Stripe, journal completed Stripe refunds
   and LOST disputes manually.
3. Ageing vs AP: compare supplier ageing (source bills) to the ledger AP
   balance and list unapplied advances per supplier (MF-M16, MF-L09). Investigate
   any bill paid twice (advance + allocation) and any ref-less duplicate
   (MF-L10).
4. Clearing accounts: age GATEWAY_CLEARING and CARD_CLEARING; every balance
   needs a matching bank settlement transfer + fee to EXPENSE_BANK_CHARGES
   (MF-M18). Forgotten settlements are the most likely stale balances.
5. Cash tie-out (manual until the report exists): per-shift
   expected/count/variance on the cash pages vs DaySummary
   deskPaymentsByMethod[CASH]; list open and NEEDS_REVIEW shifts at close
   (MF-L16), voids-after-close lines (MF-M13), and any shift spanning
   midnight (MF-L18). Confirm desk drawer (DESK_CASH) and petty cash
   (PETTY_CASH) movements were not mixed.
6. Tax collected: DaySummary has no tax fields (MF-M04) and the checklist
   preview is room-only, so pull VAT/SD from posted TAX folio lines / the
   VAT_PAYABLE and SD_PAYABLE ledger accounts for the NBR position. Spot-check
   one multi-night stay for per-night stranding residue (MF-H4).
7. Folio balances: for in-house bookings, use projectedBalance incl. unposted
   tax from loadFolio, not the FolioView projected figure (MF-H5). Money-due
   on the daily sheet is a forecast incl. unposted future nights - never
   compare it directly to collections (MF-M23).
8. Bills and receipts: for each supplier with unbilled receipts, confirm no
   direct-expense bill line already charged the same cost (MF-L10); confirm
   no bill posted by an account that bypassed expense approval without review
   (MF-M09).
9. Payroll: confirm attendance frozen, run approved after month-end with no
   changes since build, and collect per-employee payout references (bank
   advice) beyond the run-level paidDate (MF-L12). Note OWNER-only approval
   (MF-M10).
10. Closed months: confirm no late postings except re-dated-to-today entries
    with original-date memos; review any MONTH_REOPENED rows in the audit
    viewer (OWNER-only, reason required; MF-L26).
11. Audit trail sample: in the audit viewer, sample AuditLog rows for
    admin/finance mutations and PaymentAuditLog rows for gateway money;
    confirm Stripe refunds have audit rows despite the post-hoc write
    (MF-L23).
12. Edited bookings: for admin-edited totals, verify discountPoisha and
    depositPoisha were recomputed (they are left stale by the edit action;
    MF-M05) and confirm which tax rates were applied.
13. Extras tax position: confirm the month's EXTRA_CHARGE revenue treatment
    matches the decided NBR position (system posts no tax on extras; MF-M06).
14. Simulate-data check: confirm no DEMO- transactionId SUCCESS rows exist in
    the production database (MF-L02).
15. Report-basis discipline: never compare the payments CSV export to the
    dashboard (different population and window; MF-H7); trial/P&L/balance come
    from the ledger, ageing and dashboard from sources (MF-M17).

## 5. Unresolved / needs-running-system

Every unresolved item from the module reports and critic is carried verbatim
below, grouped by source. Critic closure notes are appended in brackets where
the critic re-audit resolved the gap; the original wording is preserved.

### revenue-in (prior result 5)

- R5-U1: Cron route auth/wiring for bkash/nagad/sslcommerz/stripe reconcile
  endpoints (reconcile libs read; route guards not opened).
  [Critic: CLOSED - ledger-posting, bkash/stripe-reconcile, night-audit crons
  all require isCronRequestAuthorized with allowQuerySecret:false,
  fail-closed without CRON_SECRET
  (travel-scaffold/src/lib/cron-auth.ts:27-40; api/cron/*/route.ts).]
- R5-U2: Gateway confirmation-email bodies (scheduling calls verified in
  callbacks; template content not inspected).
- R5-U3: Admin offline/create-booking path for cash-at-creation
  (admin-actions.ts) — desk-payment-at-desk path fully verified via
  folio-actions instead.

### pricing-tax (prior result 1)

- (none - no unresolved items)

### money-out (prior result 2)

- (none - no unresolved items)

### cash-ops (prior result 4)

- R4-U1: Whether Stripe refunds (and any BanglaQR refund store) feed
  night-audit onlineRefundsPoisha: summarize() reads only
  bkashRefund/nagadRefund/sSLCommerzRefund tables (audit.ts:201-203,230);
  Stripe refund storage not opened (outside cash-ops scope).
  [Critic: answered - they do NOT feed it; confirmed as BREAK (MF-H2).]
- R4-U2: PettyCashCount (finance-side) interplay with desk cash: model sighted
  in schema only, not read; spending CASH maps to PETTY_CASH
  (ledger/auto.ts:36-40), suggesting desk drawer and petty cash are separate
  pools - not verified end-to-end.
- R4-U3: CashView/CloseShiftForm/NightAuditView rendering details beyond the
  cash-related lines grepped; all money logic verified at lib + action +
  trigger level.

### books-reports (prior result 3)

- R3-U1: Whether BanglaQR Payment rows carry source=GATEWAY (creation site in
  receipt-submission/dynamic-payment not opened); inferred yes from
  metrics.ts:29-34 comment treating BanglaQR-verified payments as
  gateway-collected, hence swept by auto.ts:177.
  [Critic: CLOSED - Payment.create in payment-token.ts:66-75 sets no source,
  schema default is GATEWAY (prisma/schema.prisma:408), so verified BanglaQR
  IS swept; pending ones correctly excluded by status filter.]
- R3-U2: Individual Journals/Accounts/Payables detail view files (EntryView,
  LedgerView, BillView, PaymentView, PettyCashView, PayablesView,
  AccountsView, JournalsView) not opened — cited behavior rests on actions +
  lib + reports loaders, which are the enforcement points.
- R3-U3: Night-audit auto-posted room-charge/tax folio lines: assumed to flow
  through the folio sweep like desk-posted lines; night-audit posting code
  not opened.

### guards-consistency (prior result 6)

- R6-U1: Gateway payability/amount string-split parsing bodies
  (bkash/nagad/sslcommerz payability.ts, banglaqr schemas.ts:26/sandbox-qr.ts:26)
  inspected via search only, not read_file; integer-math claim for those files
  is search-level.
- R6-U2: Whether stripe/refund.ts imports poishaToMinorUnits (dup vs reuse at
  refund.ts:43 vs config.ts:63-69): only lines 38-47 opened; imports not
  inspected.
- R6-U3: Receipt URL issuance path (R2 presigned vs local) in
  receipt-access.ts:43 and receipt-storage.ts:128: search-only; R4 severity
  caveat (dev-only) rests on the route's own comment :7-13.
- R6-U4: Admin views ExpensesView, NightAuditView, InventoryView,
  PurchasingView, VerificationView, DisputesView, FinanceHome/reports, payroll
  views formatting: search shows formatBdt money() pattern, bodies not opened;
  consistency verdict rests on 4 opened admin bodies + money.test + 4 opened
  CSV exports.
- R6-U5: Guest/admin email locale (formatBdt hardcoded 'en' in bkash
  notifications + email/index): search-only, bodies not opened.
- R6-U6: No 'export const arrow-action' scan performed:
  check-admin-actions-guards.sh awk only matches ^export (async )?function
  (script :22-34); existence of arrow-exported actions that would evade the
  gate not verified.
  [Critic: CLOSED - zero ^export const arrow actions in app/actions/*.ts, so
  the ^export function gate regex misses nothing.]
- R6-U7: Ledger auto-posting cron schedule (money-flow claims unscheduled
  11.4) and PMS generic-vs-per-gateway routes (data-flow open question m7):
  out of guards-consistency scope, not verified.
- R6-U8: PRISMA String vs enum for Payment.provider: schema shows
  PaymentProvider enum (:321-330, read); data-flow 2 line 46 says String -
  minor doc stale, folded into R7 family, no separate finding.

### critic (prior result 7)

- R7-U01: BREAK revenue-in universal under-lock capture recheck:
  travel-scaffold/src/lib/payments/stripe/webhook.ts:35-67 - no lock, no
  payability recompute, no paidElsewhere, mismatch logged-then-confirmed,
  booking updateMany no-ops while payment stays SUCCESS
- R7-U02: BREAK deposit coherence:
  travel-scaffold/src/lib/payments/banglaqr/receipt-submission.ts:131-141
  (full total) vs verification.ts:93-101 (dueNow);
  src/app/api/payments/stripe/quote/route.ts:32-33 (full) vs
  create/route.ts:68-71 (dueNow)
- R7-U03: BREAK cross-gateway parity:
  travel-scaffold/src/lib/payments/bkash/payability.ts:14 omits
  PARTIALLY_REFUNDED/REVIEW_REQUIRED vs nagad/payability.ts:19-26
- R7-U04: BREAK Stripe refund wiring 3 hops:
  travel-scaffold/src/lib/folio/folio.ts:108-115,158-162;
  src/lib/night-audit/audit.ts:201-203,230;
  src/lib/ledger/auto.ts:187-206 vs dashboard metrics.ts:154-158 includes
- R7-U05: BREAK settlement hop wired: no payment-to-transfer link; clearing
  accumulates (auto.ts:183); EXPENSE_BANK_CHARGES only in manual transfer
  (app/actions/finance-actions.ts:422)
- R7-U06: BREAK outflow approve-hop universal: inventory ISSUE/WASTE
  single-actor INVENTORY.create (app/actions/inventory-actions.ts:144-161) ->
  STOCK_USED/STOCK_LOSSES via sweep, no approval; plus prior-inspected
  single-control bills/transfers/reversals + OWNER-only payroll (prior
  result 2 evidence, corroborated)
- R7-U07: BREAK cancel routing:
  travel-scaffold/src/app/actions/admin-actions.ts:978-980 omits
  STRIPE/BANGLAQR/PARTIALLY_REFUNDED -> DESK REFUNDED + folio REFUND L1020-1044
- R7-U08: BREAK self-cancel safety:
  travel-scaffold/src/app/api/bookings/self-cancel/route.ts:23 includes
  CONFIRMED; L68-69 unguarded tx update to CANCELLED, payment untouched
- R7-U09: BREAK tax remainder:
  travel-scaffold/src/lib/folio/folio.ts:305-336 cap-only, no sweep;
  absorption comment false
- R7-U10: BREAK FolioView projected:
  travel-scaffold/src/app/admin/bookings/[id]/folio/FolioView.tsx:127,307
  room-only vs folio.ts:224 projectedBalancePoisha incl tax
- R7-U11: BREAK no-float-lint completeness: scripts/check-no-float-money.sh
  names-only; live float math at lib/payments/stripe/config.ts:63-69 +
  refund.ts:43 dup, app/actions/rates-actions.ts:53 (verified); PMS coerce +
  settings feeBdt*100 (prior inspected)
- R7-U12: UNVERIFIED-BY-ME (prior inspected, unrefuted): bkash/nagad/ssl
  execute/verify binding + dedupe mechanics; desk-refund caps; BanglaQR
  missing-refund-path consequences; void-on-REVIEWED staleness; RS void
  orphan; shift/day skew - carried from prior results 1/2/4/5, recommend spot
  re-check before sign-off

### workflow wrapper

- critic: missing verdict
  [Note: stale wrapper flag - the critic submission (prior result 7) WAS
  received and incorporated above: 14 surviving claims, 12 breaks/gaps
  F1-F12, 3 prior gaps closed.]

# Money flow — demo1 branch

Date: 2026-10-29. Branch: `client/demo1`. Code refs are branch paths.
All amounts are integer poisha (`src/lib/money.ts`); the legacy Float columns
(`pricePerNight`, `totalAmount`, `amount`) are write-side mirrors only
(`src/lib/money-legacy.ts` is the one file allowed to name them) — no float
math exists in any money path (enforced by `scripts/check-no-float-money.sh`).

## 1. The one-paragraph version

Money **enters** as payments (gateway online, or desk cash/card/mobile),
**sits** against a booking's folio as credit, and is **earned** as room
charges post night-by-night at the night audit. **Expenses never touch a
guest folio.** The **ledger** (double-entry journal) is the books; the
**folio** is the per-booking subledger. One journal entry per source
(`sourceKey` unique, idempotent).

## 2. Where money increases and decreases — the folio

FolioLine kinds (`prisma/schema.prisma:966-972`): `ROOM_CHARGE`,
`EXTRA_CHARGE`, `DISCOUNT`, `PAYMENT`, `REFUND`. Lines are append-only;
corrections are reversal lines (`reversalOfId`), never edits.

Direction (`src/lib/folio/ledger.ts:11-18`): `ROOM_CHARGE`, `EXTRA_CHARGE`,
`REFUND` **increase** what the guest owes (debits); `PAYMENT`, `DISCOUNT`
**decrease** it (credits). A reversal flips the sign.

Folio balance = charges − discounts − payments + refunds
(negative = guest in credit). `folioTotals()` (`ledger.ts:74-88`).

**Gateway money is not FolioLine rows.** `loadFolio()` (`folio.ts:89-209`)
projects `Payment` rows (`source: "GATEWAY"`, collected statuses) as PAYMENT
entries and completed gateway refunds as REFUND entries
(`source: "GATEWAY_PAYMENT"` / `"GATEWAY_REFUND"`). Only **desk**
payments/refunds are real FolioLine rows. The dashboard counts each source
once — no double count.

## 3. How room revenue is earned (accrual)

- The night-audit **close** posts `ROOM_CHARGE` lines for **CHECKED_IN stays
  only**, one per night up to and including the closing date, stamped
  `businessDate` = closing date, `nightOf` = the night
  (`src/lib/night-audit/audit.ts:244-310`, `postRoomNights()`).
  Idempotency key `room:{bookingId}:{night}:{reversals}`.
- Nightly split (`ledger.ts:30-52`): the remaining `(total − posted)` is spread
  over unposted nights — `floor` each night, remainder to the first nights —
  so posted charges always sum **exactly** to the booking total, even if a
  manager changed the total mid-stay.
- `NO_SHOW` / `PENDING` / `CANCELLED` bookings never earn room charges.
  **No no-show fees exist** (a no-show is a manager decision, no charge posts).
- Booking totals are **server-computed** (`pricePerNightPoisha × nights`,
  `src/app/api/bookings/route.ts:129-194`); never client-supplied.

## 4. How cash is collected

- **Gateway** (bKash / Nagad / SSLCommerz / BanglaQR): `INITIATED → SUCCESS /
  FAILED / CANCELLED`, later `PARTIALLY_REFUNDED` / `REFUNDED`. Guarded
  transitions (exactly-one-winner on double callbacks); amount verified
  ±1 poisha vs the booking total. `SUCCESS` → folio credit, booking toward
  `CONFIRMED`.
- **Desk** (`recordFolioPaymentAction()`): `PAYMENT` line; methods
  `CASH / CARD / BKASH / NAGAD / BANK_TRANSFER / OTHER` (non-cash needs a
  reference). **Cash is refused without the recorder's open shift**; the line
  links to the shift (`cashShiftId`).
- **Refunds:** gateway refunds live in per-gateway tables
  (`REQUESTED → COMPLETED / FAILED / UNKNOWN`); `COMPLETED` updates
  `payment.refundedAmountPoisha` and the payment status. **Desk refunds** are
  `REFUND` lines, guarded: `refunds ≤ net desk payments` — desk refunds pay
  back desk money only; online money is refunded through its gateway.
- **Simulate mode** (`src/demo-payments/`) mirrors the real gateway flows and
  feeds the **production confirmation path** (real rows, real transitions);
  only the cryptographic verification step is simulated — no real money moves.

## 5. Expenses

- Categories (`src/lib/expenses/constants.ts`): `UTILITIES, FUEL, REPAIRS,
  TRANSPORT, SUPPLIES, MARKETING, STAFF_WELFARE, FEES_TAXES, BANK_CHARGES,
  OTHER`. Numbered `EX-YYYYMM-NNNN`; `SUBMITTED → APPROVED`; `expenseDate`
  cannot be after the entry business date.
- **Never touch the folio.** They post to the **ledger only**, and only when
  `APPROVED` (`src/lib/ledger/auto.ts:212`):
  `Dr EXPENSE_<category> / Cr PETTY_CASH` (cash) | `MOBILE_WALLET`
  (bKash/Nagad) | `BANK` (everything else).
- Expenses **never reduce revenue** — separate EXPENSE accounts.

## 6. Cash drawers

- Cash `PAYMENT`/`REFUND` lines attach to the recorder's open shift
  (`src/lib/cash/shift.ts`): `expectedCash = openingFloat + Σ(lines)` where
  PAYMENT = +1, REFUND = −1, reversals flip.
- Close: counted vs expected → `variancePoisha` (short/over);
  `NEEDS_REVIEW` → manager sign-off (surfaced as `cashShiftsToSignOff` on the
  daily sheet).
- Ledger: only REVIEWED shifts with nonzero variance post — over:
  `Dr DESK_CASH / Cr CASH_OVER_SHORT`; short: `Dr CASH_OVER_SHORT /
  Cr DESK_CASH`.
- Desk cash (`DESK_CASH`) and petty cash (`PETTY_CASH`, for expenses) are
  **separate accounts by design**.

## 7. The ledger — the books

Double-entry journal; one entry per source; dated by the source's
business/expense date. Auto-posting (`src/lib/ledger/auto.ts`, via the
currently-**unscheduled** `ledger-posting` cron):

| Source | Debit | Credit |
|---|---|---|
| `ROOM_CHARGE` | `GUEST_RECEIVABLE` | `ROOM_REVENUE` |
| `EXTRA_CHARGE` | `GUEST_RECEIVABLE` | `FOOD_REVENUE` (food/minibar) else `OTHER_GUEST_INCOME` |
| `DISCOUNT` | `DISCOUNTS` (contra-revenue, code 4900) | `GUEST_RECEIVABLE` |
| Desk `PAYMENT` | money account by method | `GUEST_RECEIVABLE` |
| Desk `REFUND` | `GUEST_RECEIVABLE` | money account by method |
| Gateway payment | `GATEWAY_CLEARING` | `GUEST_RECEIVABLE` |
| Gateway refund | `GUEST_RECEIVABLE` | `GATEWAY_CLEARING` |
| Approved expense | `EXPENSE_<category>` | `PETTY_CASH` / `MOBILE_WALLET` / `BANK` |
| Cash variance (reviewed) | `DESK_CASH` or `CASH_OVER_SHORT` | `CASH_OVER_SHORT` or `DESK_CASH` |

Reversals swap the two sides. P&L = INCOME vs EXPENSE by natural balance
(`reports.ts`); discounts appear as a negative income line, **not** netted
against room revenue.

## 8. The five "revenue" numbers — what each actually means

They do **not** match each other. That is correct, not a bug — read the
definitions before comparing.

| # | Where | Label | Definition | Date basis |
|---|---|---|---|---|
| 1 | `/admin` KPI | Revenue Today / This Month | **Cash collected**: gateway payments arrived + desk folio payments − completed gateway refunds − desk refunds. Includes prepayments for future stays; excludes earned-but-unpaid nights. (`src/lib/dashboard/metrics.ts`, `collected()`) | Gateway: arrival instant (`executedAt`→`verifiedAt`→`createdAt`); desk: `businessDate` (**fixed 2026-10-29** — was `createdAt`) |
| 2 | `/admin` KPI | ADR / RevPAR (month) | **Earned** room revenue, prorated by nights, for sold bookings (`CONFIRMED/CHECKED_IN/COMPLETED`); **gross of discounts**; extras excluded. | Stay nights falling in the month |
| 3 | `/admin` KPI | Booked value (month) | Pipeline: Σ totals of sold bookings checking in this month. **Not revenue.** | Check-in month |
| 4 | Daily sheet, owner block | Yesterday: collected / room revenue | `collected = deskPayments + onlinePayments − deskRefunds − onlineRefunds` for the closed day; `roomRevenue` = net `ROOM_CHARGE` lines with `nightOf` = date. (`night-audit/audit.ts:181-230` → `BusinessDay.summary`) | Desk: `businessDate`; room: `nightOf`; online: arrival instant |
| 5 | Ledger P&L | Income | Journal INCOME accounts incl. the contra `DISCOUNTS` line. | Entry (source) date — **currently unfed** (cron unscheduled) |

Reading guide: **1 = cash, 2 & 4-room = earned, 3 = pipeline, 5 = the books.**

## 9. Classification summary

- **Revenue (earned):** `ROOM_REVENUE`, `FOOD_REVENUE`, `OTHER_GUEST_INCOME`.
  Contra-revenue: `DISCOUNTS` (4900) — tracked separately, never netted.
- **Cash in:** `DESK_CASH`, `PETTY_CASH`, `BANK`, `MOBILE_WALLET`,
  `CARD_CLEARING`, `GATEWAY_CLEARING`.
- **Receivable:** `GUEST_RECEIVABLE`.
- **Expenses:** 10 `EXPENSE_*` + `STOCK_USED`, `STOCK_LOSSES`,
  `CASH_OVER_SHORT`, `SALARIES`, …
- Decreases revenue: `DISCOUNT` lines (contra). Cash out via refunds (P&L
  treatment — see §11.2). Never touches revenue: expenses, cash variances.
- Taxes: **none computed** — prices are tax-inclusive by design
  (`schema.prisma:1012`); `FEES_TAXES` is an expense category for taxes the
  business itself pays.

## 10. Anomalies found and FIXED (2026-10-29)

1. **Dashboard desk money vs close summary disagreed on the day.**
   `collected()` keyed desk `PAYMENT`/`REFUND` lines by `createdAt` while the
   night-audit summary uses `businessDate` — a 01:30 desk payment appeared in
   the new calendar day's Revenue card *and* the still-open business day's
   close. Fixed: desk lines keyed by `businessDate` (commit `17bffe2`).
2. **`pending-expiry` missing from the JOBS registry**
   (`src/lib/system/jobs.ts`) → invisible to `/admin/system` health, and the
   `jobs.test.ts` registry test was failing. Registered (commit `17bffe2`).
3. **Night-audit `staleAfterHours: 3` vs the daily schedule** → `/admin/system`
   would flag it red ~21h/day. Set to 26h with the real `5 22 * * *` schedule
   (commit `17bffe2`).

## 11. Flagged, NOT changed — your call

1. The "Revenue" card is **collections**, not earned revenue. Consider
   renaming to "Collected Today / This Month" (or keep it as the cash KPI —
   but then say so on the card).
2. **Refunds don't reverse P&L income.** A refund posts
   `Dr GUEST_RECEIVABLE / Cr <money>` — `ROOM_REVENUE` keeps its credit, so a
   fully refunded stay leaves P&L income intact while cash nets to zero (the
   dashboard nets correctly via `gross − refunds`). Options: a contra
   "Refunds" income account mirroring `DISCOUNTS`, or netting against revenue.
3. **ADR/RevPAR are gross of discounts** (industry usually nets them) —
   definition choice, flagged.
4. **Ledger unfed** until `ledger-posting` is scheduled → P&L / trial balance
   show nothing until then.
5. **Over-posted nights never claw back**: if a manager reduces a booking
   total below what's already posted, remaining nights post 0 and the excess
   stays — discounts are the intended tool, nothing enforces their use.
6. A mobile payment recorded at the desk **and** completed online would count
   twice (gateway + desk line); prevented only by discipline today.
7. The dashboard's day anchor is the property **calendar** date while the
   daily sheet follows the **business** day — they coincide whenever the
   business day is current (the normal state now that the audit cron runs);
   the 00:00–04:00 window attributes late-night desk cash to the still-open
   business day by design.
8. Early check-in / late check-out are **manual** `EXTRA_CHARGE` lines
   (categories exist; no automatic computation).

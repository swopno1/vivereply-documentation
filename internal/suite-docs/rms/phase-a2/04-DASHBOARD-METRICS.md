# Phase A2 §6: dashboard KPI formulas

The dashboard at `/admin` replaces the A1 audit's F8 numbers with real metrics. The code is `src/lib/dashboard/metrics.ts` (`loadDashboardMetrics`), and every formula below is tested in `metrics.test.ts` (pure parts) and `metrics.db.test.ts` (against a real database).

## 1. Time: the business day

- **Property timezone:** `getPropertyTimezone()` (Settings → General, default `Asia/Dhaka`, §5). The server's own TZ is never used.
- **Today:** the calendar date of "now" in that zone (`businessDate()`, `src/lib/timezone.ts`).
- **Two kinds of value, compared differently:**
  - **Instants** (when money arrived): compared with the UTC instant at which a local day starts, `zonedDayStart()`. In Dhaka, 7 Oct begins at `2026-10-06T18:00Z`.
  - **Stay dates** (`Booking.checkInDate` / `checkOutDate`): calendar dates stored as UTC midnight (`"2026-10-07"` → `2026-10-07T00:00Z`), compared with `dateOnly(today)`. Shifting them by the zone offset would be wrong.
- **A night** belongs to the date it starts on. A stay `[checkIn, checkOut)` occupies the nights `checkIn … checkOut − 1`; the checkout day is not a night.
- **Month to date (MTD):** the 1st of the current local month up to and including today (`[monthStart, tomorrow)`).

`src/lib/timezone.ts` uses only `Intl.DateTimeFormat`, no library. It handles DST (tested with Europe/London and a skipped midnight in America/Santiago), though Bangladesh has none today. The Nagad helper `payments/nagad/time.ts` was **not** moved into it: Nagad's timestamps must be Dhaka time by protocol whatever the property's zone, and payment code is out of scope.

## 2. Money: what counts as collected

A payment is **collected** when its status is one of:

| Status | Meaning |
|---|---|
| `SUCCESS` | gateway captured, or Bangla QR verified |
| `PARTIALLY_REFUNDED`, `REFUNDED` | captured, then (partly) refunded; the refund is subtracted separately |
| `PAID` | offline sale recorded as paid at the desk |

**Received at:** `executedAt` (gateway capture) → else `verifiedAt` (Bangla QR) → else `createdAt` (desk sales, legacy rows).

**Refunds:** `BkashRefund`, `NagadRefund` and `SSLCommerzRefund` rows with `status = COMPLETED`, dated by `completedAt`.

**Not counted:**
- `INITIATED`, `FAILED`, `CANCELLED`, pending verification and every other status.
- **`PARTIAL` desk sales.** The offline booking form stores the booking's full total on a part-paid sale, so the amount actually received is unknown. They are left out, and the dashboard shows how many were left out this month in an amber note. Recording real part-payments needs the guest folio (Phase B).

## 3. The KPIs

| Card | Formula |
|---|---|
| **Revenue Today** | Σ `amountPoisha` of collected payments received in `[today 00:00, tomorrow 00:00)` local − Σ completed refunds in the same window. The card shows the net; the line under it shows "Received X · refunds Y". |
| **Revenue This Month** | the same over `[1st 00:00, tomorrow 00:00)` local |
| **Occupancy Today** | occupied ÷ bookable. **Occupied:** bookings with status `CONFIRMED` or `CHECKED_IN` and `checkIn ≤ today < checkOut`. **Bookable:** RoomUnits that are active, not archived, and not `MAINTENANCE`/`OUT_OF_ORDER` (`bookableUnitWhere()`, §1). Shows "—" with no units. |
| **Available Units Tonight** | Σ over room types of `getRoomAvailability(room, [today, tomorrow)).available`: the same engine that sells rooms (§1), so it counts `PENDING` holds and pre-A2 bookings without a unit |
| **Arrivals Today** | bookings with `checkInDate = today` and status `CONFIRMED` or `CHECKED_IN`. Sub-line: how many are already `CHECKED_IN`. |
| **Departures Today** | bookings with `checkOutDate = today` and status `CHECKED_IN` or `COMPLETED`. Sub-line: how many are `COMPLETED`. |
| **In-House** | bookings with status `CHECKED_IN` |
| **Pending Verifications** | bookings in `PENDING_MANUAL_VERIFICATION` with a Bangla QR payment in `PENDING_VERIFICATION` or `RECEIPT_REQUESTED`: the same selection as the verification queue (`payments/banglaqr/queue.ts`) |
| **Booked Value This Month** | Σ `totalAmountPoisha` of **sold** bookings (`CONFIRMED`, `CHECKED_IN`, `COMPLETED`) whose `checkInDate` falls in this calendar month (whole month, not MTD). Labelled as booked, not collected. |
| **ADR** | room revenue MTD ÷ room-nights sold MTD |
| **RevPAR** | room revenue MTD ÷ available room-nights MTD |
| **Payments by method** | collected payments this month, grouped by `provider`, with count. Gross, before refunds. |

**MTD definitions for ADR and RevPAR:**
- **Room-nights sold:** for every sold booking, the nights of its stay that fall in `[1st, tomorrow)`.
- **Room revenue:** each sold booking's total spread evenly over its nights (`round(total × nightsInWindow ÷ totalNights)`), summed over those nights. A 3-night ৳9,000 stay contributes ৳3,000 per night that falls in the window.
- **Available room-nights:** bookable units now × days from the 1st to today inclusive.

A ratio with a zero denominator shows "—", never ৳0.

### Example (from `metrics.db.test.ts`, "today" = 15 July, Dhaka)
- **Payments:**
  - bKash ৳2,000 at 09:00 today and Bangla QR ৳500 verified at 00:30 today count for today.
  - Nagad ৳700 at 23:30 yesterday counts for the month only.
  - A ৳111.11 payment at 23:59 on 30 June counts for neither.
- **Revenue Today:** received ৳2,500, refunds ৳250, net ৳2,250.
- **The same data in Europe/London:** only the 09:00 Dhaka payment is "today", because 00:30 Dhaka is still the 14th in London.

## 4. Deviations from the brief, and why

1. **ADR and RevPAR use room revenue earned per night, not collected cash.** The brief says "revenue / room-nights sold". Dividing *collected* money by nights mixes two bases. A deposit taken in October for a December stay would raise October's ADR, and a month of pay-at-checkout stays would show ADR near zero. Spreading each sold booking's total over its nights is the standard hotel definition, and it keeps RevPAR = ADR × occupancy. The revenue cards stay cash-based, as the brief asks.
2. **Occupancy counts bookings, not distinct units.** This follows the brief's §6.1. Bookings with no unit (pre-A2) still occupy a room. A booking on a unit later marked out of service still counts as occupied but is not in the denominator, so occupancy can briefly exceed 100% in that edge case. The number is shown as computed rather than capped.
3. **Brief's "unchanged" panels.**
   - **Operational alerts:** the zero-availability alert now uses units for tonight instead of the deprecated `Room.availableUnits` counter. Payment code still decrements that counter on confirmation, so it is not a real count (§1).
   - **The old "Payment Methods & Gateway Performance" card was wrong and has been replaced.** It showed the whole month's booked value as bKash income and hard-coded ৳0 "Scaffold" tiles for Nagad and SSLCommerz. It is now the real per-method breakdown, with the CSV export link kept and its text translated.
   - **Recent bookings and Upcoming arrivals** are unchanged, except that "upcoming" now starts from the property's today rather than the server's.
4. **Visibility.** The dashboard needs `REPORTS.view` (OWNER, MANAGER, ACCOUNTANT, AUDITOR). The money cards (both revenue cards, the MTD row and payments by method) also need `FINANCE.view`. Today that is the same four roles, but the cards follow the matrix if it changes.

## 5. Known limits

- **Available room-nights for past days use today's unit count.** There is no unit-status history yet: a unit taken out of service on the 10th is missing from the RevPAR denominator for the 1st–9th as well. A nightly snapshot comes with night audit (Phase B).
- **Room revenue includes everything in the booking total.** The booking total is the only figure there is; extras will separate out with the folio (Phase B).
- **Legacy rows:** payments from before the gateway hardening have no `executedAt` and are dated by `createdAt`. A NULL `amountPoisha` fails loudly (`requirePoisha`), as everywhere since A1.
- **Bookings waiting for Bangla QR verification** used to leave their unit free, which Available Units Tonight then counted as sellable. Fixed by FU-7: they now hold the unit, so the card counts them as taken.

## 6. Evidence

### Automated
| Suite | Result |
|---|---|
| `src/lib/timezone.test.ts` | Dhaka day boundary (17:59:59Z vs 18:00Z), the same instant in two zones, London BST/GMT midnights, the day after a DST change, a DST-skipped midnight (Santiago), independence from `process.env.TZ`, month and year rollover |
| `src/lib/dashboard/metrics.test.ts` | nights in a window (checkout day excluded), proration (rounding, cap, zero nights), null ratios |
| `src/lib/dashboard/metrics.db.test.ts` (`*_test` DB) | every card against fixtures in a random far-future July: revenue today and month (including the 00:30 and 23:30 boundary payments, failed, part-paid and next-month rows, and a completed bKash refund), the same data in Europe/London, occupancy with a maintenance unit, available tonight, arrivals, departures, in-house, pending verifications, booked value, room-nights, ADR and RevPAR |

### Live (production build, scratch DB `resort_a2s6_test`, 360px, signed in as `test-manager@demo.resort`)
Seed data plus 4 bookings and 5 payments dated around 7 Oct 2026, and one unit put in maintenance (38 bookable units).

**Independent SQL check** straight from the Payment table, using Postgres's own timezone conversion:
```
 dhaka_today | today_poisha | month_poisha
-------------+--------------+--------------
 2026-10-07  |      2000000 |      2900000
```

**The dashboard (EN):**
```
Revenue Today | ৳20,000 | Received ৳20,000 · refunds ৳0
Revenue This Month | ৳29,000 | Received ৳29,000 · refunds ৳0
Occupancy Today | 5% | 2 of 38 units occupied
Available Units Tonight | 36
Arrivals Today | 1 | 0 checked in
Departures Today | 1 | 1 checked out
In-House | 1
Pending Verifications | 1
Booked Value This Month | ৳29,000 | 3 sold bookings checking in this month
ADR (Average Daily Rate) | ৳4,000 | … 6 room-nights sold
RevPAR | ৳90.23
bKash ৳15,000 · Nagad ৳9,000 · Cash ৳5,000
```
- **Hand calculation:**
  - ADR = (2 nights of a ৳15,000 3-night stay = ৳10,000) + ৳5,000 + ৳9,000 = ৳24,000 over 6 nights = ৳4,000.
  - RevPAR = ৳24,000 ÷ (38 units × 7 days) = ৳90.23.
- **Part-paid desk sale:** shown in the note "1 part-paid desk sales this month are not counted…".

**Timezone switched to Europe/London** in Settings: the bKash payment captured at 01:00 Dhaka on 7 Oct (19:00Z on the 6th) moved to the 6th, so Revenue Today became **৳5,000** while the month stayed ৳29,000.

**Bengali:** every card in Bengali with Bengali digits, for example "আজকের অকুপেন্সি | ৫% | ৩৮টি ইউনিটের মধ্যে ২টি ভর্তি". The first BN pass printed Latin digits and "2 এর মধ্যে 38", with the numbers in the wrong order; fixed with a per-language template and `Intl.NumberFormat("bn-BD")`.

**Layout:** `scrollWidth` was 345 at a 360px viewport in both languages; the recent-bookings table scrolls inside its card, as before.

# Phase B §1: business date and no-show status

## Business date

**What it is:** the date the front desk is working, in the property timezone. It is the single `OPEN` row of the new `BusinessDay` table (migration `20261008100000_business_day`).

**When it moves:** it doesn't follow the clock. It moves only when the night audit (§3) closes the day, or when the 04:00 fallback cron does. Between midnight and the audit it is still "yesterday", as in any PMS:
- arrivals, room charges and the daily sheet stay on the day that hasn't been audited;
- nothing slips into the next day half-done.

**First use:** on a fresh install the first open day is the property's calendar date. `getOpenBusinessDay()` creates it on first use with `INSERT … ON CONFLICT DO NOTHING`, so racing first requests open exactly one day. A test runs 20 at once.

**Database guards:**
- `BusinessDay_single_open`, a partial unique index, allows at most one `OPEN` row.
- `BusinessDay_date_format` requires the `YYYY-MM-DD` format.
- `BusinessDay_closed_fields` requires every `CLOSED` row to have `closedAt`, and no `OPEN` row to have one.

**Who uses it:**
- The **Front Desk page** (`/admin/front-desk`) now lists arrivals and departures for the business date instead of the calendar date.
- The daily sheet (§4) and night audit (§3) build on it.
- The **dashboard** still reports by calendar date. Business KPIs are calendar-based, and the night audit snapshot (§3) is the per-business-day record.

## No-show status

**What it is:** `NO_SHOW` is a new value of `Booking.status` (`src/lib/bookings/status.ts`). It means a guest who was due and never arrived.

**Who sets it and when:**
- Only a manager or owner sets it (`FRONT_DESK.approve`, owner decision 2026-10-07), from the night audit (§3) or the booking.
- Only from `PENDING`, `CONFIRMED` or `PENDING_MANUAL_VERIFICATION`.
- Not before the arrival date (by business date).
- Never for a guest already checked in.
- The gateway in-flight guards on status changes still apply.

**Effects:**
- The unit is released: `NO_SHOW` isn't a live status, so the overlap constraint and availability ignore it.
- Payments are kept, per the refund policy. Nothing is refunded automatically.
- It isn't "sold" in the dashboard KPIs.

**Labels:** "No-show" / "নো-শো" with an orange badge in the bookings list, booking detail, guest history, dashboard and front desk, plus a bookings filter option.

## Tests

| Suite | Covers |
|---|---|
| `src/lib/business-day.db.test.ts` | First use opens the calendar date in the property timezone (00:30 in Dhaka is already the next day); the date stays put as the clock moves; 20 concurrent first requests open one day; the database refuses a second open day, a malformed date and a closed day with no close time |
| `src/app/actions/no-show.db.test.ts` | A manager marks a due arrival as no-show and the unit is bookable again for those dates; front desk is refused; refused before the arrival date; refused for a checked-in stay |

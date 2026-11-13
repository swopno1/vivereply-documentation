# Bookings — Staff Training Module

**Page:** `/admin/bookings` — the booking directory.
**Audience:** front desk (primary), managers.
**Time to complete:** about 20 minutes.
**Prerequisite:** none. This is the central module — bookings touch guests,
rooms, money, and almost every other page. Read it before the sub-modules.

## Learning objectives

After this module you can:

- Find any booking in seconds and read the list correctly.
- Explain the booking lifecycle and what each status means.
- Know which sub-page does what: new booking, booking detail, folio.

## 1. What the directory is

Every reservation and stay in the property, newest first, 20 per page. It
is the front desk's phone book: when a guest calls, you find them here.

**Finding a booking:** the search box matches **booking code, guest name,
phone, or email** — type any fragment. Narrow with the **status filter**
(All Statuses, or one option per status: Pending, Pending Verification,
Confirmed, Checked In, Completed, Cancelled, Expired, No-show), the
**room filter** (active room types only), or a **check-in date range**,
then **Apply Filters** (or **Reset Filters** to start over). Every filter
lives in the URL, so a filtered view can be bookmarked or shared.

Each row shows number, guest, room, check-in, check-out, nights, guest
count, total, paid amount, source, status and payment-status badges, and
created date. **Select columns** trims the table to what you need;
**Export (CSV)** downloads what the filters show; **New Booking** starts
an offline reservation.

## 2. The booking lifecycle

A booking moves through these statuses — mostly forward, never backward.
The one backward path lives outside the action buttons: a CANCELLED booking
can be re-opened to PENDING or CONFIRMED.

| Status | Meaning |
|---|---|
| **PENDING** | Just created (often by the Chatbot draft flow), not yet confirmed |
| **PENDING_MANUAL_VERIFICATION** | Online payment needs a human check (e.g. BanglaQR receipt) |
| **CONFIRMED** | Accepted — the room is held |
| **CHECKED_IN** | Guest is in the building |
| **COMPLETED** | Stay over, checked out, settled |
| **CANCELLED** | Cancelled (refund decision recorded) |
| **NO_SHOW** | Never arrived, room released, payments kept |
| **EXPIRED** | Unpaid PENDING booking auto-expired after 24h without payment evidence (unit released) |

**The transitions staff perform** (from the booking's action buttons):

- **PENDING → CONFIRMED** — a manager approves the booking.
- **CONFIRMED → CHECKED_IN** — check-in. If the room isn't inspected, you
  get the housekeeping warning (*check in anyway?*) — it warns, never
  blocks.
- **CHECKED_IN → COMPLETED** — checkout. Blocked while room-service orders
  are open or the folio has a balance — settle first. A manager (approve
  permission) may check out with a balance due by giving a written reason,
  which is recorded in the status history.
- **→ CANCELLED** — opens the **refund decision**: refund or not, and for
  online payments the gateway path is handled.
- **→ NO_SHOW** — decided at night audit for arrivals that never came.

**Editing** is allowed only in editable statuses (not cancelled/completed),
and **any amount change needs a written reason** — it lands in the status
history.

## 3. The sub-pages

| Page | Docs | What it's for |
|---|---|---|
| `/admin/bookings/new` | [New Booking](new/) | Taking a reservation at the desk |
| `/admin/bookings/[id]` | [Booking Detail](detail/) | The booking's full record: guest, stay, payments, status history, actions |
| `/admin/bookings/[id]/folio` | [Folio](detail/folio/) | The guest's bill: charges, payments, discounts, refunds, balance |

## 4. How bookings connect to everything

This is why the module matters most:

- **Guests** — every booking belongs to a guest record (name, phone, email,
  NID/passport, address).
- **Rooms & units** — the stay holds a room type and (at check-in) a
  physical unit; the unit's housekeeping state gates readiness.
- **Money** — the total amount, online payments (bKash/Nagad/SSLCommerz/
  BanglaQR/Stripe), desk payments on cash shifts, and the **folio** where
  every charge and payment lands.
- **Front desk** — arrivals, departures, and in-house lists are bookings
  filtered by date and status.
- **Daily sheet** — its stay tables and money-due are bookings; its owner
  summary reads their payments.
- **Night audit** — posts room charges to in-house folios, decides missing
  arrivals, closes the day bookings live in.
- **Room service** — orders attach to checked-in bookings and charge their
  folios.
- **Chatbot** — drafts arrive as PENDING bookings with codes like
  RES-202610-00003.

## 5. Troubleshooting

| Symptom | Check first |
|---|---|
| Can't find a booking | Search matches code/name/phone/email — try a different fragment; check the status filter isn't hiding it. |
| Edit button missing | The booking is cancelled/completed (locked), or you lack edit permission. |
| Checkout won't complete | Open room-service orders or an unsettled folio balance — settle first, or ask a manager to check out with a written reason. |
| Amount change rejected | A reason is required for every amount change. |

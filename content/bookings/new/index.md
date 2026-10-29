# New Booking — Staff Training Module

**Page:** `/admin/bookings/new` — taking a reservation at the desk.
**Audience:** front desk (primary).
**Time to complete:** about 15 minutes.
**Prerequisite:** the [Bookings](..) module.

## Learning objectives

After this module you can take a clean booking: right guest, right stay,
right payment terms, right source.

## 1. The four sections

### Guest

Name, **phone**, email. The phone is the operational key — it's what the
front-desk page dials and what the Chatbot uses for staged verification.
Get it right, digit by digit.

### Stay

Room type (active rooms with per-night price and max guests shown),
check-in and check-out dates, **guest count**, and the **total amount**.
The total is computed from the stay — if you override it, you're making a
pricing decision; be ready to justify it.

### Payment

- **Payment status:** PAID (full amount received), PARTIAL (some received),
  UNPAID, or PAY_AT_CHECKIN.
- **Payment method:** Cash, bKash, Nagad, SSLCommerz, BanglaQR, or Other.
- **Payment reference:** the transaction/bill number — the thread you'll
  pull if the payment is ever disputed.

**Honesty rule:** mark PAID only when the money is actually in hand (or
confirmed by the gateway). A PARTIAL booking with the real received amount
is always better than a PAID booking built on hope — the folio and the
money-due list both trust this field.

### Details

**Source** — Walk-in, Phone, Email, or Referral. This is marketing data:
it tells the owner where bookings come from. Don't default everything to
Walk-in. **Notes** — anything the next shift should know.

## 2. After saving

The booking appears in the directory (usually as PENDING or CONFIRMED
depending on your flow) with its code (e.g. RES-202610-00003). The guest
can now be checked in from the front-desk page when they arrive.

## 3. Troubleshooting

| Symptom | Check first |
|---|---|
| Room not in the dropdown | Only active rooms show — check the room is active. |
| Guest count rejected | It can't exceed the room's max guests. |
| Payment marked PAID but money missing | Fix the status to PARTIAL/UNPAID immediately — the folio trusts this field. |

# Booking Detail — Staff Training Module

**Page:** `/admin/bookings/[id]` — one booking's full record.
**Audience:** front desk (primary), managers.
**Time to complete:** about 20 minutes.
**Prerequisite:** the [Bookings](..) module.

## Learning objectives

After this module you can read every card on the page, edit safely, run
the status transitions, and handle BanglaQR verifications.

## 1. The header

The **booking code** (e.g. RES-202610-00003) in large type with the
**status badge** beside it — the two things you'll quote on every phone
call. Action buttons on the right: **Edit booking**, **Folio**, and the
status-transition buttons (confirm, check in, check out, cancel), each
gated by your permissions.

## 2. The cards, top to bottom

- **Guest information** — name, email, phone, NID/passport, address.
  *"Not provided"* means exactly that — collect it at check-in.
- **Room and stay** — room type, **physical unit** (assigned at check-in),
  destination, dates, nights, price per night, total, guest count.
- **Status history** — every status change with who and when. This is the
  booking's audit trail; amount changes land here with their reasons.
- **Payment transactions** — every online payment attempt with provider,
  status, and card/wallet detail where available. Unresolved Nagad /
  SSLCommerz refunds show their resolve form or progress note here;
  settled ones live in the audit log.

## 3. Editing

**Edit booking** opens the full form (guest, room, dates, guest count,
amount, payment status). Rules:

- Only in **editable statuses** — cancelled and completed bookings are
  locked (*"Edit not allowed"*).
- **Every amount change needs a written reason** — it's recorded in the
  status history.
- If there's a single payment, you can also correct its status here.

## 4. Status transitions (the action buttons)

- **Confirm** (PENDING → CONFIRMED) — manager approval.
- **Check in** (CONFIRMED → CHECKED_IN) — assigns the unit; warns if the
  room isn't inspected (warns, never blocks).
- **Check out** (CHECKED_IN → COMPLETED) — blocked by open room-service
  orders or an unsettled folio.
- **Cancel** — opens the **refund decision modal**: refund or not, with the
  online-payment path noted for gateway payments.

## 5. BanglaQR verifications

Bookings paid via BanglaQR that need a human eye show **verify / reject**
controls here (plus confirm-without-receipt and delete-receipt actions,
each requiring a written reason). This is the **PENDING_MANUAL_VERIFICATION**
queue made actionable — verify promptly; the guest is waiting on their
confirmation.

## 6. Troubleshooting

| Symptom | Check first |
|---|---|
| Edit button missing | Booking is cancelled/completed, or you lack edit permission. |
| Check-in warns about the room | Housekeeping state — check the guest in anyway, then chase housekeeping. |
| Check-out blocked | Open room-service ticket or folio balance — settle first. |
| Cancel asks about refunds | Answer deliberately — the refund decision is recorded and gateway-linked. |

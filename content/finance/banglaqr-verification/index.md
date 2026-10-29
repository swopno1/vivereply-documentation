# BanglaQR Verification — Staff Training Module

**Page:** `/admin/payments/banglaqr-verification` — guest payments waiting
for a human check.
**Audience:** managers (primary), front desk.
**Time to complete:** about 15 minutes.
**Prerequisite:** the [Bookings](../..) module.

## Learning objectives

After this module you can work the verification queue quickly and
correctly — and you know where it lives now.

## 1. Where it lives

The queue moved off the sidebar into **Finance → Waiting for approval**
(founder decision, 2026-10-30): it's a finance task, not a department.
The page URL is unchanged, and it's still reachable from the night-audit
checklist banner, the daily sheet's owner summary, and the booking
detail's verify controls.

**Permission:** FINANCE approve (manager+). Guests' payments must never
wait on someone without authority.

## 2. What the queue is

Bookings with status **PENDING_MANUAL_VERIFICATION**: the guest paid via
BanglaQR (QR payment), and the money needs a human eye before the booking
is confirmed. Each row shows the booking, the guest, the amount, and the
receipt the guest uploaded.

## 3. Verifying

Open the receipt. Compare: amount matches the booking total, the receipt
looks genuine, the reference is sane. Then:

- **Confirm** → the payment is accepted and the booking confirms. The
  guest gets their confirmation.
- **Reject** → with a reason (sent to the guest). The booking goes back
  for payment.

**Also available:** confirm-without-receipt (owner, with a written
reason — for the genuine edge cases) and delete-receipt (owner, with a
reason — a bad upload, not a bad payment).

## 4. Speed matters

A guest who just paid is staring at their phone waiting for confirmation.
Work this queue **the moment entries appear** — not at end of day. The
night audit flags it, the daily sheet flags it, finance flags it: three
flags means it's important.

## 5. Troubleshooting

| Symptom | Check first |
|---|---|
| Queue empty but guest says they paid | They may have paid via a different gateway — check the booking's payment transactions. |
| Receipt won't load | Ask the guest to re-upload (the re-upload page exists for this). |
| Can't confirm | You need FINANCE approve — a manager task. |
| Expired holds | The release-expired job handles them; check the booking status. |

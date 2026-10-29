# The Booking Journey — Staff Training Module

**Pages:** `/stay`, `/stay/[slug]`, `/book/[roomId]`,
`/booking/confirmation/[id]`, payment result pages.
**Audience:** front desk, managers.
**Time to complete:** about 20 minutes.
**Prerequisite:** the [Website](..) module and the [Bookings](../../bookings/) module.

## Learning objectives

After this module you can walk a guest through the online booking flow,
explain what happens at each step, and troubleshoot a stuck booking.

## 1. The journey, step by step

1. **Browse** (`/stay`) — all room types with photos, prices, and max
   guests. Each card links to its detail page.
2. **Room detail** (`/stay/[slug]`) — photos, description, amenities,
   price per night. The "Book" button starts the flow for that room.
3. **Book** (`/book/[roomId]`) — the booking stepper: dates →
   availability check → guest details → **quote** → payment.
   - The **quote** is computed server-side from the room's price and the
     dates — the same engine the admin uses. The price the guest sees is
     the price the folio will carry.
   - Guest details collected here create the [guest record](../../guests/).
4. **Pay** — the guest picks a gateway:
   - **bKash / Nagad / SSLCommerz** — hosted payment; the result pages
     (`/payment/{bkash,nagad,sslcommerz}/result`) show success or failure
     and the booking confirms on the webhook.
   - **BanglaQR** — the guest pays by QR and **uploads the receipt**; the
     booking enters **PENDING_MANUAL_VERIFICATION** and waits in the
     [verification queue](../../finance/banglaqr-verification/). If the
     receipt upload fails, the **reupload page**
     (`/payment/banglaqr/reupload`) lets them try again.
   - **Pay at property** — no online payment; the booking is confirmed
     with payment due at check-in.
5. **Confirmation** (`/booking/confirmation/[id]`) — the booking code
   (e.g. RES-202610-00003), dates, room, guest, and amount. **This page is
   never indexed** (noindex) — booking details don't belong in search
   engines. The guest also gets a confirmation email.

## 2. The demo gateway

`/demo-gateway/[provider]` is a **simulated payment page** ("DemoPay")
that only works when the install runs in simulate mode
(`PAYMENT_MODE=simulate`). It's for testing the payment flow without real
money — neutral styling, no provider branding. **On a real install it's
inert.** Never confuse a demo payment with a real one.

## 3. What staff need to know

- **A booking made online is identical to one made at the desk** — same
  record, same statuses, same folio. If a guest calls about their online
  booking, find it in [Bookings](../../bookings/) by code, name, or phone.
- **The booking code is the key.** Guests should keep it; staff should ask
  for it. It's also what the [chatbot](../../concierge-handoffs/)
  verifies against.
- **Failed payments don't create bookings.** If the guest paid but has no
  confirmation, check the gateway result and the booking's payment
  transactions before promising anything — and never promise a refund
  verbally; follow the [refund flow](../../bookings/detail/).

## 4. Troubleshooting

| Symptom | Check first |
|---|---|
| Guest paid, no confirmation | Check the booking by phone/email — it may be PENDING_MANUAL_VERIFICATION (BanglaQR) or the webhook may be delayed. |
| "Room not available" for dates that look free | The availability engine accounts for holds and overstays — trust it; check the room's units in [room edit](../../rooms/edit/). |
| Price on site differs from quote | Quotes are server-computed at booking time; a price change mid-session reprices. Rare and correct. |
| Demo gateway on a live site | Misconfiguration — PAYMENT_MODE must not be simulate in production. |

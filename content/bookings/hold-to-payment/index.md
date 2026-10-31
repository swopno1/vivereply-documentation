# Chat Held-Draft → Stripe Payment Link

**Audience:** front-desk staff and operators.
**Scope:** Suite-side procedure only — no Concierge changes needed.

## The flow

1. **Guest chats** with the ViveReply Chatbot (website widget).
2. **Chatbot checks** live availability and quotes the seasonal rate.
3. **Chatbot creates a PENDING booking draft** — a hold on the room.
4. **Staff confirm** the draft in **Admin → Chatbot Admin** (handoff board).
5. **Payment link** is generated (Stripe Checkout) and sent to the guest.
6. **Guest pays** → booking confirms, hold converts to a real reservation.
7. **No payment in time** → the hold expires and the room releases.

## Hold expiry

> **Verify:** the PMS contract states a 24-hour hold expiry. A 24–48h figure was reported elsewhere — confirm against the live contract before quoting to guests.

- PENDING drafts expire after the contract hold window.
- Expiry is enforced by the booking-hold cron (see the deployment runbook).
- Expired holds release the room automatically — no staff action needed.
- The guest is notified if contact details were captured.

## Generating the payment link

1. Open the handoff in **Admin → Chatbot Admin**.
2. Review the draft: dates, room type, quoted total.
3. Click **Generate payment link** — this creates a Stripe Checkout session (idempotent: re-clicking returns the same link for 24h, no duplicate payments).
4. Copy the link and send it to the guest (email, or the channel they chatted on).
5. The handoff status moves to **AWAITING_PAYMENT**.

## When payment lands

- Stripe webhook `checkout.session.completed` fires → Suite marks the booking **CONFIRMED**.
- The 15-minute reconcile cron catches anything the webhook missed.
- Staff see the confirmation in the handoff board and the booking list.

## When payment doesn't land

- `checkout.session.expired` fires → booking returns to **PENDING** until the hold window lapses, then expires.
- Staff can re-generate the link (same idempotency window) or cancel the draft.

## Edge cases

| Situation | What happens |
|---|---|
| Guest pays twice | Idempotency: second payment is refunded automatically |
| Guest disputes | Logged in **Finance → Stripe disputes** with evidence deadline |
| Hold expires mid-chat | Chatbot is told the room released; offers alternatives |
| Staff cancel the draft | Hold releases immediately; guest notified if reachable |

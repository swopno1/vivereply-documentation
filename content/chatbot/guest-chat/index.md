# Chatbot — Guest Chat

**What:** what the guest experiences in the chat widget.
**Audience:** front desk, managers — know what the Chatbot tells guests
so you can back it up.
**Time to complete:** about 15 minutes.
**Prerequisite:** the [Chatbot overview](..).

## Learning objectives

After this module you can describe the guest's conversation flow and
explain what happens at each step.

## 1. The conversation

1. **Greeting.** The widget opens on the property's website. The guest
   asks in their own words — English or Bengali.
2. **Availability.** *"Do you have anything free Oct 29–31?"* → the
   Chatbot calls `check_availability` against the **live** Suite data
   and answers with what's actually free — room types and unit counts.
3. **Quote.** *"How much for the Terracotta Villa?"* → `get_quote`
   computes the exact total from the room's live price × nights. The
   number the Chatbot quotes is the number the folio will carry —
   same engine, same source.
4. **Draft.** *"Book it."* → `create_booking_draft` creates a **PENDING**
   hold with a booking code (e.g. RES-202610-00003). **A draft is not a
   booking** — it's a hold awaiting confirmation and payment, exactly
   like a phone reservation written on a slip.
5. **Verification.** *"Is my booking confirmed?"* → the guest gives the
   code; `verify_booking` returns **dates + first name + status only**.
   For full details, `request_booking_details` emails them to the
   **address already on the booking** — never to an address supplied in
   chat.
6. **Handoff.** Anything the Chatbot can't resolve — a complaint, a
   special request, a confused guest — becomes a `request_handoff`: the
   conversation lands in the [staff handoff queue](staff-handoff/) with
   its transcript.

## 2. What the Chatbot never does

- **Never takes payment.** Drafts hold; payment happens through the
  [booking journey](../../website/booking/) or at the desk.
- **Never invents.** No availability, no price, no policy comes from its
  training — only from tool calls. If the tools don't answer, it says so
  and offers the handoff.
- **Never leaks.** The staged verification means a stranger can't
  social-engineer another guest's details out of the chat.

## 3. What staff need to know

- **Drafts appear in [Bookings](../../bookings/)** as PENDING — work them
  like phone reservations: confirm, take payment, or release.
- If a guest says "the chat told me ৳29,000" — **believe them**. The
  quote came from the live engine. Honor it; if it's wrong, the room
  price changed mid-conversation, and that's a data issue, not a guest
  issue.
- The Chatbot doesn't replace the front desk — it **deflects the
  routine** (availability, prices, "is my booking confirmed?") so the
  desk handles the human.

## 4. Troubleshooting

| Symptom | Check first |
|---|---|
| Guest says the chat quoted a wrong price | The room's price per night — did it change? The quote was live at the time. |
| Draft exists but guest never paid | Normal — drafts are holds. Follow up like any pending reservation. |
| Guest couldn't verify their booking | They need the booking code from their confirmation — resend it from the booking detail. |

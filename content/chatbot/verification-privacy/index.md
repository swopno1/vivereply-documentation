# Verification & Privacy

How the Chatbot protects guest booking details. This is a **server-enforced**
design — the privacy guarantee doesn't depend on the AI behaving well.

## The problem

A booking contains personal data: guest name, email, phone, stay dates. In a
chat interface, it's tempting to just "ask the AI not to reveal too much."
That fails the moment someone phrases a clever question. So the Chatbot
**never gives the AI the full data in the first place.**

## Two lookup paths, two privacy levels

### By booking code — minimal disclosure

**Guest:** *"My code is RES-202610-00004, is it confirmed?"*

**What the chat shows:** stay dates + first name + status. Nothing else.

**How it's enforced:** the server fetches the full booking, then **strips
everything except dates, first name, and status** before the chat layer sees
it. The AI literally cannot reveal the email, phone, or total — it never
received them.

### By email or phone — zero disclosure in chat

**Guest:** *"I booked with amir@example.com, what are my dates?"*

**What the chat shows:** one generic reply — identical whether or not a
booking exists.

**What happens behind the scenes:** if a booking matches, the details are
emailed to the address **already stored on the booking**. The chat never
confirms or denies that a booking exists, which prevents fishing ("does this
email have a booking?").

## Why the replies are identical

For contact lookups, the AI's reply is byte-identical for a real and a fake
contact. This is deliberate: if the reply differed, an attacker could probe
which emails have bookings. The real information travels by email, not chat.

## What this means for your staff

- **Never ask guests for booking details in chat** beyond what the
  verification flow needs. The system is designed so staff don't have to
  handle PII in the chat window.
- **The stored email matters.** Booking confirmation emails — and therefore
  verification emails — go to the address on the booking. Keep it accurate
  at check-in.
- **Handoff transcripts** contain the conversation but not stripped PII. The
  [staff queue](/chatbot/staff-handoff) shows what the guest said, not the
  booking's private fields.

## Technical summary

| Lookup | Data the AI receives | Guest sees in chat |
|---|---|---|
| By code | Dates + first name + status only | Dates + first name + status |
| By email/phone | Nothing (generic reply template) | One generic reply, always identical |
| Details request | Nothing in chat | Email to stored address |

Full technical contract: the Concierge repo's `docs/` (read-only reference
for developers).

## Related

- [Capabilities](/chatbot/capabilities) — the verification tools
- [Staff Handoff](/chatbot/staff-handoff) — working with transcripts
- [Best Practices](/chatbot/best-practices) — data hygiene tips

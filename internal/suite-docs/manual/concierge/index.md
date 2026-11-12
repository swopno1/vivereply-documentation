# Vivereply Concierge — Documentation

**What:** the AI front-desk agent for resorts — answers guests, checks
**live** availability, quotes prices from its catalogue copy, and drafts
bookings. Only availability is live; prices come from the Concierge
catalogue snapshot, so Suite price changes do not propagate automatically.
**Audience:** property managers, owners, and staff working with the
Concierge.
**Time to complete:** about 25 minutes.

## Learning objectives

After this section you can explain what the Concierge is (and isn't),
describe the guest chat experience, work the staff handoff queue, and
understand how a property gets connected.

## 1. What the Concierge is

A guest opens the chat widget on the property's website and talks —
in English or Bengali — the way they'd talk to a front-desk agent:
*"Do you have a villa free next weekend? How much for two nights?"*
The Concierge doesn't guess. It calls the property's **live** Suite data:

| It can | Via |
|---|---|
| Check real availability for dates | `check_availability` |
| Quote the exact price | `get_quote` |
| Create a booking draft (hold) | `create_booking_draft` |
| Verify the conversation's booking draft | `verify_booking` (reads the current draft; takes no code) |
| Look up a booking by code | `lookup_booking_by_code` |
| Send booking details to the guest's email | `request_booking_details` |
| Hand the conversation to a human | `request_handoff` |

**What it is not:** it is not a generic chatbot, and it is not an MCP
server. It's a **front-desk agent** — native tool calling solving a
domain-specific problem in a closed setup (the resort's own front desk).
That framing matters: every answer is grounded in the property's data,
and anything it doesn't know becomes a handoff, not a hallucination.

**Two guardrails worth knowing about:**

- **Retraction rule (EN+BN).** The Concierge is instructed to retract
  anything the tools don't support — in the guest's language — rather
  than invent. (A behavioral guideline; confirm on the live app.)
- **Staged verification.** A guest proving "it's my booking" gets
  **dates + first name + status only** by code. Full details go **only to
  the email already on the booking** — never to an address the chatter
  supplies. A code miss answers plainly (*"No booking found for that
  code"*); only the email-details request replies identically whether it
  hits or misses, so nothing leaks.

## 2. The sections

| Page | What it covers |
|---|---|
| [Guest Chat](guest-chat/) | The guest experience: availability, quotes, drafts, verification, handoff |
| [Staff Handoff](staff-handoff/) | The staff side: the handoff queue, bridge keys, setup notices |
| [Connecting a Property](setup/) | Binding, domains, and the catalogue — what makes the Concierge know *your* rooms |

## 3. Where it lives

The Concierge runs at **app.vivereply.com** as its own application with
its own database — separate from the Suite by design, joined by HTTP and
IDs. The Suite never writes to the Concierge's database and vice versa;
they talk through the versioned contract (spec v1).

## 4. Troubleshooting (the short version)

| Symptom | Check first |
|---|---|
| Widget shows an error panel | The property's domain isn't approved for its tenant — see [Setup](setup/) |
| Concierge quotes wrong prices | Quotes come from the Concierge's own catalogue copy, not the Suite's live prices — check the mapping (see [Setup](setup/)); Suite price changes don't propagate automatically |
| A draft never became a booking | Drafts are holds, not bookings — they need confirmation; check [Bookings](../bookings/) |

*Note: the Concierge's own codebase is maintained separately. These docs
describe its behavior and its contract with the Suite, not its internals.*

# ViveReply Chatbot — Documentation

**What:** the AI front-office assistant — answers guests, checks
availability, quotes prices, drafts bookings, and schedules with clients
**like a real staff member**.
**Audience:** property managers, owners, and staff working with the
Chatbot.
**Time to complete:** about 25 minutes.

## Learning objectives

After this section you can explain what the Chatbot is (and isn't),
describe the guest chat experience, work the staff handoff queue, and
understand how a property gets connected.

## 1. What the Chatbot is

ViveReply has two faces. The **Suite** runs the property; the **Chatbot**
talks to the guest. Together they're one complete package: a guest opens
the chat widget on the property's website and talks — in English or
Bengali — the way they'd talk to a front-desk agent: *"Do you have a
villa free next weekend? How much for two nights? Can you hold it for
me?"* The Chatbot doesn't guess. It calls the property's **live** Suite
data:

| It can | Via |
|---|---|
| Check real availability for dates | `check_availability` |
| Quote the exact price | `get_quote` |
| Create a booking draft (hold) | `create_booking_draft` |
| Verify a booking by code | `verify_booking` / `lookup_booking_by_code` |
| Send booking details to the guest's email | `request_booking_details` |
| Hand the conversation to a human | `request_handoff` |

That's the front-office job — query, book, schedule — done by an AI
that works from the same live data your staff sees.

**Current build: ViveReply Concierge.** That's the name of the Chatbot's
current build (entered in the Meta Global AI Hackathon). One product
line, one name in these docs: **ViveReply Chatbot** — "Concierge" is the
build name you'll also see in code, routes, and the app at
app.vivereply.com.

**What it is not:** it is not a generic chatbot, and it is not an MCP
server. It's a **front-desk agent** — native tool calling solving a
domain-specific problem in a closed setup (the resort's own front desk).
That framing matters: every answer is grounded in the property's data,
and anything it doesn't know becomes a handoff, not a hallucination.

**Two guardrails worth knowing about:**

- **Retraction guard (EN+BN).** If the Chatbot states something the
  tools don't support, it retracts — in the guest's language.
- **Staged verification.** A guest proving "it's my booking" gets
  **dates + first name + status only** by code. Full details go **only to
  the email already on the booking** — never to an address the chatter
  supplies. Identical generic replies whether the lookup hits or misses,
  so nothing leaks.

## 2. The sections

| Page | What it covers |
|---|---|
| [Guest Chat](guest-chat/) | The guest experience: availability, quotes, drafts, verification, handoff |
| [Staff Handoff](staff-handoff/) | The staff side: the handoff queue, bridge keys, embed tokens |
| [Connecting a Property](setup/) | Binding, domains, and the catalogue — what makes the Chatbot know *your* rooms |
| [Roadmap](roadmap/) | Where the Chatbot goes next — the full website-assistant track (in development) |

## 3. Where it lives

The Chatbot runs at **app.vivereply.com** as its own application with
its own database — separate from the Suite by design, joined by HTTP and
IDs. The Suite never writes to the Chatbot's database and vice versa;
they talk through the versioned contract (spec v1).

## 4. Troubleshooting (the short version)

| Symptom | Check first |
|---|---|
| Widget shows an error panel | The property's domain isn't approved for its tenant — see [Setup](setup/) |
| Chatbot quotes wrong prices | The Suite's room prices changed — the Chatbot reads them live; check the [room type](../rooms/edit/) |
| A draft never became a booking | Drafts are holds, not bookings — they need confirmation; check [Bookings](../bookings/) |

*Note: the Chatbot's own codebase is maintained separately. These docs
describe its behavior and its contract with the Suite, not its internals.*

# Glossary

Terms you'll see across the Chatbot docs, the app, and the API.

**Booking draft** — a PENDING hold on a room for specific dates, with a
booking code (e.g. `RES-202610-00004`). No payment taken; the property
confirms it in its own admin. One per conversation.

**Booking code** — the draft's reference (format `RES-YYYYMM-#####`). Guests
quote it to verify; staff use it to find the booking.

**Bridge API** — the JSON API your own servers use to work handoffs
(list, read, assign, close, note). Authenticated per-property. See
[Bridge API](/chatbot/bridge-api).

**Bridge key** — a per-property secret (`cb.<prefix>.<secret>`) for the
Bridge API. Server-only, revocable, shown once at minting.

**Catalogue** — your property's room list with nightly rates. The Chatbot
builds its tools from this — it can only discuss rooms in the catalogue,
at catalogue prices.

**Chat token** — a short-lived, origin-bound token the widget mints per
page load. It tells the Chatbot which property the chat belongs to; the
browser's word is never trusted for this.

**Front-desk agent** — what the Chatbot is: native tool calling solving a
domain-specific problem (the resort's front desk). Not a generic chatbot,
not an MCP server.

**Handoff** — a conversation the AI couldn't complete (group booking,
special request, complaint), saved with reason, summary, and full
transcript for staff. States: `OPEN` → `IN_PROGRESS` → `CLOSED`.

**MVP** — minimum viable product. The Chatbot's current build
("ViveReply Concierge," the hackathon entry) is the MVP; general
availability follows.

**PENDING** — a draft's status: held, awaiting property confirmation. Not
yet a confirmed booking, not yet paid.

**Property** — one resort/hotel in the system. Each property has its own
rooms, catalogue, staff, keys, and data — never shared with another
property (tenant isolation).

**Quote card** — the chat UI card showing room, dates, nightly rate ×
nights, and total. Built only from live tool results.

**Suite** — ViveReply Suite: the resort website + Resort Property
Management System. The Chatbot reads live availability and rates from a
Suite backend (or any backend implementing the API spec).

**Tenant isolation** — the guarantee that one property can never see
another's data. Enforced by signed tokens (chat) and per-property keys
(bridge); cross-property reads answer `404`.

**Verification** — proving a booking is yours. By code: chat shows dates +
first name + status only. By email/phone: generic reply in chat, details
emailed to the stored address. See
[Verification & Privacy](/chatbot/verification-privacy).

**Widget** — the `<script>` embed on the property's website that opens the
chat panel. Bound to approved domains; one script tag to install.

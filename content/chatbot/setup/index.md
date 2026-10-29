# Chatbot — Connecting a Property

**What:** what makes the Chatbot know *your* rooms, rates, and domain.
**Audience:** owners, technical staff.
**Time to complete:** about 15 minutes.
**Prerequisite:** the [Chatbot overview](..).

## Learning objectives

After this module you understand the three things that connect a property:
the tenant binding, the approved domain, and the catalogue.

## 1. The tenant binding

Each property is a **tenant** in the Chatbot (e.g. `krishnachura-retreat`).
The binding connects the tenant to the property's Suite: the Chatbot
calls the Suite's API for availability, quotes, and drafts. The two
applications keep **separate databases by design**, joined by HTTP and
IDs — the Suite never writes to the Chatbot's database and vice versa.

## 2. Approved domains

The widget only runs on **approved domains**. Each tenant has
`ApprovedDomain` rows — the property's website domain must have an
**ACTIVE** row, or the widget shows an error panel instead of the chat.
This is the most common setup failure: *everything is configured, but
the domain row is missing or not active.*

## 3. The catalogue

The Chatbot maps its room list to the Suite's room types
(`suiteRoomIds`). **Order matters** — the mapping is positional, so the
rooms must be listed in the same order on both sides. If the mapping is
wrong, the Chatbot quotes the wrong room's price with full confidence.
Verify the mapping whenever rooms are added, removed, or reordered.

## 4. The contract (spec v1)

The Suite exposes a minimal contract the Chatbot checks:

- `GET /api/concierge/ping` → `{"ok":true,"suiteVersion":1}` — the
  handshake. If this doesn't answer, the property isn't connected,
  whatever the dashboards say.

## 5. Connection checklist

1. Tenant created and bound to the property's Suite.
2. **ACTIVE** `ApprovedDomain` row for the website's domain.
3. Catalogue mapped and order-verified against the Suite's rooms.
4. Ping answers `{"ok":true,"suiteVersion":1}`.
5. Bridge key minted (for [staff handoff](staff-handoff/)).

## 6. Troubleshooting

| Symptom | Check first |
|---|---|
| Widget error panel | The ApprovedDomain row — missing or not ACTIVE. No Suite-side fix exists. |
| Wrong room quoted | The catalogue mapping order — verify against the Suite's room list. |
| Ping fails | The Suite's ping route or the deployment — the property isn't connected. |
| Auth to the Chatbot admin fails | The session secret must be set — without it, login fails *and* chat closes. |

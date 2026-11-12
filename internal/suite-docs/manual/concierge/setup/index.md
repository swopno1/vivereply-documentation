# Concierge — Connecting a Property

**What:** what makes the Concierge know *your* rooms, rates, and domain.
**Audience:** owners, technical staff.
**Time to complete:** about 15 minutes.
**Prerequisite:** the [Concierge overview](..).

## Learning objectives

After this module you understand the three things that connect a property:
the tenant binding, the approved domain, and the catalogue.

## 1. The tenant binding

Each property is a **tenant** in the Concierge (e.g. `krishnachura-retreat`).
The binding connects the tenant to the property's Suite: the Concierge
calls the Suite's API for availability, quotes, and drafts. The two
applications keep **separate databases by design**, joined by HTTP and
IDs — the Suite never writes to the Concierge's database and vice versa.

## 2. Approved domains

The widget only runs on **approved domains**. Each tenant has
`ApprovedDomain` rows — the property's website domain must have a row
with **active** switched on, or the widget shows an error panel instead
of the chat. This is the most common setup failure: *everything is
configured, but the domain row is missing or not active.*

## 3. The catalogue

The Concierge maps its room list to the Suite's room types explicitly:
each catalogue entry carries its own `suiteRoomId` (the Suite room's
UUID), looked up by slug. If an entry points at the wrong UUID, the
Concierge quotes the wrong room's price with full confidence. Verify the
mapping whenever rooms are added or removed — order doesn't matter.

## 4. The contract (spec v1)

The Suite exposes a minimal contract the Concierge checks:

- `GET /api/concierge/ping` → `{"ok":true,"suiteVersion":1}` — the
  handshake. If this doesn't answer, the property isn't connected,
  whatever the dashboards say.

## 5. Connection checklist

1. Tenant created and bound to the property's Suite.
2. `ApprovedDomain` row with **active** on for the website's domain.
3. Catalogue mapped — each entry's `suiteRoomId` verified against the Suite's rooms.
4. Ping answers `{"ok":true,"suiteVersion":1}`.
5. Bridge key minted (for [staff handoff](staff-handoff/)).

## 6. Troubleshooting

| Symptom | Check first |
|---|---|
| Widget error panel | The ApprovedDomain row — missing or not active. No Suite-side fix exists. |
| Wrong room quoted | The catalogue's `suiteRoomId` mapping — verify each entry points at the right Suite room. |
| Ping fails | The Suite's ping route or the deployment — the property isn't connected. |
| Auth to the Concierge admin fails | The session secret must be set — without it, login fails *and* chat closes. |

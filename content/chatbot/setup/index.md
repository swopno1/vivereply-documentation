# Chatbot — Connecting a Property

**What:** what makes the Chatbot know *your* rooms, rates, and domain —
the tenant binding, the approved domain, the catalogue, and the bridge key.
**Audience:** owners, technical staff.
**Time to complete:** about 20 minutes.
**Prerequisite:** the [Chatbot overview](..).

## Learning objectives

After this module you understand the four things that connect a property,
can run the connection checklist, and know where to look when the widget
shows an error.

## 1. The tenant binding

Each property is a **tenant** in the Chatbot (e.g. `krishnachura-retreat`).
The binding connects the tenant to the property's Suite: the Chatbot calls
the Suite's API for availability, quotes, and drafts.

The two applications keep **separate databases by design**, joined by HTTP
and IDs — the Suite never writes to the Chatbot's database and vice versa.
See [Glossary](../glossary) for the key terms.

**Who does this:** the ViveReply team registers tenants (there's no public
signup — by design). Owners get a login for their property.

## 2. Approved domains

The widget only runs on **approved domains**. Each tenant has
`ApprovedDomain` rows — the property's website domain must have an
**ACTIVE** row, or the widget shows an error panel instead of the chat.

This is the most common setup failure: *everything is configured, but the
domain row is missing or not ACTIVE.* There is no Suite-side fix — the row
must exist in the Chatbot's database.

**Check:** open your website. If you see an error panel instead of the chat
button, the domain isn't approved. Contact support with your domain.

## 3. The catalogue

The Chatbot maps its room list to the Suite's room types (`suiteRoomIds`).
**Order matters** — the mapping is positional, so the rooms must be listed
in the same order on both sides. If the mapping is wrong, the Chatbot quotes
the wrong room's price with full confidence.

**Verify the mapping** whenever rooms are added, removed, or reordered. This
is a five-minute check that prevents the most embarrassing failure mode.

## 4. The contract (spec v1)

The Suite exposes a minimal contract the Chatbot checks:

- `GET /api/concierge/ping` → `{"ok":true,"suiteVersion":1}` — the
  handshake. If this doesn't answer, the property isn't connected,
  whatever the dashboards say.

Run this URL in your browser. `{"ok":true}` means the wiring is alive.

## 5. The bridge key (for staff handoff)

To work handoffs from your Suite admin (**/admin/chatbot-admin**) or your
own dashboard, mint a bridge key:

1. In the Chatbot app: **Settings → Bridge keys** → mint, named e.g.
   `demo1 dashboard`. Copy the secret immediately — it's shown once.
2. In your Suite hosting: set `CONCIERGE_BRIDGE_KEY` and redeploy.
3. Open **/admin/chatbot-admin** — the queue loads.

Full reference: [Bridge API](../bridge-api). Staff workflow:
[Staff Handoff](../staff-handoff).

## 6. Connection checklist

1. Tenant created and bound to the property's Suite.
2. **ACTIVE** `ApprovedDomain` row for the website's domain.
3. Catalogue mapped and order-verified against the Suite's rooms.
4. Ping answers `{"ok":true,"suiteVersion":1}`.
5. Bridge key minted (for [staff handoff](../staff-handoff)).

## 7. Troubleshooting

| Symptom | Check first |
|---|---|
| Widget error panel | The ApprovedDomain row — missing or not ACTIVE. No Suite-side fix exists. |
| Wrong room quoted | The catalogue mapping order — verify against the Suite's room list. |
| Ping fails | The Suite's ping route or the deployment — the property isn't connected. |
| Auth to the Chatbot admin fails | The session secret must be set — without it, login fails *and* chat closes. |
| Bridge API 401 | Key revoked — mint a new one in Settings → Bridge keys. |

More: [Troubleshooting](../troubleshooting).

## Related

- [Staff Handoff](../staff-handoff)
- [Bridge API](../bridge-api)
- [Best Practices](../best-practices)
- [Glossary](../glossary)

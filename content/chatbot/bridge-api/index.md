# Bridge API — Connect Your Own Dashboard

The Bridge API lets your own servers work staff handoffs as JSON — list,
read with transcript, assign, close, and add follow-up notes. Your dashboard
never touches the Chatbot's database; everything goes through per-property
API keys.

**Base URL:** `https://app.vivereply.com`
**Auth:** `Authorization: Bearer <bridge-key>` on every request.
**Scope:** a key sees **only its own property's** handoffs. A valid key
asking for another property's handoff gets `404`, not `403` (no oracle).

## Getting a key

1. Log in to [app.vivereply.com](https://app.vivereply.com) as the property owner.
2. Go to **Settings → Bridge keys**.
3. Mint a key named for its use (e.g. `demo1 dashboard`, property
   `krishnachura-retreat`). **The secret is shown once** — copy it immediately.
4. Store it as a server secret (e.g. `CONCIERGE_BRIDGE_KEY`). **Never** put it
   in browser code, logs, error messages, or a repo.

Keys are hashed server-side. Revoking a key in Settings kills it instantly.

## Endpoints

### List handoffs

```
GET /api/bridge/handoffs?status=OPEN
```

`status` is optional: `OPEN` | `IN_PROGRESS` | `CLOSED` (unknown values →
`400`). Omit for all. Response: `200` array, newest first.

```json
[
  {
    "id": "h_abc123",
    "conversationId": "c_xyz789",
    "propertyId": "krishnachura-retreat",
    "reason": "Group booking — 25 guests",
    "summary": "Guest wants a 25-person wedding block...",
    "status": "OPEN",
    "assignee": null,
    "createdAt": "2026-10-29T14:02:11.000Z",
    "noteCount": 2,
    "notes": [
      { "id": "n_1", "author": "Rahim", "body": "Called the guest", "createdAt": "..." }
    ]
  }
]
```

### Read one handoff (with transcript)

```
GET /api/bridge/handoffs/<id>
```

Response: `200` — the handoff record plus `transcript: [{role, content,
createdAt}]`. Unknown ID or another property's ID → `404 {"error":
"Handoff not found."}`.

### Update a handoff

```
PATCH /api/bridge/handoffs/<id>
Content-Type: application/json

{ "status": "IN_PROGRESS", "assignee": "Rahim" }
```

`status` must be `OPEN` | `IN_PROGRESS` | `CLOSED`; `assignee` is a string
(≤100 chars) or `null` to clear. At least one field required, else `400`.
Response: `200` — the updated record.

### Add a follow-up note

```
POST /api/bridge/handoffs/<id>/notes
Content-Type: application/json

{ "author": "Rahim", "body": "Guest confirmed for site visit Saturday." }
```

`author` required (≤100 chars), `body` required (≤2000 chars). Response:
`201` — the created note.

## Errors

| Status | Meaning |
|---|---|
| `401` | Missing or invalid key. Almost always: the key was revoked — mint a new one. |
| `404` | Unknown handoff ID, or it belongs to another property. |
| `400` | Bad `status` value, or a PATCH/POST with missing/invalid fields. |

Error bodies are JSON: `{ "error": "human-readable message" }`.

## Client pattern (Node, server-only)

```js
// Server only. Never run this in the browser.
const res = await fetch("https://app.vivereply.com/api/bridge/handoffs?status=OPEN", {
  headers: { Authorization: `Bearer ${process.env.CONCIERGE_BRIDGE_KEY}` },
});
if (!res.ok) throw new Error(`Bridge: ${res.status}`);
const openHandoffs = await res.json();
```

## Security rules (non-negotiable)

- The key lives **only** in server secrets. Never in browser code, logs,
  error messages, or the repo.
- On leak: revoke in Settings immediately and mint a new key.
- No rate limiting or IP allowlist yet — treat the key like a password.

## Related

- [Staff Handoff](/chatbot/staff-handoff) — the built-in triage UI
- [Setup](/chatbot/setup) — connecting a property

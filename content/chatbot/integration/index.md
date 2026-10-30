# Developer Integration Guide — ViveReply Concierge

**What:** everything a developer needs to put the ViveReply Concierge chatbot
on any website: the guest widget, the booking-backend contract, and the staff
handoff options.
**Audience:** web developers integrating the chatbot for a resort or hotel.
**Time:** about an hour for the widget; a day for a full backend integration.
**Prerequisite:** none — the guided setup at
[app.vivereply.com](https://app.vivereply.com) → **Getting started** walks
you through everything below, with a live check at each step. This page is
the same flow as reference documentation.

## The three integration surfaces

| Surface | Who sees it | What it needs from you |
|---|---|---|
| **Guest widget** | Website visitors | One `<script>` tag + an approved domain |
| **Booking backend** | Nobody directly (the bot calls it) | 5 HTTP endpoints on your server (spec v1) |
| **Staff handoffs** | Front-desk staff | Nothing, a bridge key, or an iframe — your choice |

You can ship the widget first and connect the backend later. Without a
backend, the bot chats but can't check availability or hold rooms — it says
so honestly instead of inventing answers.

---

## Step 0 — Get your credentials

Do this once in the Concierge dashboard
([app.vivereply.com](https://app.vivereply.com)), following
**Getting started**. Each step below has a live check — it only counts as
done when the check passes.

1. **Account.** Sign up, then click the verification link in your email.
   Configuration stays locked until your email is verified. Your owner
   account can only ever see its own property.
2. **Property + key.** Signup creates your property automatically and issues
   a **widget key** (shape `key-<property>-<suffix>`). Find both under
   Getting started → "Property + widget key", with copy buttons. The key
   identifies your property to the widget — it is public, not a secret, but
   treat it as yours alone.
3. **Domain (the anti-theft gate).** Add your website host exactly as guests
   see it — `www.yourresort.com`, no `https://`, no path. Add every host
   that serves the site (`www.` and bare domain are separate rows). The row
   becomes ACTIVE immediately; the widget renders nothing on unlisted hosts,
   and deactivating a domain stops that site's chat on the next message.
   `localhost` is accepted on development builds only, never in production.
4. **Bridge key (only if you use the staff API or embedded staff widget).**
   Mint it in the wizard or the integration kit: mint → copy once → store
   on your server. The secret is shown **once**. Format: `cb.<prefix>.<secret>`.

Hand the developer the widget key and the snippet. The bridge key goes
straight into the server's secret store — never into chat logs, email, or
a repo.

---

## Step 1 — Embed the guest widget

Paste the snippet before `</body>` on every page where chat should appear:

```html
<script src="https://app.vivereply.com/widget.js" data-key="YOUR_PROPERTY_KEY"></script>
```

That's it. No build step, no npm package, no framework requirement.

### Requirements

- **HTTPS.** Guest chat over plain HTTP would travel unencrypted.
  `localhost` is fine for development.
- **Approved domain** (Step 0.3). The single most common setup failure is a
  missing or inactive domain row — the widget shows an error panel and there
  is no website-side fix.
- **Content-Security-Policy:** if your site sets one, allow the Concierge
  origin for scripts, frames, and connects, or the panel can't load. The
  exact origin is printed on the snippet in Settings.

### Verify it loads

Open the chat panel once on your live site, then press **"Check for loads"**
in the wizard. The step turns Done only when the product has seen a real
panel open from your approved domain — not before.

### Framework notes

- **Plain HTML / WordPress / any CMS:** paste the tag in the footer template
  or a site-wide script field. Done.
- **React / Next.js:** render a plain synchronous `<script>` tag. Do **not**
  load it through `next/script` with async/defer — `widget.js` identifies
  itself as the last `<script>` tag on the page, and async loading breaks
  that detection.
- **Single-page apps:** the snippet only needs to load once; the widget
  persists across client-side route changes.

### What guests get

Any modern browser (Chrome, Safari, Firefox, Edge from the last ~2 years).
No app install, no account, no cookies required to start chatting. The bot
answers from your rooms and rates, checks live availability, quotes exact
prices, holds rooms as PENDING drafts, and hands off to your staff when a
human is needed.

---

## Step 2 — Connect your booking backend (spec v1)

For the bot to quote and hold rooms, your server implements five JSON
endpoints. Any stack works — the Concierge only speaks HTTPS + JSON.

**Conventions for every call:**

- Dates are `YYYY-MM-DD` (check-out exclusive).
- Money is integer **poisha** (1 taka = 100 poisha) — never floats.
- The Concierge sends `X-Concierge-Suite-Version: 1` on every call, and
  `Authorization: Bearer <secret>` when the property configured one
  (backends that need no key ignore the header).
- **Timeout: 15 seconds per call.** Respond fast and stay reachable — when
  your server is slow or down, guests get an honest error plus a staff
  handoff, but no quotes or drafts can complete.

### 2.1 Ping (required)

```
GET /api/concierge/ping
→ 200 { "ok": true, "suiteVersion": 1 }
```

The handshake. Powers "Test connection" in Settings without touching data.

### 2.2 Availability (required)

```
GET /api/rooms/<roomId>/availability?checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD
→ 200 { "roomId": "<id>", "checkIn": "<date>", "checkOut": "<date>",
        "available": 2, "units": ["TV-3", "TV-5"] }
```

- `available`: integer count of free units for the whole stay (`0` = sold out).
- `units`: optional free-unit labels (display only).
- Unknown room → `404 { "error": "not_found" }`. Invalid dates → `400`.

### 2.3 Create booking hold (required)

```
POST /api/bookings
{ "roomId": "<id>", "guestName": "…", "guestEmail": "…", "guestPhone": "…",
  "checkInDate": "YYYY-MM-DD", "checkOutDate": "YYYY-MM-DD" }
→ 200 { "success": true,
        "booking": { "id": "…", "bookingCode": "RES-…", "totalAmountPoisha": 2900000 } }
```

- Creates a **PENDING hold** — no payment taken.
- **Holds auto-release 24 hours after creation if unpaid.** Guests always see
  this window, so your backend must honor it.
- `totalAmountPoisha` is your total for the stay — it governs over the bot's
  quote on any mismatch, and the guest is told so.
- No free unit → `409` with a sold-out-shaped message.
- **Idempotency:** the Concierge sends `Idempotency-Key: <conversation-id>`.
  A repeated key must return the **original** booking (same code, same total)
  — never a second hold.

### 2.4 Lookup by code (required)

```
GET /api/bookings/lookup?code=RES-…
→ 200 { "bookingCode": "RES-…", "firstName": "Amir",
        "checkInDate": "YYYY-MM-DD", "checkOutDate": "YYYY-MM-DD",
        "status": "PENDING" }
```

Return **only these fields** — minimal disclosure is a safety property.
Unknown code → `404`. Field names are fixed (`checkInDate`, not `checkIn`).

### 2.5 Send details by contact (required)

```
POST /api/bookings/send-details
{ "email": "…" } and/or { "phone": "…" }
→ 200 { "sent": true }
```

- Email the booking's full details to the address **already stored on the
  booking** — never to an address from the request.
- The response is **identical** whether or not a booking exists (no oracle).

### Errors & rate limits

- Error shape: `{ "error": "human sentence" }`. The bot surfaces the sentence
  when safe, otherwise a generic line — it never invents details.
- Rate-limit brute-forceable endpoints (lookup, send-details) with `429`;
  the status alone is the signal — the bot maps any `429` to try-again-later
  wording. A `Retry-After` header is currently informational.
- Anything outside this spec (extra fields, extra endpoints) is ignored.
- Breaking changes ship as **v2** under a new spec; v1 keeps working.

### Register the backend

In the Concierge dashboard: Settings → Booking system → base URL + optional
secret (stored encrypted, never shown back) + room mapping. The room mapping
is **positional** — list rooms in the same order on both sides, or the bot
quotes the wrong room's price with full confidence. Re-verify the mapping
whenever rooms are added, removed, or reordered.

The wizard's booking step turns Done only when **all three** hold: the
connection details are saved, Test connection answers green, and at least
one room is mapped (no row, no quote — the chatbot can only offer mapped
rooms).

---

## Step 3 — Staff handoffs (pick one)

When the bot can't resolve something, it creates a **handoff** for your
staff. Three ways to work them:

### Option A — Hosted board (no code)

Open the Concierge `/staff` board in a browser. The ViveReply team provisions
staff logins. Nothing to install — assign someone to the queue, because
unanswered handoffs are an operations failure, not a software one.

### Option B — Bridge API (your own dashboard)

Your **server** works handoffs as JSON. Full reference:
[Bridge API](../bridge-api). The short version:

```
Base: https://app.vivereply.com
Auth: Authorization: <redacted>   # server secret, never in the browser
```

| Action | Request |
|---|---|
| List | `GET /api/bridge/handoffs?status=OPEN` (`OPEN`/`IN_PROGRESS`/`CLOSED`, newest first) |
| Read + transcript | `GET /api/bridge/handoffs/<id>` |
| Assign / move / close | `PATCH /api/bridge/handoffs/<id>` `{ "status": "IN_PROGRESS", "assignee": "Rafi" }` |
| Follow-up note | `POST /api/bridge/handoffs/<id>/notes` `{ "author": "Rafi", "body": "…" }` |

A key sees **only its own property's** handoffs — another property's id
returns `404`, exactly like a missing id. Revoking a key in Settings kills
it instantly.

### Option C — Embedded staff widget

Frame the Concierge staff widget (`/staff/embed`) in your dashboard. Your
server mints a 15-minute token per page load via
`POST /api/bridge/embed-tokens` (authenticated with the bridge key) and
renders the iframe — the key still never reaches the browser.

---

## Security rules (non-negotiable)

1. **Bridge keys** live only in your server's secrets (env, secret manager).
   Never in page source, git, logs, error messages, or the browser. Leaked =
   revoke in Settings (instant) + mint again.
2. **Widget keys** (`demo-*` labels) are **public identifiers, not secrets**.
   The handshake (key + approved origin) decides — don't bother hiding the
   snippet.
3. **Backend secrets** (if you set one for spec v1) are pasted once into the
   Concierge Settings, encrypted at rest, never shown again. Keep your own
   copy — support can't read it back.
4. Guest PII is minimized: lookups return first name + dates + status;
   full details go to the booking email, never into chat.

---

## Testing

```bash
# 1. Widget: open your site — the chat button appears (not an error panel).
# 2. Backend handshake:
curl https://your-backend/api/concierge/ping
# → {"ok":true,"suiteVersion":1}

# 3. Bridge key (key owner runs this; the secret must not travel over chat):
BASE=https://app.vivereply.com
curl -s "$BASE/api/bridge/handoffs?status=OPEN" -H "Authorization: Bearer $KEY"
curl -s -o /dev/null -w '%{http_code}\n' "$BASE/api/bridge/handoffs"  # no key → 401
```

In the dashboard, run **Booking Test** in Settings, then do a live
quote → draft → lookup round-trip on the real site.

---

## Go-live checklist

- [ ] Domains registered (every host, ACTIVE) + widget opens on the live site (the wizard counts real opens).
- [ ] Booking Test green in Settings; rooms listed with live prices.
- [ ] Test quote → draft → lookup round-trip on the live site.
- [ ] Staff can open the board (or your API/iframe integration) and resolve
      a test handoff.
- [ ] Payments (if enabled): test-mode link paid + receipt received.
- [ ] Handoff rota named — who answers, within how many minutes.

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Widget shows an error panel, not chat | Domain not registered or not ACTIVE in Settings → Domains |
| Chat button never appears | Script blocked by CSP, or not a plain sync `<script>` (see Framework notes) |
| "Test connection" fails | `/api/concierge/ping` not answering, or > 15s |
| Quotes work, drafts fail | `POST /api/bookings` missing, or not idempotent on `Idempotency-Key` |
| Handoff API → `401` | Key revoked or wrong — mint a fresh one in Settings → Bridge keys |
| Handoff API → `404` on a known id | The id belongs to another property (or doesn't exist) |

Still stuck? See [Troubleshooting](../troubleshooting) or contact support with
your property ID and domain.

## Further reading

- [Connecting a Property](../setup) — the owner-side walkthrough this guide
  builds on.
- [Bridge API](../bridge-api) — the complete staff-API reference.
- [Staff Handoff](../staff-handoff) — how handoffs work from the staff's side.
- [Glossary](../glossary) — tenants, bindings, bridge keys, and other terms.


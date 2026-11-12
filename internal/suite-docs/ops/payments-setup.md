# Payment gateways — owner setup guide

Date: 2026-10-29. Branch: `client/demo1`.
Registry: `src/lib/payments/registry.ts`. Status: `src/lib/payments/gateways.ts`.

## 1. The gateway list

| Gateway | Kind | Settlement | Status |
|---|---|---|---|
| bKash | Local · Bangladesh | BDT | live |
| Nagad | Local · Bangladesh | BDT | live |
| SSLCommerz | Local · Bangladesh | BDT | live |
| BanglaQR | Local · Bangladesh | BDT | live |
| **Stripe** | **International** | **USD** (owner-settable) | live |

Guests see the checkout grouped the same way: **International** first, then
**Local · Bangladesh**. The registry (`GATEWAY_REGISTRY`) is the single
source of truth — adding a future gateway is one registry entry plus one
adapter module, and the settings UI renders its card automatically.

## 2. The three rules (true for every gateway)

1. **Environment wins.** Any field set via its environment variable overrides
   everything, and a gateway fully credentialed via env is **active with its
   dashboard toggle locked** ("Managed by environment").
2. **Dashboard fills the gaps.** Whatever env doesn't provide, the owner can
   enter on the gateway's card in `/admin/settings` → Payments. Secrets are
   encrypted at rest (AES-256-GCM) and write-only — the dashboard never
   shows them back.
3. **Built-in defaults last.** Anything still unset falls back to the
   registry default (or "not set", which keeps the gateway off).

Every field on every card carries a source badge — **Environment /
Dashboard / Default / Not set** — so you always know *why* a gateway is on
or off. A gateway is offered to guests only when it is switched on **and**
every required field is set.

## 3. Currency and the static rate

Each gateway card has a **settlement currency** and a **BDT rate** (BDT per
1 unit of that currency, e.g. `117.50` for USD). Local gateways settle in
BDT; Stripe settles in USD by default.

The rate is deliberately **static and next to the currency setting** so all
summary math stays simple: every amount is stored in BDT poisha
(`Payment.amountPoisha`), and the settled figure (`providerAmount`, e.g. USD
cents) is recorded alongside for reconciliation. The dashboard, folio and
refunds all keep working in poisha — nothing downstream changes.

Stripe stays **off** until its currency *and* rate are set: availability
treats a missing rate as "not configured".

## 4. Turning on Stripe (test mode first)

1. Create a Stripe account at dashboard.stripe.com (test mode is the
   default — no real money moves).
2. Developers → API keys: copy the **Secret key** (`sk_test_…`).
3. Developers → Webhooks → Add endpoint:
   `https://demo1.vivereply.com/api/payments/stripe/webhook`
   with events `checkout.session.completed`, `checkout.session.expired`,
   `checkout.session.async_payment_failed`. Copy the **Signing secret**
   (`whsec_…`).
4. Either set `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` as Vercel env
   vars (they win, and lock the gateway on), **or** paste them on the Stripe
   card in `/admin/settings` → Payments.
5. On the Stripe card set currency `USD` and the BDT rate (e.g. `117.50`),
   then flip the toggle on.
6. Test with card `4242 4242 4242 4242`, any future expiry, any CVC.

Going live later = live keys (`sk_live_…`) **via env vars only** (never paste
live secrets into the dashboard), plus a live-mode webhook endpoint.

## 5. How a Stripe payment flows

1. Guest picks Stripe → the button shows the USD figure up front
   (`৳14,500 ≈ $123.40 USD`).
2. `POST /api/payments/stripe/create` verifies id + code + amount against
   the booking, creates a `Payment` row (`INITIATED`), and opens a Stripe
   Checkout Session → guest redirects to Stripe.
3. Guest pays → Stripe calls `/api/payments/stripe/webhook`
   (signature-verified) → payment flips to `SUCCESS` (exactly once — retries
   are answered as duplicates) → booking becomes `CONFIRMED`.
4. The guest lands back on their confirmation page.

Refunds run through the Stripe card's refund flow into the `StripeRefund`
table, so the dashboard's gross-minus-refunds math counts them like every
other gateway.

## 6. Security notes

- Dashboard secrets are encrypted with `SETTINGS_ENCRYPTION_KEY` (32 bytes
  hex — generate with `openssl rand -hex 32`). Without it, dashboard
  credential entry is refused; env vars keep working.
- Webhook signatures are HMAC-verified with a 5-minute tolerance; bad
  signatures get 400.
- Amounts are server-computed from the booking total — the client amount is
  cross-checked, never trusted.
- Create endpoints are rate-limited per IP and per booking.

## 7. Phase 2 (not in this build)

- Dashboard credential *entry* for the four local gateways (today: toggle +
  env-status visibility; credentials stay env-only so the live money path
  is untouched).
- Stripe reconcile cron (today: webhooks; the Checkout Session is the
  source of truth and retries are idempotent).

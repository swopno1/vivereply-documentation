# Stripe Setup Guide — End to End

**Audience:** a property owner or operator setting up Stripe solo.
**Time:** ~30 minutes. **Mode:** test first, live only at go-live.

## 1 — Get your keys

1. Create a Stripe account at [stripe.com](https://stripe.com) (or log in).
2. Stay in **Test mode** (toggle in the dashboard sidebar).
3. Go to **Developers → API keys**. Copy:
   - **Publishable key** (`pk_test_…`) — not stored in Suite, used by Stripe.js if needed
   - **Secret key** (`sk_test_…`) → `STRIPE_SECRET_KEY` env var

## 2 — Create the webhook endpoint

1. Go to **Developers → Webhooks → Add endpoint**.
2. Endpoint URL: `https://<your-property-domain>/api/webhooks/stripe`
3. Select events:
   - `checkout.session.completed`
   - `checkout.session.expired`
   - `charge.refunded`
   - `charge.dispute.created`
   - `charge.dispute.closed`
4. Copy the **Signing secret** (`whsec_…`) → `STRIPE_WEBHOOK_SECRET` env var.

## 3 — Configure Suite

Set in your deployment environment (or **Settings → Payments** in the admin dashboard once `SETTINGS_ENCRYPTION_KEY` is set):

- `STRIPE_SECRET_KEY` = your `sk_test_…`
- `STRIPE_WEBHOOK_SECRET` = your `whsec_…`

Redeploy (env changes trigger a rebuild).

## 4 — Test the full flow

1. Create a test booking in the admin.
2. Pay with Stripe test card `4242 4242 4242 4242`, any future expiry, any CVC.
3. Confirm: booking shows paid, payment reconciles (check the 15-min reconcile cron or trigger manually).
4. Test a refund: **Payments → booking → Refund** (OWNER + 2FA). Confirm the refund lands in Stripe test dashboard.
5. Check **Finance → Stripe disputes** is reachable (empty is fine).

## 5 — Go live

1. In Stripe, toggle to **Live mode**.
2. Repeat steps 1–2 with live keys (`sk_live_…`, new `whsec_…`).
3. Update the env vars, redeploy.
4. Run one real micro-payment (e.g. ৳10) and refund it to prove the live path.

## 6 — Recovery

- **Webhook secret rotated:** update `STRIPE_WEBHOOK_SECRET`, redeploy. Missed events during the gap are picked up by the reconcile cron.
- **Lost secret key:** roll the key in Stripe dashboard, update env, redeploy. Old key stops working immediately.
- **Dispute opened:** Suite logs it in **Finance → Stripe disputes** with the evidence deadline. Submit evidence in Stripe before the deadline; the dispute row tracks status.

## What Suite handles automatically

- Webhook signature verification (HMAC)
- Exactly-once event processing (idempotency keys)
- Payment reconciliation every 15 minutes
- Refund audit trail (who, when, how much, 2FA)
- Dispute event ingestion (`dispute.created` / `dispute.closed`)

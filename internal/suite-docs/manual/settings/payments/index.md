# Payments Settings — Staff Training Module

**Page:** `/admin/settings?tab=payments` — gateway configuration.
**Audience:** owners (only).
**Time to complete:** about 15 minutes.
**Prerequisite:** the [Settings](..) module.

## Learning objectives

After this module you understand the gateway registry: how gateways are
activated, configured, and priced in currency.

## 1. The gateway cards

One card per gateway (bKash, Nagad, SSLCommerz, BanglaQR, Stripe). Each
card shows its status: for the local gateways the dashboard shows
environment status and the toggle only — their credentials live in the
server environment until Phase 2. Only **Stripe** takes credentials from
the dashboard today. Secrets are **write-only**: you can set them, never
read them back.

## 2. The activation rules

- **Env-configured ⇒ active.** A gateway fully configured via environment
  variables is active and its toggle is **locked** — the dashboard can't
  turn it off.
- **Owner-configured (Stripe only, for now).** Stripe can also be
  configured from the dashboard; the list is dynamic — new gateways
  appear as cards when added.
- **Fallback order:** environment → owner settings → defaults.

## 3. Currency and conversion

Each gateway has a **settlement currency** (BDT by default for every
gateway, Stripe included — USD is only Stripe's runtime fallback when
nothing is set) and a **static conversion rate** next to the currency
setting. The booking amounts stay in poisha (BDT) as the source of truth;
the rate exists so dashboard summaries stay simple and comparable.
Stripe is offered as soon as it is enabled and configured — the rate is
*not* checked at offering time. The rate gates *charging*: without it a
Stripe payment fails with a missing-rate error. Set the currency + BDT
rate on its card before going live.

## 4. Owner-only

Gateway forms are **owner-only** today. Credentials are the property's
money pipes — they don't belong in more hands than necessary. The test
connection buttons verify credentials without processing real money.

## 5. Troubleshooting

| Symptom | Check first |
|---|---|
| Gateway toggle locked | It's env-configured — active by environment, not by toggle. |
| Stripe payment fails at checkout | Its conversion rate isn't set — set the currency + the BDT rate on its card. The card still offers Stripe; only charging is blocked. |
| Can't see secret values | Write-only by design — re-enter them if unsure. |
| Tab missing | Owner-only — your role can't open it. |

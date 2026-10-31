# Deployment Runbook — ViveReply Suite

**Audience:** operators deploying a Suite instance for a new property.
**Prerequisite:** the onboarding decision (team-registers vs self-serve wizard) — see the P0 flag below.

> **P0 DECISION NEEDED:** `content/chatbot/setup/index.md` says "the ViveReply team registers tenants (there's no public signup — by design)" while `content/chatbot/integration/index.md` Step 0 describes self-serve signup creating the property automatically. This runbook assumes **team-led deployment** (the setup-page truth). If the founder picks self-serve, Step 1 changes.

## Step 1 — Provision

1. Create the property record in the Suite database (per the onboarding decision).
2. Create an OWNER login for the property owner.
3. Note the property slug — it becomes the deployment identifier.

## Step 2 — Environment inventory

Set these per-property. Missing any one of them is the most common deploy failure.

| Variable | Source | Notes |
|---|---|---|
| `DATABASE_URL` | Supabase / Postgres | Per-property database |
| `BETTER_AUTH_SECRET` | Generate: `openssl rand -hex 32` | Session signing |
| `SESSION_SECRET` | Generate: `openssl rand -hex 32` | Concierge bridge sessions |
| `SETTINGS_ENCRYPTION_KEY` | Generate: `openssl rand -hex 32` | AES-256-GCM for dashboard secrets; set once, never rotate |
| `RESEND_API_KEY` | Resend dashboard | Transactional email |
| `RESEND_FROM_EMAIL` | Resend | Must be a verified domain (e.g. `demo1@mail.vivereply.com`) |
| `CRON_SECRET` | Generate: `openssl rand -hex 32` | Protects `/api/cron/*`; unset = all crons fail closed |
| `CONCIERGE_BRIDGE_KEY` | Mint in Concierge admin | Links Suite ↔ Chatbot bridge API |
| `STRIPE_SECRET_KEY` | Stripe dashboard | Test mode first; live only at go-live |
| `STRIPE_WEBHOOK_SECRET` | Stripe dashboard | Per-endpoint secret |

## Step 3 — Migrate

```bash
prisma migrate deploy
```

Migrations run in filename order. Verify both Stripe P0 migrations applied:
- `20261031120000_stripe_idempotency`
- `20261031130000_stripe_disputes`

## Step 4 — Build & deploy

```bash
pnpm build
```

The build runs `prisma generate` first. A green build with zero TypeScript errors is the deploy gate — do not deploy on a red build.

## Step 5 — Register crons

In `vercel.json` (or your scheduler), confirm:

| Job | Schedule | Purpose |
|---|---|---|
| Night audit | `5 22 * * *` (UTC) | Closes the business day |
| Stripe reconcile | every 15 min | Settles pending Stripe payments |
| Booking-hold expiry | per property decision | Releases expired PENDING holds |

## Step 6 — Post-deploy verification

- [ ] Homepage returns 200
- [ ] `/api/concierge/ping` returns 200 (bridge alive)
- [ ] Availability API returns real room data for the property
- [ ] Admin login works (OWNER)
- [ ] Test booking → payment → confirmation flow in test mode
- [ ] Night-audit cron fires (check logs next morning)

## Rollback

1. Revert to the previous deployment in Vercel (instant).
2. Migrations are forward-only — if a migration broke data, restore from the pre-deploy database backup before re-running.
3. Never re-seed a production database.

## Per-property checklist

Copy this per tenant. Every property gets its own row; nothing is shared except the codebase.

- [ ] Property record + OWNER login created
- [ ] All env vars set (table above)
- [ ] Migrations applied
- [ ] Build green
- [ ] Crons registered
- [ ] Verification passed
- [ ] Owner trained (see staff training manual)

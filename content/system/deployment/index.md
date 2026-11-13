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

Every job below must run on its schedule or the property silently rots:
the business day freezes, holds never release, reminders never send,
postings never post. `vercel.json` schedules the night audit only —
**everything else lives in the host scheduler** (VPS crontab, or the
Docker host's crontab — see the note below). Each route takes
`Authorization: Bearer $CRON_SECRET` (header only); without the secret
every job fails closed.

| Job | Route | Schedule | Purpose |
|---|---|---|---|
| Night audit | `/api/cron/night-audit` | `5 22 * * *` (daily 04:05 Dhaka) | Closes the business day (Step 5b) |
| Booking-hold expiry | `/api/cron/pending-expiry` | `0 * * * *` (hourly; 24h rule) | Releases PENDING holds older than 24h |
| Ledger posting | `/api/cron/ledger-posting` | `15 * * * *` (hourly) | Posts records into the books |
| Guest reminders | `/api/cron/guest-reminders` | `0 3 * * *` (daily 09:00 Dhaka) | Pre-arrival SMS/WhatsApp reminders |
| Blog cleanup | `/api/cron/blog-attempts-cleanup` | `45 3 * * *` (daily) | Clears old submission attempts |
| BanglaQR receipt retention | `/api/cron/banglaqr-retention` | `30 3 * * *` (daily) | Deletes old receipt images |
| Google reviews | `/api/cron/fetch-google-reviews` | `0 5 * * *` (daily) | Pulls fresh reviews |
| bKash / Nagad / SSLCommerz reconcile | `/api/cron/*-reconcile` | `*/5 * * * *` | Settles pending gateway payments |
| Stripe reconcile | `/api/cron/stripe-reconcile` | `*/15 * * * *` | Settles pending Stripe payments |
| BanglaQR release | `/api/cron/banglaqr-release` | `*/5 * * * *` | Releases expired receipt holds |
| PMS sync | `/api/cron/pms-sync` | `*/15 * * * *` | Channel availability sync (when PMS is configured) |
| Database backup | `scripts/backup-postgres.sh` | `0 2 * * *` (daily) | pg_dump + upload (shell, not HTTP) |

Reconcile/release jobs only matter while their gateway is in use;
System Health shows the rest as "Not needed". **Docker hosts:** a
container has no cron daemon — put these same lines in the Docker
host's crontab against the public URL (full text in the internal
DEPLOYMENT §7.2e), or run a scheduler sidecar. Skipping this leaves
every job at "Never ran" — the single most common broken deployment.

## Step 5b — The business day and the night audit

The property runs on a **business day**, not the calendar: the open day
only moves when the night audit closes it (or the 04:00 failsafe fires).
Everything dated follows the open day — folio lines, dashboard windows,
expense caps, the daily sheet. A day that never closes freezes the
property in time: new activity keeps landing on the stale date.

The night audit, each close: decides arrivals that never checked in
(no-show vs keep), posts **tonight's room nights one at a time** to
in-house folios, carries stayover rooms into cleaning, flags undelivered
room-service orders and unverified payments, then opens the next day.
Room revenue exists only because this job runs — no audit, no room
charges, ever.

## Step 6 — Post-deploy verification

- [ ] Homepage returns 200
- [ ] `/api/concierge/ping` returns 200 (bridge alive)
- [ ] Availability API returns real room data for the property
- [ ] Admin login works (OWNER)
- [ ] Test booking → payment → confirmation flow in test mode
- [ ] **System Health shows no needed job at "Never ran"** — open
  `/admin/system` as OWNER past each job's first scheduled time (hourly
  jobs: within the hour; dailies: the morning after). A job stuck at
  "Never ran" means its schedule line is missing or failing — check the
  scheduler host's cron log, not the app.
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

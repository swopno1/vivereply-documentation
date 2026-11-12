# Cron jobs — demo1 branch

Date: 2026-10-29. Branch: `client/demo1`. For manual review — nothing here is
scheduled except where marked ✅. Official per-route schedules live in
`docs/DEPLOYMENT.md` §7.2e and `src/lib/system/jobs.ts` (JOBS registry).

## 1. The "Attention Required" unpaid-booking alerts — how they work today

- **Showing the alert:** no cron involved. `/admin` (dashboard `AlertsData`,
  `src/app/admin/page.tsx`) runs a live query on every visit: `PENDING`
  bookings with `createdAt` older than 24 hours, oldest first, capped at 20.
  The alerts visible at the time of writing (e.g. DM1-2611-100, DM1-2611-004
  — booking codes regenerate on every reseed, so expect different numbers)
  are rows matching that query right now.
- **Clearing them automatically:** `/api/cron/pending-expiry` (M2, 24-hour rule,
  founder decision 2026-10-27). It expires unpaid PENDING bookings older than
  24h with no payment evidence → status EXPIRED, units freed. Guards:
  PENDING_MANUAL_VERIFICATION is never auto-released; SUCCESS / verification
  states, pay-at-checkin markers and unknown states block expiry; guarded
  compare-and-swap per booking; silent (no guest email). `?dryRun=1` lists
  what would expire without writing (still needs auth).
- **Current state:** the route is built but **not scheduled anywhere**, so
  alerts pile up and nothing auto-expires. A booking stays listed until staff
  resolves it in `/admin/bookings` (cancel / confirm) or the expiry job runs.
- **Manual alternative today:** open each booking in `/admin/bookings` and
  cancel or confirm it. One-shot auto-run: preview with
  `?dryRun=1` first (see §6), then run without it to execute.

## 2. Inventory — every `/api/cron/*` route on this branch

Auth (all routes): `Authorization: Bearer $CRON_SECRET` header; fails closed
when CRON_SECRET is unset. Payment/RMS routes refuse `?secret=` in the URL
(it would land in access logs). Vercel Cron sends the header automatically
from the project's CRON_SECRET. Every route is safe to run twice /
concurrently. Run history: each job writes a heartbeat row; Admin › System
health (`/admin/system`, OWNER/AUDITOR) lists every registered job with its
last success and flags stale / never-ran.

| Route | What it does | Official schedule | Scheduled now? |
|---|---|---|---|
| `/api/cron/night-audit` | Closes the open business day from 04:00 property time; catches up older open days; never marks no-shows. | Hourly (`0 * * * *`) | ✅ Daily 04:05 Dhaka via vercel.json (2026-10-29) |
| `/api/cron/pending-expiry` | Expires unpaid PENDING bookings older than 24h with no payment evidence (M2). | Hourly (route comment) | ❌ Not scheduled |
| `/api/cron/ledger-posting` | Posts desk / store / expenses / cash-drawer activity to the books. Fail-closed if the accounting module is off. | Hourly (`15 * * * *`) | ❌ Not scheduled |
| `/api/cron/bkash-reconcile` | Settles bKash payments the redirect flow left open; prunes payment rate-limit hits. | Every 5 min | ❌ Not scheduled |
| `/api/cron/nagad-reconcile` | Same for Nagad. | Every 5 min | ❌ Not scheduled |
| `/api/cron/sslcommerz-reconcile` | Settles SSLCommerz callbacks left open; follows pending refunds. | Every 5 min | ❌ Not scheduled |
| `/api/cron/banglaqr-release` | Releases BanglaQR bookings whose receipt window expired; escalates overdue verifications to admin. | Every 5 min | ❌ Not scheduled |
| `/api/cron/banglaqr-retention` | Deletes receipt images 90 days after check-out. | Daily 03:30 | ❌ Not scheduled |
| `/api/cron/blog-attempts-cleanup` | Deletes blog submission attempts older than 90 days. | Daily 03:45 | ❌ Not scheduled |
| `/api/cron/fetch-google-reviews` | Refreshes the Google reviews cache. Only needed with Maps key + place id set. | Daily 05:00 | ❌ Not scheduled |
| `/api/cron/pms-sync` | Runs the PMS sync engine. Only needed with a PMS configured. | Every 15 min | ❌ Not scheduled |
| `database-backup` | `scripts/backup-postgres.sh` + rclone off-site copy — server crontab, NOT an HTTP route. | Daily 02:00 / 02:30 | ❌ N/A on Vercel |

Official schedules are server-crontab times; Vercel crons are UTC — convert
when adding to vercel.json (Dhaka = UTC+6).

## 3. The Hobby constraint

Vercel Hobby: each cron job at most **once per day** — a more frequent
expression fails deployment. So on Hobby, only the daily-shaped jobs fit in
vercel.json: night-audit ✅ (done), banglaqr-retention, blog-attempts-cleanup,
fetch-google-reviews. The sub-daily jobs (all four reconciles, ledger-posting,
pms-sync, pending-expiry) **cannot** run at official frequency on Hobby.

## 4. Proposed schedules — for manual review

**Option A — Hobby only (vercel.json, daily):** add the three daily jobs
(banglaqr-retention ~03:30 UTC, blog-attempts-cleanup ~03:45 UTC,
fetch-google-reviews ~05:00 UTC — only if a Maps key / place id is set).
Night-audit stays daily. Sub-daily jobs remain manual / on-demand until a
finer scheduler exists.

**Option B — finer scheduler:** Vercel Pro cron, Modal scheduled functions,
or an external pinger (e.g. cron-job.org) calling the endpoints with the
`Authorization` header — any frequency, secret stays in the service config,
never in the URL. Then run everything at official frequency.

**Recommendation:** Option A now (one commit, no new services), Option B when
a property goes live for real clients.

## 5. Gaps and decisions needed

1. **pending-expiry is not in the JOBS registry** (`src/lib/system/jobs.ts`)
   → invisible to System health. jobs.ts claims a unit test fails if a cron
   route is added without it — verify whether that test exists / passes.
   Decide: schedule (daily on Hobby vs hourly on a finer scheduler) and
   register it.
2. **night-audit vs the health page:** JOBS says `staleAfterHours: 3`
   (hourly assumption) but it now runs daily → `/admin/system` will flag it
   red/stale ~21h a day. Fix: bump to 26h in jobs.ts, or accept the warning.
3. **Payment reconciles on this demo:** payments run in simulate mode, so the
   reconciles are likely no-ops. Needed at all before real gateway
   credentials? (banglaqr-release matters only if the BanglaQR
   manual-verification flow is used.)
4. **ledger-posting:** fail-closed when the accounting module is off —
   scheduling it is harmless but pointless until accounting is on.
5. **pms-sync / fetch-google-reviews:** nothing configured on demo1 (no PMS,
   no Maps key) — skip both for now.
6. **database-backup:** no server cron exists on Vercel — decide the backup
   story for the hosted demo DB (Supabase automated backups / PITR?).

## 6. Manual one-shots (all need CRON_SECRET)

```bash
BASE=https://demo1.vivereply.com
H=(-H "Authorization: Bearer $CRON_SECRET")
curl -X POST "${H[@]}" $BASE/api/cron/night-audit                 # catch up business days
curl -X POST "${H[@]}" "$BASE/api/cron/pending-expiry?dryRun=1"   # preview expiries
curl -X POST "${H[@]}" $BASE/api/cron/pending-expiry              # execute expiries
curl -X POST "${H[@]}" $BASE/api/cron/ledger-posting
curl -X POST "${H[@]}" $BASE/api/cron/bkash-reconcile
curl -X POST "${H[@]}" $BASE/api/cron/nagad-reconcile
curl -X POST "${H[@]}" $BASE/api/cron/sslcommerz-reconcile
curl -X POST "${H[@]}" $BASE/api/cron/banglaqr-release
curl -X POST "${H[@]}" $BASE/api/cron/banglaqr-retention
curl -X POST "${H[@]}" $BASE/api/cron/blog-attempts-cleanup
curl -X POST "${H[@]}" $BASE/api/cron/fetch-google-reviews
curl -X POST "${H[@]}" $BASE/api/cron/pms-sync
```

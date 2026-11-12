# Go-live: running unattended, sign-in protection, deploy checks

Branch `phase-h-golive`, stacked on `phase-a3-audit` → `phase-g-hr` → `main` (`5cca3f9`). Same rules as every phase: additive migration, no route changes, no new dependencies, fail closed, EN and BN, 360px. The owner's per-client checklist is [`docs/GO-LIVE-CHECKLIST.md`](../../GO-LIVE-CHECKLIST.md).

## §1 Every scheduled job reports, and one page shows them

- **Registry:** `src/lib/system/jobs.ts` lists all eleven jobs: the nightly backup and the ten `/api/cron/*` routes. For each it records the schedule, how old a success may be before the job counts as stopped, and when it is needed:
  - a module that must be on (night audit: front desk; ledger posting: accounting);
  - a gateway that must be available (each payment job);
  - configuration that must exist (Google reviews: a Maps key and place id; PMS sync: a provider with credentials).

  `jobs.test.ts` fails if an `/api/cron/*` route is added without a registry entry.
- **Heartbeats:** every job now writes `CronHeartbeat` (the shared table the payment jobs already used): night audit, ledger posting, blog clean-up, Google reviews, PMS sync and BanglaQR retention, on success and on failure. A failed heartbeat never fails the job. `scripts/backup-postgres.sh` records `database-backup` with `psql` after a good dump.
- **Admin › System health** (`/admin/system`, `SETTINGS.view`: OWNER, AUDITOR):
  - every job: running, stopped, failing, never ran, or not needed; last success and last error;
  - configuration, from the same checks as `pnpm check:env`. These now live in `src/lib/system/env-checks.ts`; the page shows variable names, never values;
  - the open business day, and how far behind it is;
  - the books' start date and records waiting to be posted;
  - owner accounts without two-factor sign-in.

  The page leads with "Everything is working" or "N things need attention". Sidebar: "System Health" after Settings.
- **DEPLOYMENT.md §7.2e:** the complete crontab in one place. It adds the three jobs that were never documented: blog clean-up, Google reviews and PMS sync.

## §2 Sign-in protection

- **Rate limits:** Better Auth's limiter is now stored in the database (new `RateLimit` table), so all PM2 workers share the counts. Before, it was the in-memory default, one count per worker (readiness report §6 gap). Per client address:

  | Endpoint | Limit |
  |---|---|
  | Sign-in | 10 per 15 minutes |
  | TOTP step | 10 per 5 minutes |
  | Password reset request | 5 an hour |
  | Password reset | 10 an hour |
  | Everything else | 100 a minute |

  On in production (Better Auth's default).
- **Client address:** taken from nginx's `X-Real-IP` (`$remote_addr`). The audit log's IP now uses the same rule (`X-Real-IP`, otherwise the last `X-Forwarded-For` hop). Before, it took the first `X-Forwarded-For` entry, which the client controls. DEPLOYMENT.md §4 says to keep the nginx header.
- **Failed attempts audited:** `SIGN_IN_FAILED` (with the email tried) and `TWO_FACTOR_FAILED`, with IP and device, through a Better Auth `after` hook. Successful sign-ins have been audited since A3.
- **Login page:**
  - was English-only; it now uses the translated `adminShell` strings and has a language switch;
  - says "Too many attempts. Wait 15 minutes" on a 429;
  - links its labels to their inputs, and sets `autocomplete` (username, current password, one-time code);
  - the "Remember me" row is a 44px target.

## Verification

| Gate | Result |
|---|---|
| Full suite on a fresh, migrated `resort_test` (includes the four gateway suites: `banglaqr-retention` was touched) | 1,439 passed, 1 skipped (the migrations check), after updating one sidebar test for the new core "System Health" item |
| `pnpm test:db` | 363 passed, twice in a row |
| `pnpm test` | 800 passed (640 DB tests skipped without a `*_test` DB) |
| `pnpm lint`, `pnpm build`, i18n parity, drift | 0 problems; clean; parity OK; no drift. New routes: `/admin/system`; new migration `20261016100000_auth_rate_limit` |

**Live (production build, scratch DB, 360px):**
- **Rate limit:** 12 wrong passwords from one address gave 401 ten times, then 429. A correct sign-in from another address was still let in (200). Ten `SIGN_IN_FAILED` rows carried that address.
- **Login page in Bengali:** fully translated, no overflow, every control at least 44px. A wrong password shows the translated error.
- **System health in Bengali, as AUDITOR:**
  - the backup heartbeat (recorded by the script's SQL) shows "Running";
  - night audit, ledger posting and blog clean-up show "Never ran" (no crontab on this machine);
  - the payment jobs show "Not needed" (no credentials), while Configuration lists each enabled gateway's missing variables;
  - "8 things need attention", which is correct for an unconfigured machine.

## Limitations

- **Alerts are on the page, not pushed.** Nothing emails the owner when a job stops (the payment jobs' own stale-cron emails remain). Check System health after deploying and weekly.
- **The backup heartbeat proves the dump ran, not that it restores.** Keep the quarterly restore test (DEPLOYMENT.md §7.4).
- **Without nginx's `X-Real-IP`** (a misconfigured proxy), every visitor shares one rate-limit count.

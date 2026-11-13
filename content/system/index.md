# System Health — Staff Training Module

**Page:** `/admin/system` — is the system healthy?
**Audience:** owners, auditors, technical staff.
**Time to complete:** about 10 minutes.
**Prerequisite:** none.

## Learning objectives

After this module you can read the system health page and know what to do
when it shows problems.

## 1. What the page is

A read-only health check (SETTINGS.view — owner and auditor territory)
in three blocks, with one problem count at the top:

- **Scheduled jobs** — all 14, each with its schedule and state: ok,
  stale, failing, never run — or "Not needed" when the job's module,
  gateway, or config isn't in use (reconcile jobs for unused gateways,
  reviews without API keys, PMS sync without a PMS). See the
  [runbook](deployment/) for what each job does and when it must run.
- **Configuration** — required environment variables grouped by area:
  Core, Email (RESEND_API_KEY, RESEND_FROM_EMAIL), each payment
  gateway, media (R2), PMS, plus the payment mode and production-mode
  flags. A missing secret names itself here.
- **Operations** — the **open business day** (with a "N days behind"
  warning when the night audit hasn't closed), the **books** state
  (started or not), and **owner/2FA stats**.

## 2. Reading it

- **Jobs stale or failing** — a scheduled job (night audit, expiry
  sweeps, reconciliations) hasn't run or is erroring. This is the most
  common real problem: check the job's route and the server log.
- **Missing environment checks** — a required secret isn't set (email,
  a gateway, the session secret). Nothing that depends on it works until
  it's set. This is a deploy-time checklist, not a daily screen.
- **Business day wrong** — the property's "today" is off; trace it to
  the night audit and the timezone setting.
- **2FA stats** — who among the owners has two-factor on. Every owner
  should.

## 3. Discipline

Check this page **after every deploy** and whenever "something's off but
nobody knows what". A green page doesn't prove everything works — but a
red page tells you exactly where to look.

## 4. Troubleshooting

| Symptom | Check first |
|---|---|
| Job never ran | The cron isn't registered or the deploy didn't include the schedule — check the hosting cron config. |
| Problem count won't clear | Fix the underlying check — the page only reports, it never fixes. |
| Page gated | Owner/auditor only — by design. |

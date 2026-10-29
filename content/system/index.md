# System Health — Staff Training Module

**Page:** `/admin/system` — is the system healthy?
**Audience:** owners, auditors, technical staff.
**Time to complete:** about 10 minutes.
**Prerequisite:** none.

## Learning objectives

After this module you can read the system health page and know what to do
when it shows problems.

## 1. What the page is

A read-only health check (SETTINGS.view — owner and auditor territory):
**scheduled jobs** (their state: ok, stale, failing, never run),
**configuration checks** (required environment variables for core
services, email, and enabled gateways), the **business day**, the
**books** state, and **owner/2FA stats**. One number at the top: problem
count.

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

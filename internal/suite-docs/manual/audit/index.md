# Audit Log — Staff Training Module

**Page:** `/admin/audit` — who did what, when.
**Audience:** owners, auditors.
**Time to complete:** about 10 minutes.
**Prerequisite:** none.

## Learning objectives

After this module you can search the audit log and understand what it
proves.

## 1. What the page is

The property's memory of **every significant action**: who, what, when,
on which record. Read-only, filterable by action, actor, date, and record
(filters live in the URL, so a filtered view is shareable). Paginated —
the log is append-only and grows forever.

Two sources sit behind tabs at the top: **Actions in the admin** (people
and jobs) and **Payment gateway events**. Each tab has its own dropdown —
module on Actions, gateway provider on Payments — plus actor,
a contains-search on the action/event name, and record id. One search
covers **up to 366 days**; the **Download CSV** button exports the
current filters (up to 10,000 rows). Click any row to expand it: IP
address, device, and the full metadata.

**Permission:** AUDIT.view (owner, auditor), behind the auditLog module;
the CSV download needs AUDIT.export (both have it).
Nobody edits the audit log — not even owners. That's the whole point.

## 2. What it's for

- **"Who changed this?"** — filter by the record: every status change,
  approval, and edit with the actor's name.
- **"What did they do today?"** — filter by actor and date.
- **Disputes.** The folio says the discount was ৳500 and the guest says
  ৳1,000? The log shows who posted it and when. The log is the referee.
- **Reviews.** Spot-checking approvals and overrides keeps the
  separation-of-duties pattern honest.

## 3. What it doesn't do

The audit log records *actions*, not *intentions*. It shows that a refund
was approved at 14:32 by the manager — not why. The "why" lives in the
notes and reasons the manuals keep demanding. **Write the reason at the
time; the log preserves the fact forever.**

## 4. Troubleshooting

| Symptom | Check first |
|---|---|
| Action missing from the log | Some read-only views don't log — but every write that matters does. If a significant write isn't logged, report it as a bug. |
| Can't see the page | AUDIT.view — owner and auditor only. |
| Too many rows | Filter — by date, then by actor or record. That's what the filters are for. |

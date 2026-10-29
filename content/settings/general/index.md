# General Settings — Staff Training Module

**Page:** `/admin/settings?tab=general` (the default tab).
**Audience:** managers, owners.
**Time to complete:** about 15 minutes.
**Prerequisite:** the [Settings](..) module.

## Learning objectives

After this module you can configure the property's identity, time, and
policies — and explain what each one drives.

## 1. Property identity and contact

Name, address, phone, email — what guests see on confirmations, receipts,
and the website footer. The **contact email** is also where lead alerts go
(see the contact form wiring): if it's still a placeholder, alerts go
nowhere — set the real one.

## 2. Timezone — the most consequential setting

The **property timezone** (default Asia/Dhaka, editable via picker) drives
*every* date in the system: the business day, the night audit's 04:00
close, dashboard "today", and all property-local timestamps. Change it only
when the property actually moves timezones — and never casually, because
every screen's "today" shifts with it.

## 3. Check-in / check-out windows and fees

- **Check-in from / check-out until** — the policy windows shown to guests.
- **Early check-in fee / late check-out fee** — the folio's Add-charge
  form auto-fills these amounts for those categories. Change the fee here
  once; every future folio uses it.

## 4. Email status

A read-only card showing email readiness from the server's environment —
**no secret values are shown**. If mail isn't sending, this card is the
first place to look: it tells you what's configured and what's missing,
without exposing credentials.

## 5. Troubleshooting

| Symptom | Check first |
|---|---|
| "Today" looks wrong everywhere | The property timezone — check what it's set to. |
| Lead alerts going nowhere | The contact email is still a placeholder — set the real one. |
| Early/late fees look stale on folios | The fee changed after the charge was posted — posted lines keep their history. |
| Email not sending | The email status card — what's unconfigured? |

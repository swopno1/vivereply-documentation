# Phase B §3: night audit

**What it is:** the night audit closes the business day (§1). It is at `/admin/front-desk/night-audit`, linked from the Front Desk page.

**Who can use it:** anyone with `FRONT_DESK.view` can see it; running it needs `FRONT_DESK.approve` (OWNER, MANAGER) and OWNER 2FA. The `frontDesk` module must be on.

## Owner decisions applied

- **Manual, with an automatic fallback.** A manager closes the day from the checklist. If it is still open at **04:00** property time the next morning, the cron closes it.
- **No-shows are a manager's call.** Each arrival that never checked in needs a decision before a manual close:
  - **mark no-show**: the booking becomes `NO_SHOW`, the unit is released, payments are kept;
  - **keep**: the guest is arriving late, recorded for that business day only.

  The cron never marks no-shows; it records them as unresolved.
- **When a day can be closed:** once it is over, after midnight. This changed from the plan's "after 20:00": an evening close would move late arrivals off the Front Desk page while guests are still walking in. The business date can't get ahead of the calendar.

## The checklist (`loadAuditChecklist`)

1. **Arrivals that didn't check in:** due on or before the business date, still `PENDING`, `CONFIRMED` or `PENDING_MANUAL_VERIFICATION`. A booking kept yesterday that still hasn't arrived shows again today.
2. **In house past check-out:** a warning; the desk checks them out or a manager extends the booking.
3. **Payments awaiting BanglaQR verification:** a count, for information.
4. **Room charges to post:** each in-house stay's unposted nights up to and including the business date, with amounts. A night missed earlier is caught up.

## Closing (`closeBusinessDay`)

**What it does:** in one transaction, with the `BusinessDay` row locked (`SELECT … FOR UPDATE`), it:
1. checks the day is still `OPEN`, plus the rules for the close type (manual: day over and every arrival decided; cron: `autoCloseDue`);
2. posts the room nights (§2 `postRoomNights`; idempotent, booking row locked);
3. writes the **summary snapshot** to `BusinessDay.summary`;
4. marks the day `CLOSED` (when and by whom) and opens the next;
5. writes the audit row `NIGHT_AUDIT_CLOSED`.

**The summary snapshot contains:**
- bookable and occupied rooms, and occupancy;
- arrivals, departures and no-shows;
- room revenue (room nights of that date);
- extras, discounts, desk payments by method and desk refunds (lines posted that business day);
- online payments and refunds received in that day's window;
- unresolved arrivals and overstays.

**Concurrent closes:** a second close waits for the lock, then gets `not_open`; nothing is posted twice (tested with two at once). The action also refuses a date that is no longer the open day, for a page left open while someone else closed it.

**Decisions:** `NightAuditDecision` (migration `20261008120000_night_audit`) records `KEEP` or `NO_SHOW` per business date and booking. A `NO_SHOW` goes through `updateBookingStatus`, so the gateway guards, unit release and audit all apply.

## Fallback cron

- **Route:** `GET`/`POST /api/cron/night-audit`, with the `Authorization: Bearer $CRON_SECRET` header only (no query secret).
- **Schedule:** run it **hourly**, e.g. `0 * * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/cron/night-audit`.
- **What it closes:** from 04:00 it closes yesterday; older open days close at any hour, oldest first, one transaction each. The actor is `system:night-audit-cron`.
- **Safety:** safe to run twice or at the same time as a manual close. With the `frontDesk` module off it does nothing (`{ skipped: "module_disabled" }`).

## Live check

On a production build at 360px in Bengali, with a scratch database whose open day was set to yesterday:
- **Before deciding:** the checklist showed one guest who never arrived and one in-house stay with ৳4,000 to post (৳12,000 / 3 nights). Close was disabled, saying why.
- **After "Keep":** the arrival showed as kept and Close was enabled.
- **After Close:** "Closed. The business date is now Wednesday, 7 October 2026". The history showed who closed it, the occupancy and the room revenue.

## Tests (`src/lib/night-audit/audit.db.test.ts`, 7)

- **`autoCloseDue`:** false at 03:59 the next morning, true at 04:00, true for older days at any hour, false for today.
- **Checklist:** arrivals due today and earlier, overstays, room nights with exact amounts, day-over flag.
- **Manual close:**
  - refused before midnight and with undecided arrivals;
  - after keep and no-show decisions (a future arrival refused as `not_due`), posts both nights including a catch-up;
  - writes the snapshot (no-shows, unresolved overstays), opens the next day and is audited;
  - closing again gives `not_open` with no extra charges.
- **Concurrency:** two simultaneous closes give one success and one `not_open`, one charge and one open day.
- **Cron:** three missed days closed in order after 04:00, each night posted on its own business day, no no-show marked, unresolved arrivals recorded; nothing more due before the next 04:00.
- **Actions:** front desk refused; a stale date refused.
- **Route:** 401 without the secret, 200 with it.

The enforcement test also covers both new actions for every role.

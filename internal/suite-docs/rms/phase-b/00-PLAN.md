# Phase B: business date, guest folio, night audit, daily sheet

Branch `phase-b-operations`, from `main` at `a76088b`. There is no written Phase B brief: `docs/rms/02–13` were planned but never written. This plan is built from:
- the Daily Sheet design agreed during RMS planning;
- the permission matrix (`01-ROLES-AND-PERMISSIONS.md`);
- the owner's decisions of 2026-10-07 (below).

The Phase A2 rules still apply:
- Additive migrations only.
- No route path changes.
- No new runtime dependencies.
- Fail closed, and audit every write.
- Every screen in EN and BN, working at 360px.
- One commit per section.
- `pnpm lint` and `pnpm build` before each commit.
- Gateway suites whenever payment code is touched.

## Owner decisions (2026-10-07)

| Topic | Decision |
|---|---|
| Night audit | **Manual with an automatic fallback.** An OWNER or MANAGER closes the day from a checklist screen. If the day is still open at 04:00 property time the next morning, a cron closes it and records whatever was left unresolved. |
| No-shows | **Flagged for a manager.** The night audit lists arrivals that never checked in. For each one, a manager either marks it **no-show** (the unit is released and payments are kept, per the refund policy) or **keeps** it (the guest is arriving late). Nothing changes without a person deciding. The cron fallback never marks no-shows. |
| Desk payments | **Recorded in Phase B.** Front desk records cash, card-machine, manual bKash/Nagad and bank-transfer payments on the folio. They are audited and can only be voided, with a reason. Online gateway payments appear on the folio automatically. |

## Permissions (no matrix change)

| Action | Grant | Roles |
|---|---|---|
| See a folio, the daily sheet, the night audit screen | `FRONT_DESK.view` | OWNER, MANAGER, FRONT_DESK, AUDITOR (read-only) |
| Post an extra charge, record a desk payment, add a daily note | `FRONT_DESK.create` | OWNER, MANAGER, FRONT_DESK |
| Discount, void a folio line, refund at the desk, check out with a balance due, mark a no-show, close the day | `FRONT_DESK.approve` | OWNER, MANAGER |
| Owner summary block on the daily sheet | `REPORTS.view` | OWNER, MANAGER (AUDITOR also sees it) |

Every screen also needs the `frontDesk` module flag.

## Sections

**§1 Business date and no-show status.**
- `BusinessDay` table (`date`, `OPEN`/`CLOSED`, closed by and when, summary). Exactly one day is `OPEN`; a partial unique index enforces it.
- The business date is the open day. It moves only when the night audit closes the day, so between midnight and the audit it is still "yesterday", as in any PMS.
- The Front Desk page and the daily sheet use it.
- New booking status `NO_SHOW`. It isn't a live status, so the unit is freed; it is labelled in EN and BN everywhere statuses are shown.

**§2 Guest folio.**
- **`FolioLine`, append-only** (a DB trigger refuses UPDATE and DELETE):
  - Kinds: room charge, extra charge, discount, desk payment, desk refund.
  - A correction is a reversal line with a reason, never an edit.
  - Each line has a unique idempotency key, so a double click or a re-run can't post twice.
- **Folio and balance:** the folio is the lines plus online gateway payments and gateway refunds, read from the payment tables. No gateway code changes.
  - **Balance due** = charges − discounts − payments + desk refunds.
  - **Projected balance** also counts room nights not yet posted, at the booking's nightly rate.
- **`Payment.source`** (`GATEWAY` default, or `DESK`), additive:
  - **Backfill:** offline-sale rows and manual refund rows become `DESK`.
  - **Old offline payments:** `PAID` offline rows get a matching folio payment line. `PART-PAID` rows never recorded the amount received, so the folio asks the desk to record it.
- **Dashboard fix:** stop counting manual refund rows (`DESK` + `REFUNDED`) as money received.
- **Page:** `/admin/bookings/[id]/folio`, linked from the booking detail.
  - Quick-add buttons for the early check-in and late check-out fees (from Settings), extra bed, laundry, minibar, food and other.
- **Checkout:** before checking out, any room nights already slept but not yet posted are posted. If a balance is still due, front desk can't check out; a manager can, with a reason, which is audited.

**§3 Night audit.**
- **Screen:** `/admin/front-desk/night-audit`, a checklist for the open business date:
  1. Arrivals not checked in: mark no-show or keep (each needs a manager decision before a manual close).
  2. In-house guests past their checkout date (warning).
  3. Payments awaiting BanglaQR verification (information).
  4. Room charges to post tonight, with amounts.
- **Close:** in one transaction with the business day row locked, it:
  - posts tonight's room charge for every in-house stay (idempotent);
  - stores the day's summary snapshot;
  - closes the day and opens the next;
  - writes the audit row.
- **When the day can close:** a day can be closed once it is over, after midnight property time. The business date can never get ahead of the calendar. (Changed from "after 20:00" while building §3: an evening close would move late arrivals off the Front Desk page while guests are still arriving.)
- **Cron fallback:** `/api/cron/night-audit`, run hourly. After 04:00 it closes any day older than today, catching up several missed days one at a time. It records unresolved items without marking no-shows.

**§4 Daily sheet.**
- **Page:** `/admin/front-desk/daily-sheet?date=`. It defaults to the business date; past dates are read-only and come from the stored snapshot, plus live lists.
- **Sections:**
  1. Header.
  2. At a glance.
  3. Arrivals (balance due, a tick box for checked-in).
  4. Departures (balance due, tick boxes for settled and keys).
  5. In-house (night X of Y).
  6. Room status grid (units).
  7. Money due today. FRONT_DESK sees per-booking amounts but no totals.
  8. Notes and reminders: a new `DailyNote` table, optionally aimed at a role, carried over until done; this is also the shift handover.
  9. Owner summary (OWNER/MANAGER). It sits at the top for them: yesterday's revenue and collections, occupancy against the same day last week, and open exceptions.
- **Print:** an A4 portrait stylesheet that is black-and-white safe, with repeated table headers, tick-box columns and blank note lines, plus a "Print" button.
- **Later phases:** housekeeping tasks, room service, groups, complaints, staff on duty and low stock join the sheet as their phases ship.

**§5 Verification report.** Gates, live checks at 360px in EN and BN, and the limitations.

## Not in Phase B

- **Cash-close per shift:** next, it builds on the desk payments recorded here.
- **Rate calendar and per-role discount caps:** discounts are manager-only for now.
- **VAT and service charge:** folio amounts are tax-inclusive until Phase F.
- **Changing dates for an overstay:** that stays the manager's booking edit.

# Phase B §4: daily sheet

**What it is:** `/admin/front-desk/daily-sheet?date=YYYY-MM-DD`, linked from the Front Desk page. It answers "what has to happen today, and who handles it?" as dense lists meant for the morning briefing. It is not the dashboard, which shows KPIs and trends.

**Who can use it:** anyone with `FRONT_DESK.view` (OWNER, MANAGER, FRONT_DESK, AUDITOR), while the `frontDesk` module is on. Housekeeping, kitchen, store, accounts and HR get 403.

**Dates:** it opens on the business date (§1). Previous and next buttons move a day at a time:
- up to 60 days back, read-only, with a notice;
- up to 7 days ahead, for preparation.

## Sections

1. **Header:** property name; the date in English and Bengali; on paper, who printed it and when.
2. **Owner summary.** Shown only to `REPORTS.view` (OWNER, MANAGER; AUDITOR too), at the top:
   - yesterday's room revenue and collections, from the night-audit snapshot (§3), or "not closed yet";
   - occupancy tonight against the same day last week;
   - BanglaQR payments to verify, guests past check-out, and items left unresolved at the last close.
3. **At a glance:** arrivals (how many arrived), departures (how many left), in house, vacant tonight, out of service, occupancy tonight.
4. **Arrivals:** due that day, plus earlier arrivals still on their way (a guest kept at the night audit, marked "due {date}"). The Front Desk page now lists them too. Columns: guest, booking code, phone, unit and room type, guests, nights, status, amount owed, and a ☐/☑ checked-in box.
5. **Departures:** amount owed, plus ☐ settled and ☐ keys boxes.
6. **In house:** night X of Y and amount owed. For a past date, the stays that covered that night.
7. **Room status:** every active unit with its status and occupant. A unit with a guest checked in shows as occupied.
8. **Money due:** stays on the sheet still owing, including room nights not yet posted (§2 projection). No-shows aren't listed. FRONT_DESK sees per-booking amounts but no total; a total shows only for `REPORTS.view`.
9. **Notes and reminders:** the new `DailyNote` table (migration `20261008130000_daily_note`).
   - **Adding:** `FRONT_DESK.create` adds a note for the business date or up to 30 days ahead, never a past day. A note can be aimed at a role ("for Housekeeping") and can **carry over**: it shows every day until marked done, then once more (struck through) on the day it was done.
   - **Records:** adding and completing are audited (`DAILY_NOTE_ADDED`, `DAILY_NOTE_DONE`). The database checks the text length and date formats.

**Still to come:** housekeeping tasks, room service, groups, complaints, staff on duty and low stock join as their phases ship.

## Print

- **Print button:** `window.print()`. The admin sidebar, header, mobile drawer, cookie banner, navigation and note form are hidden on paper.
- **Page and layout:** `@page { size: A4 portrait; margin: 12mm }`, with black text and borders that work on a black-and-white printer.
  - **Lists:** each list is a table on paper and from 640px wide, and a stack of cards on a phone. Header rows repeat on each page, and rows don't split across pages.
  - **For handwriting:** ☐ boxes and four blank lines under the notes.
- **Checked:** a print-media render at A4 width showed the header, owner table, glance boxes, tables with tick columns, the 8-column room grid, money due and note lines. The cookie banner was printing on top of the grid; it is now hidden on paper.

## Tests (`src/lib/daily-sheet/sheet.db.test.ts`, 4; a random date each run)

- **Lists:**
  - arrivals include a late arrival and a no-show (not counted);
  - departures and in-house (night 2 of 3);
  - money due excludes the no-show and the guest who paid in full;
  - unit grid occupant and maintenance status.
- **Past date:** lists the stays that covered that night, read-only.
- **Notes:**
  - added on the business date; a carried note shows the next day;
  - done on day 2: struck through that day, gone the day after;
  - refused for a past day, an unknown role or blank text;
  - AUDITOR refused.
- **Owner summary:** yesterday's snapshot, last week's occupancy, unresolved count.

The enforcement test covers both note actions for every role.

## Live check (production build, 360px, EN and BN)

- **Manager:** owner summary, glance, a late arrival marked "due 6 Oct" ("আসার কথা ছিল ৬ অক্টো"), in house "night 2 of 3", the room grid, money due with a total, and adding a note. No sideways scroll (page width 345 ≤ 360) and no tap target under 44px.
- **Front desk:** no owner summary, no total, per-booking amounts shown, notes can be added and completed, and the night audit is view-only.
- **Housekeeping:** 403 on the daily sheet, night audit and folio.

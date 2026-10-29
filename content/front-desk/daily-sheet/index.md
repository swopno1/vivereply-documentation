# Daily Sheet — Staff Training Module

**Page:** `/admin/front-desk/daily-sheet` — the day's full operational sheet.
**Audience:** front desk (primary), managers, owners.
**Time to complete:** about 30 minutes reading, then one supervised shift.
**Prerequisite:** the Front Desk module.

## Learning objectives

After this module you can:

- Explain what the daily sheet is for and how it differs from the front-desk
  page and the dashboard.
- Navigate between days (past, present, future) and know what changes.
- Read every section: owner summary, at-a-glance, the three stay tables, room
  status grid, money due, and notes.
- Use the sheet for the morning briefing (including printing it).
- Add, carry over, and close shift notes correctly.

## 1. What the daily sheet is

The front-desk page (§Front Desk module) answers *"who is here today?"*.
The **daily sheet** answers *"what has to happen today, and who handles
it?"* — arrivals, departures, in-house guests, every room's state, money
owed, and the shift's notes, on one page designed to be **printed for the
morning briefing** (A4 portrait, black-and-white safe, header rows repeat
across pages, blank lines for handwriting).

### The date navigator

Three buttons under the title: **Previous day**, **Business date**, **Next
day**. You can also open any date directly with `?date=YYYY-MM-DD`:

- **Up to 60 days back** — read-only history.
- **The business date** (highlighted) — today, fully working.
- **Up to 7 days ahead** — planning view.

**Past days are read-only** (an amber notice says so). One subtlety that
confuses new staff: on a past sheet, *balances show what is owed right
now*, not what was owed on that date. The past sheet is a window into the
day's operations, not a frozen financial snapshot.

## 2. Owner summary

Visible only with the *view reports* permission (managers, owners). A compact
table about **yesterday** — the last closed day:

| Row | What it means |
|---|---|
| Yesterday (date) | Which closed day this is about. *"Not closed yet"* means the night audit hasn't run — figures below will be partial. |
| Room revenue | Earned room revenue yesterday (from posted room charges). |
| Collected | Cash collected yesterday: desk + online payments minus desk + online refunds. |
| Occupancy | Tonight's occupancy vs. the same weekday last week — trend at a glance. |
| BanglaQR payments to verify | Receipts still waiting for review. |
| Past check-out | Overstay count — guests past check-out date. |
| Left unresolved at the last close | Items the night audit couldn't resolve on its own. |
| Cash shifts to sign off | Shifts counted with a difference, waiting for a manager. |
| Low stock / counts to approve | Inventory flags (when those modules are on). |
| Purchase orders / expenses to approve | Approval queues (when those modules are on). |

**How to use it.** This is the manager's 60-second morning read: was
yesterday healthy (revenue, occupancy trend), and what needs a decision
*right now* (verifications, overstays, sign-offs, approvals)? Anything
non-zero in the bottom rows is work assigned to you — don't leave the
briefing without an owner for each.

**Where it comes from.** Yesterday's figures come from the night audit's
**day summary**, written when the day closed — not recomputed live. That's
why "Not closed yet" matters: until the close runs, there is no summary.

## 3. At a glance

Six tiles, the day's vital signs:

- **Arrivals** — expected today, with *"X of Y in"* underneath (how many
  already checked in).
- **Departures** — due today, with *"X of Y out"*.
- **In house** — checked in right now.
- **Vacant tonight** — sellable units for tonight; *"N empty and ready"*
  underneath counts the ones that are vacant **and inspected** (true
  sell-ready).
- **Out of service** — units in maintenance or out of order (can't be sold).
- **Occupancy tonight** — percentage.

**How to read it.** The two numbers that run your day are *Vacant tonight*
(can I sell?) and the arrivals/departures progress (how much work is left?).
*Empty and ready* vs *vacant* is the housekeeping gap — if vacant is 6 but
only 2 are ready, housekeeping has 4 units of work before tonight's arrivals.

## 4. The three stay tables

Same three lists as the front-desk page, but as **tables with money and
checklist columns**. On phones they collapse into cards; on desktop and
paper they're tables.

### Arrivals

Columns: Guest (name, code, phone) · Room (unit + type) · Pax · Stay (nights)
· Status · **Owes** · **In** (✓ tick).

- **Owes** shows what the guest still owes *right now* — collect it at
  check-in. A red figure here is your cue before handing over keys.
- **In** ticks when the guest is checked in (or completed).
- A status like *"Confirmed · due 28 Oct"* in amber means a **late arrival**
  — expected on an earlier date and still coming. Call them.

### Departures

Columns: Guest · Room · Status · **Owes** · **Settled** (✓) · **Keys** (✓).

Your checkout checklist in columns: **Owes** must be ☐→collected (settle the
folio first), **Settled** ticks when balance is zero and status is completed,
**Keys** ticks on completion (keys back). Don't tick mentally — the system
ticks when the underlying state is true.

### In house

Columns: Guest · Room · Pax · **Night X of Y** · Owes.

*Night 2 of 3* tells you where each stay is in its arc — useful for
mid-stay service (e.g. offer the restaurant on night 2) and for spotting
tomorrow's departures early.

## 5. Room status

A grid of **every physical unit**: unit number, status
(**Vacant / Occupied / Reserved / Cleaning / Maintenance / Out of order**),
the housekeeping state when it isn't inspected (red *Dirty*, blue *Clean*),
and the occupant's name when occupied.

**How to use it.** This is the map of your building. Before promising a
room to a walk-in, glance here — not at your memory. *Reserved* vs *Vacant*
is the distinction that prevents double-selling: reserved units are spoken
for. *Maintenance/Out of order* units are removed from sale entirely.

**Where it comes from.** The same unit records as the Housekeeping board —
one field, two views, always in agreement.

## 6. Money due

Every stay on this sheet that **still owes money**, with a total at the
bottom (reports permission only).

**Critical reading note:** the balance **includes room nights still to
post**. A guest on night 1 of 3 "owes" the full stay value even though only
one night has been charged so far — because the sheet answers "what will we
collect?", not "what have we charged?". Don't alarm a guest with this
number; it's an internal collection forecast. Collect what's actually due
*now* (tonight's charges, extras) per the folio.

**What to do.** Work this list like the arrivals list: anything owed by a
departing guest must be settled *before* checkout. For in-house guests, note
it and collect at the natural moment (or at checkout at the latest).

## 7. Notes and reminders

The shift's shared notebook.

- **Add note** (up to 500 characters): write it, pick **who it's for**
  (Everyone, Front Desk, Housekeeping, Kitchen, Storekeeper, Manager), and
  optionally tick **"Carry over until done"**.
- A **carried note reappears every day** until someone marks it done — use
  it for multi-day follow-ups ("AC in 204 still noisy — technician coming
  Thursday"), not for today's trivia.
- Each note shows who wrote it and, for carried notes, which day it came
  from.
- **Mark done** when it's handled. Done notes stay visible, struck through —
  the history matters at handover.
- Notes need the *create* permission for front desk, and **can't be added to
  past days** (history stays history).
- On the **printed** sheet you get blank ruled lines for handwriting —
  the paper briefing still works when the power doesn't.

**Discipline:** one note per fact, assigned to a role, carried only if it
spans days. A notes section with 30 stale uncarried notes is a wall nobody
reads — mark things done.

## 8. Printing

The **Print** button produces the A4 briefing pack: black-and-white safe,
each section kept together, table headers repeated on every page, and a
*"Printed \{when} by \{name}"* line for accountability. Print it for the
morning briefing and pin it at the desk — it's the day's contract.

## 9. Daily routine with the sheet

**Morning briefing (manager + front desk, 10 minutes, printed sheet in
hand):** owner summary → at-a-glance → arrivals needing rooms → money due
on departures → notes carried over. Assign every open item to a name.

**During the day:** work arrivals, departures, and money-due; add notes as
things come up.

**End of day:** departures settled, cash drawer reconciled (Cash page),
notes triaged (done or carried), handover written.

## 10. Troubleshooting

| Symptom | Check first |
|---|---|
| Sheet shows the wrong date | Use the date navigator; confirm the business day (audit may not have closed yet). |
| Past sheet lets me do nothing | Correct — past days are read-only by design. |
| Balances on a past sheet look "current" | They are — balances always show what's owed *now*. |
| Owner summary says "Not closed yet" | Night audit hasn't run for yesterday; figures pending. |
| Can't add a note | Need front-desk *create* permission; can't add to past days. |
| A note I need keeps disappearing | It wasn't set to carry over — re-add it with carry-over ticked. |
| Money-due total shocks you | It includes unposted future nights — it's a forecast, not today's collection target. |

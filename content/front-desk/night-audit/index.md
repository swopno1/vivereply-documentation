# Night Audit — Staff Training Module

**Page:** `/admin/front-desk/night-audit` — closing the business day.
**Audience:** managers and owners (running it needs approval permission);
  front-desk staff should read it to understand what happens overnight.
**Time to complete:** about 25 minutes.
**Prerequisite:** the Front Desk and Daily Sheet modules.

## Learning objectives

After this module you can:

- Explain what "closing the day" actually does (it's far more than changing
  the date).
- Work the pre-close checklist: undecided arrivals, overstays, verifications,
  open orders, open cash shifts, dirty rooms.
- Decide KEEP vs NO-SHOW correctly — and understand what each choice costs.
- Run the close (if authorized), and know why it's irreversible.
- Read the recent-days history and what each line proves.

## 1. What the night audit is

Once a day — normally around **04:00 property time**, automatically, or
manually from this page — the system **closes the business day**:

1. Tonight's room charges are **posted** to every in-house folio (the guests'
   bills grow by one night each).
2. The **business date advances** by one day — the entire system (dashboard,
   sheets, arrivals) moves to the new day.
3. A **day summary** is written: occupancy, room revenue, collected cash,
   and anything left unresolved. This summary is what the daily sheet's
   *Owner summary* reads — it is not recomputed later.

The page header reminds you: *"The business date moves only when the day is
closed. If nobody closes it, it closes automatically at 04:00 the next
morning."*

**Who can run it.** Viewing needs front-desk view permission; **running the
close needs approval permission** (manager/owner). If you only see the page
with a *"View only"* notice, that's correct for your role — read on anyway,
because the checklist explains what the night auditor will ask you for.

## 2. Before the close — the checklist

The page walks you through every loose end, in order. Work them top to
bottom; the Close button stays disabled until they're resolved.

### 2.1 Arrivals that didn't check in

Every booking due today that never arrived. For each one you must decide —
there is no "decide later":

- **Keep (arriving late)** — the guest is still coming (you called; they
  confirmed). The booking stays, flagged as kept for tonight.
- **Mark no-show** — the guest isn't coming. **This releases the room**
  back to sale **and keeps any payment** already taken. A confirmation
  dialog makes you say it deliberately, because it's irreversible in
  effect: the unit goes back on sale immediately.

**How to decide.** Call the guest. No answer after reasonable attempts +
no prepayment → no-show. Prepayment + no contact → keep one more night only
if policy allows, else no-show (payment kept per policy). When in doubt,
**keep** — selling a kept room twice is worse than holding it one night.

### 2.2 In house past check-out (overstays)

Guests still checked in past their check-out date. Either **check them out**
(record it properly) or **ask a manager to extend the booking** (so charges
keep posting). Never leave an overstay undecided — it blocks the unit and
corrupts occupancy.

### 2.3 Warning banners

Before closing, the page flags anything else open:

- **BanglaQR payments waiting for verification** — verify or leave for the
  morning; the count carries into the summary either way.
- **Open room-service orders** — close or hand over; link to room service.
- **Open cash shifts** — a shift left open overnight lands here; close it or
  hand it over.
- **Dirty rooms** — still-dirty count; stayover rooms are added to the
  cleaning queue automatically when the day closes.

### 2.4 Room charges to post

The preview of what closing will charge: per guest and unit, the nights
being posted and the total. **Read it.** If a charge looks wrong (wrong
rate, wrong nights), fix the booking *before* closing — posted charges are
the books.

## 3. Running the close

When the day is over and every arrival is decided, the **Close \{date}**
button enables. It asks for confirmation — *"Room charges are posted and
the business date moves to the next day. This can't be undone."* — and then:

1. Posts all room charges,
2. Writes the day summary,
3. Advances the business date.

On success the page confirms: *"Closed. The business date is now \{date}."*

**Why it can't be undone.** Reopening a closed day would mean un-posting
charges guests may already have seen on folios. The design choice is
deliberate: decide carefully *before* closing, not after.

**If the automatic close already ran** (04:00), you'll find the day closed
with *"the automatic 04:00 close"* as the closer — review its summary in
the history below rather than re-closing.

## 4. Recent days (history)

The last 7 closed days, each line showing:

- The date and **who closed it** (a name, or *the automatic 04:00 close*),
- **Occupancy**, **room revenue**, **collected** for that day,
- Anything **left unresolved**, in amber.

**How to use it.** This is the property's diary. A day with unresolved
items deserves a follow-up the next morning. Compare collected vs. room
revenue across days to feel the prepayment rhythm (collected leads, revenue
follows). Auditors start here.

## 5. How the close connects to everything else

- **Dashboard & sheets** move to the new business day instantly.
- **Room charges** appear on folios → feed ADR/RevPAR (earned revenue).
- The **day summary** feeds the daily sheet's Owner summary and the
  *unresolved at last close* row.
- **Dirty stayover rooms** join the housekeeping queue.
- Undecided arrivals the audit *kept* appear on the next day's front-desk
  arrivals as late arrivals.

## 6. Troubleshooting

| Symptom | Check first |
|---|---|
| Close button disabled | Either the day isn't over yet, or arrivals still need decisions — the page tells you which. |
| "That day is already closed" | Someone (or the 04:00 auto-close) beat you to it — refresh. |
| Business day seems stuck | The auto-close may have failed; check `/admin/system` job heartbeats, then run the close manually (if authorized) or escalate. |
| Charges posted wrong | Fix the booking *before* closing; after close, corrections go through finance as adjustments, not edits. |
| "View only" notice | Your role can't run the close — that's intentional. Flag issues to a manager. |

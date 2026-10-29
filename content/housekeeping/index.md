# Housekeeping — Staff Training Module

**Page:** `/admin/housekeeping` — the room-cleaning board.
**Audience:** housekeeping staff (primary), managers, front desk.
**Time to complete:** about 25 minutes reading, then one supervised shift.
**Prerequisite:** none (but read the Front Desk module for context).

## Learning objectives

After this module you can:

- Explain the three room states and the exact rules for moving between them.
- Work the board in priority order: arrivals first, then checkouts, then
  stayovers.
- Mark rooms clean and dirty correctly — and know when a note is required.
- Understand the manager's inspection step and what a fail means.
- Use housekeeping notes and the carry-over discipline.

## 1. What the board is

One card per room, phone-first with large buttons, showing every unit's
cleanliness state and what needs doing. It **refreshes itself every minute**
while on screen, so phones on different floors see each other's work.

The header always shows the **business date** and the three numbers that
run the department: **\{dirty} dirty · \{clean} awaiting inspection ·
\{ready} ready**.

**Permissions.** Viewing needs housekeeping-view permission. *Marking clean
or dirty* needs the edit permission (housekeeping staff). *Passing or
failing an inspection* needs the approve permission (manager). Adding notes
needs the create permission. If you only see the board without buttons,
that's correct for your role.

## 2. The three states — the heart of the module

Every room is always in exactly one state:

| State | Meaning | Colour |
|---|---|---|
| **Dirty** | Needs cleaning | red |
| **Clean** | Cleaned, waiting for a manager's inspection | blue |
| **Inspected** | Passed inspection — ready for a guest | green |

**The moves (owner decision, 2026-10-07):**

- **Checkout** makes a room Dirty — automatically, every time.
- Housekeeping **marks it Clean** when done (Dirty → Clean).
- A manager **passes the inspection** (Clean → Inspected). Only then is the
  room sell-ready.
- A manager **fails the inspection** → back to Dirty, **and must write why**
  — housekeeping sees the reason.
- Housekeeping can **mark a room dirty again** from Clean or Inspected (it
  happens: a guest visits before check-in, a spill) — with an optional
  reason.

**Two rules to internalize:**

1. **Check-in never blocks on cleanliness.** If front desk checks a guest
   into a non-inspected room, they get a warning ("Room \{unit} is \{state}
   and hasn't been inspected. Check the guest in anyway?") — never a hard
   stop. Your job is to make that warning rare.
2. **Occupied rooms are never inspected.** Inspection is for empty rooms
   about to receive a guest; an occupied room is *serviced*, not inspected.

**Conflict handling.** If two people touch the same room, the second gets
*"Someone else changed this room. The board has been refreshed."* — the
system keeps the first change and shows you the truth. Just re-do your
action on the fresh state.

## 3. Working the board in priority order

The **To clean** section is ordered for you — work top to bottom:

1. **Rooms with a guest arriving today** (tagged *Arrival today*) — these
   have a deadline: check-in time.
2. **Rooms guests have left** (tagged *Guest left*) — tomorrow's arrivals
   depend on these.
3. **Stayovers** (tagged *Stayover*) — occupied rooms being serviced during
   the guest's stay.

**Reading a room card:** unit number, room type · floor · block, the state
badge, tags telling you the occupancy story (*Leaving today*, *Vacant*,
*Stayover*…), *"Dirty since \{time} by \{name}"* (who did what, when — the
audit trail), then your action buttons.

**The other sections:**

- **Awaiting inspection** — cleaned and *empty*. A manager inspects each
  before the next guest. (Housekeeping: your work is done here; the ball is
  with the manager.)
- **Ready** — inspected and empty. Collapsed by default; this is the
  front desk's selling pool.
- **Occupied, serviced** — in-house rooms already serviced (collapsed,
  informational).
- **Out of service** — maintenance or out-of-order units. **Clean them as
  usual**; they simply can't be booked until back in service.

## 4. The inspection step (managers)

Inspection exists because a tired cleaner's "done" and a guest's "clean"
are different standards. For each room in *Awaiting inspection*:

- **Pass inspection** → Inspected. The room joins the ready pool.
- **Fail inspection** → back to Dirty, **with a written reason** (required).
  The reason goes to housekeeping — write it so they can fix it: *"dust on
  the bathroom shelf"* beats *"not clean enough"*.

A fail is feedback, not punishment. A pattern of fails on one room or one
shift is a training signal — escalate it to the manager, don't just
re-clean silently.

## 5. Notes for housekeeping

Same notebook pattern as the daily sheet's notes: up to 500 characters,
addressed to **Front desk / Manager / Everyone**, with **carry-over until
done**. Carried notes show which date they came from (*"From 28 Oct"*).
Mark done when handled.

Front desk uses this to tell you things like *"Room 104 AC is leaking"*;
use it to tell them *"204's TV remote missing — replacement ordered"*.

## 6. How housekeeping connects to everything else

- **Front desk readiness badges** (red/blue/green on stay cards) read this
  board — your state is their check-in confidence.
- The **daily sheet's** *"N empty and ready"* count and the **front-desk
  page's** ready-unit count come from here.
- Dirty rooms appear on the **night-audit checklist**; stayover rooms join
  the cleaning queue automatically at day close.
- The state + who + when on each card is the **audit trail** — it settles
  every "was this room cleaned?" argument.

## 7. Daily routine

**Morning:** open the board, read the counts, work *To clean* top-down
(arrivals first). **Midday:** re-check — new checkouts land here
automatically. **Before arrivals:** confirm every *Arrival today* room is
Inspected. **End of shift:** nothing in *To clean* tagged *Arrival today*
should still be Dirty — hand over the rest with a note.

## 8. Troubleshooting

| Symptom | Check first |
|---|---|
| Buttons missing on a room | Your role lacks the permission (edit for clean/dirty, approve for inspection). |
| "Someone else changed this room" | A colleague acted first — the board refreshed; redo your action. |
| A room won't offer "Pass inspection" | It's occupied (never inspected) or not in Clean state. |
| Fail inspection won't save | A reason is required — the prompt can't be left empty. |
| Arrival rooms still dirty near check-in | Escalate to the manager immediately — don't silently hope. |

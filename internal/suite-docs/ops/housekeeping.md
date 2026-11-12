# Housekeeping — how it works

Date: 2026-10-29. Branch: `client/demo1`. Page: `/admin/housekeeping`.
Spec: `docs/rms/phase-b2/01-HOUSEKEEPING.md`. Code: `src/lib/housekeeping/`,
`src/app/admin/housekeeping/`, `src/app/actions/housekeeping-actions.ts`.

## 1. The model: two different "statuses"

Every room unit carries **two** independent statuses:

| | Operational status (`status`) | Cleanliness (`housekeeping`) |
|---|---|---|
| Values | Available, Occupied, Reserved, Maintenance, Out of order | **Dirty, Clean, Inspected** |
| Answers | Can the room be sold? | Is it ready for the next guest? |
| Changed by | Rooms admin, check-in/out | Housekeeping, managers, check-out, night audit |

The board only tracks cleanliness, and only while the `housekeeping` module
flag is on. With the module off, nothing changes cleanliness and check-in
doesn't warn — otherwise rooms would turn dirty with nobody able to clean
them.

## 2. The state machine

Owner decision (2026-10-07): **check-out makes a room Dirty, housekeeping
marks it Clean, a manager marks it Inspected.** Only `INSPECTED` is "ready"
for a new guest.

```
DIRTY ──(Mark clean, HOUSEKEEPING.edit)──> CLEAN ──(Pass inspection, HOUSEKEEPING.approve)──> INSPECTED
  ^                                          │  (Fail inspection, approve, note required)
  │                                          v
  └──────(Mark dirty, edit, optional note)── DIRTY <──(Fail inspection)── CLEAN
INSPECTED ──(Mark dirty, edit)──> DIRTY
```

**Automatic moves** (no human taps a button):

| Trigger | From | To | Recorded |
|---|---|---|---|
| Check-out (or an in-house stay cancelled) | Clean, Inspected | Dirty | booking log + audit row |
| Night-audit close: stayover service | Clean, Inspected | Dirty | `stayoversMarkedDirty` in `NIGHT_AUDIT_CLOSED` |

**Manual moves** (`setHousekeepingAction`): each names the state the screen
showed (`expected`). The unit row is locked and the move applies only if the
room is still in that state — otherwise the result is `stale` and nothing
changes, so two phones marking the same room can't overwrite each other.
Every manual move also writes a `HOUSEKEEPING_STATUS_CHANGED` audit row, and
every change (manual or automatic) writes an append-only `HousekeepingEvent`
(from, to, reason, booking, note, business date, who).

**Roles:** `HOUSEKEEPING.edit` (Owner, Manager, Housekeeping) does cleaning
work; `HOUSEKEEPING.approve` (Owner, Manager) does inspections. Front Desk
and Auditor see the board read-only.

## 3. Awaiting inspection — the deep dive

**What it is.** The board section `awaitingInspection` lists rooms where
`housekeeping = CLEAN` **and the room is vacant** (`!occupied`). In plain
terms: housekeeping has finished cleaning, and the room now waits for a
manager/owner to walk in and verify before it can take the next guest.

**Why only vacant rooms.** An occupied room is cleaned to Clean and stays
there — it is never inspected while a guest is in it. Inspection matters
before a *new* guest, and check-out makes the room Dirty again anyway. An
occupied Clean room appears under "Occupied, serviced" instead, with no
inspection buttons offered.

**Ordering.** Rooms sort by urgency: an arrival waiting on an empty room
first, then empty rooms (guest left), then guests leaving today, then
stayovers; ties break by room type and unit number. The room the next guest
needs is always at the top.

**What the inspector can do** (only with `HOUSEKEEPING.approve`):

| Button | Effect | Note |
|---|---|---|
| Pass inspection | Clean → **Inspected** (room becomes ready) | not required |
| Fail inspection | Clean → **Dirty** (back to the clean queue) | **required** (min 3 chars) — housekeeping sees *why* it failed |
| Mark dirty | Clean/Inspected → **Dirty** | optional (prompted) |

Failing asks for the reason up front (`window.prompt`); the note is stored on
the event so the housekeeper sees exactly what to fix ("Mirror smudged").
Passing needs no note — it's the happy path and stays one tap.

**What the viewer sees on each card:** unit number, room type · floor · block,
the state pill (sky-blue "Clean"), context tags (Arrival today / Guest left /
Leaving today / Stayover / Vacant), "Clean since {time} · by {name}", and the
action buttons. Viewers *without* approve permission see the same section
with an extra hint that inspection needs a manager — the work is visible to
everyone, the decision stays with the role.

**After the decision:** the room leaves Awaiting inspection immediately —
to "Ready" (Inspected, collapsed list) on a pass, or back to "To clean"
(Dirty) on a fail. The header counts (`dirty / clean / ready`) update, the
front desk sees the new state on arrivals, and the daily sheet's "vacant and
ready" figure moves.

## 4. UI/UX: the board

**Phone-first.** One card per room, full-width buttons with 44px minimum tap
targets — it is designed to be used by housekeepers on phones, walking the
corridors. On larger screens cards flow into 2–3 columns.

**Sections, top to bottom:**

| Section | Contents | Presentation |
|---|---|---|
| Header | Title, business date, counts (dirty / awaiting / ready), Refresh button | always visible |
| Notes for housekeeping | Daily notes addressed to Housekeeping, incl. carried-over | list; tick off with `HOUSEKEEPING.edit` |
| To clean | Dirty, in service | full cards, urgency order |
| **Awaiting inspection** | **Clean and vacant** | **full cards, urgency order** |
| Ready | Inspected and vacant | collapsed, one line per room |
| Occupied, serviced | Clean/Inspected with a guest in | collapsed (only if non-empty) |
| Out of service | Maintenance / out of order, any cleanliness | full cards (only if non-empty) |
| Leave a note | Free-text note for front desk / manager, optional carry-over | form at the bottom |

**Privacy by design:** no guest names, phone numbers, or money anywhere on
the board — tags say "Arrival today", "Guest left", "Leaving today",
"Stayover". Housekeeping sees rooms, not guests.

**Live collaboration:** the board re-fetches every 60 seconds while visible,
so several phones see each other's work, plus a manual Refresh button. The
`expected`-state guard (§2) makes concurrent taps safe.

**Feedback:** every action shows an inline success/error message; failures
(fail inspection without a note, stale room) explain themselves in plain
language, in English and Bengali.

## 5. How it connects to the rest of the PMS

- **Front desk:** each not-yet-checked-in arrival shows its room's
  cleanliness, with a Housekeeping link next to the daily-sheet and
  night-audit links.
- **Check-in:** checking a guest into a room that isn't Inspected shows a
  warning — "Room 101 is Dirty and hasn't been inspected. Check the guest in
  anyway?" Confirming checks in and notes it in the booking log; cancelling
  changes nothing. It **never blocks**, per the owner's decision.
- **Daily sheet:** the room grid shows Dirty/Clean (Inspected is the quiet
  default); "Vacant tonight" adds "N empty and ready" (in service, vacant,
  Inspected).
- **Night audit:** shows "Rooms still dirty: N" (the board's To-clean count,
  in-service rooms only) with a link to the board, and marks stayovers dirty
  at close.

## 6. Where to look in code

- `src/lib/housekeeping/status.ts` — the move table (client-safe, no server imports)
- `src/lib/housekeeping/housekeeping.ts` — `changeHousekeeping()` (row lock,
  conditional move, history), `markVacatedDirty()`
- `src/lib/housekeeping/board.ts` — `loadHousekeepingBoard()` (grouping, urgency, tags)
- `src/app/actions/housekeeping-actions.ts` — `setHousekeepingAction`,
  `addHousekeepingNoteAction`, `markHousekeepingNoteDoneAction`
- `src/app/admin/housekeeping/HousekeepingView.tsx` — the board UI

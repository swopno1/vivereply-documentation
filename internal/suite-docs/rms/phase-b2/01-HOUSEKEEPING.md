# Phase B2 §1–2: housekeeping

## 1. Room readiness

Each room unit now has a **cleanliness** status, `RoomUnit.housekeeping`. It is separate from the operational status:

| | Operational status (`status`, Phase A2) | Cleanliness (`housekeeping`, B2) |
|---|---|---|
| Values | Available, Occupied, Reserved, Maintenance, Out of order (Cleaning is legacy) | Dirty, Clean, Inspected |
| Answers | Can the room be sold? | Is it ready for the next guest? |
| Changed by | Rooms admin, check-in/out | Housekeeping, managers, check-out, night audit |

The migration (`20261009100000_housekeeping`) is additive:
- New rooms and existing rooms start as **Inspected**.
- Units someone had set to the old manual `CLEANING` status start as **Dirty**, with a `MIGRATION` history row. `CLEANING` is no longer offered in the unit status picker; a unit still in it keeps showing it.

### Moves

Owner decision (2026-10-07): **Dirty, then inspect.**

| Move | From | To | Who | Note |
|---|---|---|---|---|
| Check-out (or a stay in house cancelled) | Clean, Inspected | Dirty | automatic | |
| Night audit close: stayover service | Clean, Inspected | Dirty | automatic | Guests still in house after the next morning. Guests leaving the next day are made dirty at check-out. |
| Mark clean | Dirty | Clean | `HOUSEKEEPING.edit` (OWNER, MANAGER, HOUSEKEEPING) | |
| Mark dirty | Clean, Inspected | Dirty | `HOUSEKEEPING.edit` | optional |
| Pass inspection | Clean | Inspected | `HOUSEKEEPING.approve` (OWNER, MANAGER) | |
| Fail inspection | Clean | Dirty | `HOUSEKEEPING.approve` | required: housekeeping sees why |

- **Occupied rooms:** a room in use is cleaned to Clean and stays there; it isn't inspected while the guest is in. Inspection matters before a *new* guest, and check-out makes the room Dirty again anyway.
- **Stale screens:** every manual move names the state the screen showed (`expected`). The unit row is locked, and the move applies only if the room is still in that state; otherwise the result is `stale` and nothing changes. Two phones marking the same room can't overwrite each other.
- **History:** each change writes a `HousekeepingEvent` row (from, to, reason, booking, note, business date, who). A trigger makes the table append-only.
- **Audit:** manual moves also write `HOUSEKEEPING_STATUS_CHANGED` to the audit log. Automatic moves are recorded:
  - at check-out, in the booking's own log and audit row;
  - at the night audit, as `stayoversMarkedDirty` in `NIGHT_AUDIT_CLOSED`.

### Check-in

Checking a guest in to a room that isn't Inspected returns a warning (`code: "unit_not_ready"`) instead of checking in. The desk sees "Room 101 is Dirty and hasn't been inspected. Check the guest in anyway?"
- **Confirm:** the check-in goes ahead, and the booking log notes `checked in to unit 101 while DIRTY`.
- **Cancel:** nothing changes.

It never blocks, per the owner's decision.

### When the module is off

Cleanliness is tracked only while the `housekeeping` module flag is on. With it off:
- check-out and the night audit don't change cleanliness;
- check-in doesn't warn.

Otherwise rooms would turn dirty with nobody able to mark them clean. Rooms keep whatever state they had when the module was switched off.

### Code

- `src/lib/housekeeping/status.ts`: the moves (client-safe).
- `src/lib/housekeeping/housekeeping.ts`: `changeHousekeeping()` (row lock, conditional move, history row) and `markVacatedDirty()`.
- `src/app/actions/housekeeping-actions.ts`: `setHousekeepingAction`, `addHousekeepingNoteAction`, `markHousekeepingNoteDoneAction`.
- Hooks:
  - `updateBookingStatus`: check-in warning, check-out.
  - `cancelBookingWithRefundDecision`: a stay in house cancelled.
  - `closeBusinessDay`: stayovers.

### Tests

**`src/lib/housekeeping/housekeeping.db.test.ts`:**
- check-out makes the room Dirty;
- the check-in warning and acknowledgement;
- the clean → fail → clean → inspect cycle, with each role's permissions;
- stale moves;
- the append-only history;
- housekeeping notes.

**`src/lib/housekeeping/status.test.ts`:** the move table.

**`src/lib/night-audit/audit.db.test.ts`:** the stayover marking (stayover only, not a departure or an arrival).

**`permission-enforcement.test.ts`:** the four new actions × every role.

## 2. The housekeeping board

**Page:** `/admin/housekeeping`.
- **Access:** `HOUSEKEEPING.view`, and the `housekeeping` module flag.
- **Sidebar:** the item "Housekeeping" comes right after Front Desk. HOUSEKEEPING users now land on it; they landed on Rooms before.
- **Date:** the board is for the business date.
- **Phone-first:** one card per room, with full-width 44px buttons.
- **Refresh:** every 60 seconds while it is on screen, so several phones see each other's work. There is also a Refresh button.

| Section | Rooms | Order |
|---|---|---|
| Notes for housekeeping | Daily notes addressed to Housekeeping, carried notes included | by date |
| To clean | Dirty, in service | a guest arriving (on an empty room) → empty rooms (guest left) → guests leaving today → stayovers |
| Awaiting inspection | Clean and empty | the same |
| Ready | Inspected and empty | the same. **Collapsed list**, one line per room |
| Occupied, serviced | Clean or inspected with a guest in | room type, number. **Collapsed list** |
| Out of service | Maintenance or out of order, any cleanliness | room type, number |
| Leave a note | Form at the bottom | |

- **No guest details:** the board shows no guest names, phone numbers or money; tags say "Arrival today", "Guest left", "Leaving today" or "Stayover".
- **Buttons:** each room offers only the moves its state and the viewer's role allow. Occupied rooms are never offered an inspection.
- **Read-only viewers:** FRONT_DESK and AUDITOR see the board without buttons.

### Notes (limitation L1 of Phase B)

Housekeeping can now:
- **Read** the notes addressed to it, which are written on the daily sheet;
- **Tick them off:** `HOUSEKEEPING.edit`, and only notes addressed to Housekeeping;
- **Leave a note** for the front desk, a manager or everyone: `HOUSEKEEPING.create`. It appears on that day's daily sheet.

### Elsewhere

These show only while the housekeeping module is on.

- **Front Desk:** each arrival not yet checked in shows its room's cleanliness, and a "Housekeeping" link sits next to the daily sheet and night audit links.
- **Daily sheet:**
  - The room grid shows Dirty or Clean (Inspected is the quiet default).
  - The "Vacant tonight" figure adds "N empty and ready" (in service, no guest in, Inspected).
- **Night audit:** "Rooms still dirty: N" (in service; the board's To clean count), as information, with a link to the board.

### Live check (production build, scratch DB, 360px)

| As | Checked |
|---|---|
| HOUSEKEEPING | Lands on the board. Marked an arrival's room clean, and it moved to Awaiting inspection. No inspection buttons. Every tap target ≥ 44px; `scrollWidth` 345. Page height 2,578px with 39 rooms, against 7,884px before the Ready list was collapsed. |
| MANAGER | Failed an inspection with the note "Mirror smudged" (back to Dirty), then passed another (Inspected). The history rows name the right user, reason and note. The board in Bengali has no overflow. |
| FRONT_DESK (Bengali) | The arrival card shows "অপরিষ্কার" for its room. Check-in showed the warning "রুম SMSC-4 এখন অপরিষ্কার, পরিদর্শন হয়নি…"; confirming checked the guest in, and the booking log reads `checked in to unit SMSC-4 while DIRTY`. The daily sheet shows "৩৪টি খালি ও প্রস্তুত" and the dirty rooms in its grid. The night audit shows the dirty count. |
| AUDITOR | The board renders with only the Refresh button and no form. |

**Fix found live:** the night audit counted a dirty room under maintenance, while the board's To clean list doesn't. Both now count rooms in service only.

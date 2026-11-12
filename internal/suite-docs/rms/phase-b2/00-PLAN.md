# Phase B2: housekeeping and shift cash close

Branch `phase-b2-housekeeping-cash`, from `main` at `1a90110` (Phase B merged).

Phase B2 finishes the Phase B roadmap:
- the `HOUSEKEEPING` module (01-ROLES-AND-PERMISSIONS.md lists it as Phase B);
- the shift cash close (limitation L2 of `phase-b/05-VERIFICATION.md`).

Room service (Phase C) comes after.

The Phase A2/B rules still apply:
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
| Scope | Housekeeping, then cash close. |
| Room after check-out | **Dirty, then inspect.** Check-out makes the room Dirty. Housekeeping marks it Clean, and a manager marks it Inspected before the next guest. Check-in **warns** about a room that isn't inspected, and never blocks. |
| Cash shift | **Per person, blind count.** Each desk user opens a shift with a starting float. At the end they count the cash without seeing the expected amount. Any difference needs a manager's sign-off with a reason. |

## Permissions (no matrix change)

| Action | Grant | Roles |
|---|---|---|
| See the housekeeping board | `HOUSEKEEPING.view` | OWNER, MANAGER, FRONT_DESK, HOUSEKEEPING, AUDITOR (read-only) |
| Mark a room Clean or Dirty, add or tick off a housekeeping note | `HOUSEKEEPING.edit` / `.create` | OWNER, MANAGER, HOUSEKEEPING |
| Inspect a room (pass, or fail back to Dirty) | `HOUSEKEEPING.approve` | OWNER, MANAGER |
| Open and close your own cash shift | `FRONT_DESK.create` | OWNER, MANAGER, FRONT_DESK |
| See every shift, close someone else's, sign off a difference | `FRONT_DESK.approve` | OWNER, MANAGER |
| See every shift (read-only) | `REPORTS.view` | OWNER, MANAGER, AUDITOR, ACCOUNTANT |

The housekeeping screens need the `housekeeping` module flag; the cash screens need `frontDesk`.

## Sections

**§1 Room readiness.**
- **Schema:** a new `RoomUnit.housekeeping` column (`DIRTY` | `CLEAN` | `INSPECTED`), additive. It defaults to `INSPECTED`, so existing rooms stay ready.
  - It is separate from the operational status (available, maintenance, out of order), which is unchanged.
  - Units in the old manual `CLEANING` status start as `DIRTY`. `CLEANING` is no longer offered in the unit status picker.
- **History:** a `HousekeepingEvent` row records each change (from, to, why, who, business date).
- **Automatic changes:**
  - **Check-out**, or cancelling a stay that was checked in, makes the room Dirty.
  - **Night audit close** makes every stayover room Dirty for its daily service. A stayover is a guest in house past the next morning; guests leaving the next day are made Dirty at check-out instead.
- **Manual changes:**
  - Clean ⇐ Dirty: `HOUSEKEEPING.edit`.
  - Dirty ⇐ Clean or Inspected: `HOUSEKEEPING.edit`, with an optional note.
  - Inspected ⇐ Clean: `HOUSEKEEPING.approve`. A failed inspection sends the room back to Dirty, and a note is required.
  - **Stale screens:** each change only applies if the room is still in the state the screen showed, so two phones can't overwrite each other.
- **Check-in:** a room that isn't Inspected returns a warning. The desk confirms and the check-in goes ahead; the booking log records it.

**§2 Housekeeping board.**
- **Page:** `/admin/housekeeping`, phone-first, for the business date:
  - **To clean:** rooms with an arrival today first, then departures, then stayovers.
  - **Awaiting inspection:** empty rooms that are Clean.
  - **Ready:** Inspected rooms.
  - **Out of service:** rooms in maintenance or out of order, shown apart.
- **Notes:** daily notes aimed at Housekeeping (limitation L1 of `phase-b/05-VERIFICATION.md`). Housekeeping can read them, tick them off, and add notes for the desk.
- **Navigation:** a sidebar item gated by `HOUSEKEEPING.view` and the `housekeeping` flag. HOUSEKEEPING users land on the board.
- **Elsewhere:**
  - The daily sheet's room grid and its "vacant and ready" count.
  - The Front Desk arrivals list, which shows each room's readiness.
  - The night audit, which shows how many rooms are still dirty.

**§3 Cash shifts.**
- **Schema:**
  - `CashShift` table: user, business date, opened at, opening float, counted, count by note, expected, difference, status (`OPEN`, `CLOSED`, `NEEDS_REVIEW`, `REVIEWED`), plus close and review notes.
  - A partial unique index allows one open shift per person.
  - A trigger stops a closed shift's figures from changing.
- **Linking cash to shifts:** a new `FolioLine.cashShiftId` column.
  - Every cash payment or refund at the desk goes on the recording user's open shift.
  - **Without an open shift, cash is refused:** on the folio, at an offline sale, and for a refund at cancellation. A database check (`NOT VALID`, so old lines are untouched) and a trigger enforce the same rule.
  - A void goes on the original line's shift.
- **Expected cash** = opening float + cash payments − cash refunds, net of voids.
- **Close:**
  - The row is locked, so a payment can't slip in while the shift is closing.
  - The person counting never sees the expected amount before submitting.
  - A difference of zero closes the shift; any other difference goes to `NEEDS_REVIEW`.
  - A manager may close a shift someone left open, with a note.
- **Review:** `FRONT_DESK.approve`, with a reason. A manager can't sign off their own shift; the owner can.

**§4 Cash screens.**
- **Pages:**
  - `/admin/front-desk/cash`: your shift (open, or close with a count by note), your recent shifts and, for managers, every shift with differences to review.
  - `/admin/front-desk/cash/[id]`: the shift's cash lines, voids after close, and the sign-off.
- **Elsewhere:**
  - The folio says when a cash payment needs a shift.
  - The night audit lists open shifts as information.
  - The daily sheet's owner summary counts shifts awaiting sign-off.

**§5 Verification report.** Gates, live checks at 360px in EN and BN, and the limitations.

## Not in B2

- **Room moves** (changing the unit of a stay in house).
- **Housekeeper assignment** per room, and minibar counts.
- **Cash drawer handover chaining:** each shift declares its own float.
- **Bank deposits:** shifts, not the safe or bank.

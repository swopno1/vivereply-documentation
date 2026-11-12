# Phase B2 §5: verification report

Branch `phase-b2-housekeeping-cash`, from `main` at `1a90110` (Phase B merged).

| § | Commit | What |
|---|---|---|
| 1 | `0efa324` | Room readiness: Dirty / Clean / Inspected, automatic moves, check-in warning; plan (00-PLAN.md) |
| 2 | `b6957eb` | Housekeeping board, housekeeping notes, readiness on Front Desk, the daily sheet and the night audit |
| 3 | `0b824e4` | Cash shifts: schema, rules, cash on shifts everywhere desk cash is taken or paid out |
| 4 | `f36c4ca` | Cash screens: your shift, blind count, sign-off, shift detail |

## Summary

- **Housekeeping:**
  - Every room has a cleanliness status. Check-out makes it Dirty, and the night audit makes stayover rooms Dirty for daily service.
  - Housekeeping marks rooms Clean on a phone-first board (arrivals first). A manager inspects them.
  - Checking a guest in to a room that isn't inspected warns, and goes ahead when the desk confirms.
  - Housekeeping reads and ticks off its notes, and writes to the desk. This closes Phase B limitation L1.
- **Cash shifts:**
  - Every desk cash payment or refund goes on the recorder's open shift. Without a shift, cash is refused.
  - At the end the holder counts the drawer without seeing the expected amount.
  - Any difference waits for a manager's sign-off with a reason; nobody signs off their own shift except the owner.
  - This closes Phase B limitation L2.
- **Owner decisions applied (2026-10-07):**
  - housekeeping then cash close;
  - Dirty, then inspect, with check-in only warning;
  - per-person shifts with a blind count, every difference signed off.
- **Permission matrix:** unchanged. Every new action maps to an existing grant (00-PLAN.md). The sidebar gains "Housekeeping" (`HOUSEKEEPING.view`), and HOUSEKEEPING users land on it. `01-ROLES-AND-PERMISSIONS.md` §6 and its test are updated.
- **Module flags:** `housekeeping` is now a live module in Settings > Modules. With it off, cleanliness is frozen and check-in doesn't warn.
- **Migrations:** two, both additive: `20261009100000_housekeeping` and `20261009110000_cash_shift`.
  - They apply cleanly to a fresh `resort_test` and to `resort_dev`.
  - `prisma migrate diff` against the schema shows no drift.

## Gates (at `f36c4ca`)

| Gate | Result |
|---|---|
| `pnpm lint` (ESLint, guard scripts, money check) | 0 problems |
| i18n parity | OK (EN = BN keys) |
| `pnpm test` | 711 passed (590 DB tests skipped without a `*_test` DB) |
| Full suite on a fresh `resort_test` (`--no-file-parallelism`) | 1,300 passed, 1 skipped (the migrations check, which needs a shadow DB) |
| `pnpm test:db` | 226 passed |
| `pnpm build` | Clean. The new pages are dynamic (ƒ): `/admin/housekeeping`, `/admin/front-desk/cash`, `/admin/front-desk/cash/[id]`. Public pages are unchanged. |
| Gateway suites, each on a fresh `resort_test` (booking and refund actions were touched) | Nagad 255, SSLCommerz 334, bKash 157, BanglaQR 96: all passed |
| Live: production build, scratch DB, 360px | Housekeeping board as HOUSEKEEPING, MANAGER, FRONT_DESK and AUDITOR; cash as FRONT_DESK (EN) and MANAGER (BN). Details are in 01 §2 and 02 §6. |

New test files:
- `housekeeping/status.test.ts` (3)
- `housekeeping/housekeeping.db.test.ts` (5)
- `cash/constants.test.ts` (2)
- `cash/cash.db.test.ts` (8)

Updated test files:
- `night-audit/audit.db.test.ts`: stayover rooms are made dirty.
- `permission-enforcement.test.ts`: 7 new actions × every role.
- `permissions.test.ts` and `module-flags.test.ts`: the sidebar and landing pages.
- `modules.db.test.ts`: housekeeping is now live.
- `folio.db.test.ts`, `metrics.db.test.ts`, `room-units.db.test.ts`, `sheet.db.test.ts`: cash now needs a shift.

## Found and fixed during B2

| # | Problem | Fix |
|---|---|---|
| FB2-1 | The Ready list showed one large card per room, so the phone board was 7,884px tall with 39 rooms. | Ready and Occupied are collapsed one-line lists, and the note form moved below the rooms: 2,578px. |
| FB2-2 | The night audit's "rooms still dirty" counted a room under maintenance; the board doesn't. | Both count rooms in service only. |
| FB2-3 | A void racing a shift's close could be filed on the wrong side of the count: the line's timestamp was its transaction's start, while `closedAt` came from the app clock. | Voids on a shift are stamped with the database's `clock_timestamp()`, and the close takes `closedAt` from the same clock, under the shift's row lock. |
| FB2-4 | The folio's "no shift" message repeated its own link text; "1 cash transactions"; a blank line under an empty list. | Wording fixed. |

## Limitations and follow-ups

| # | Limitation |
|---|---|
| L1 | **No room moves.** A guest can't be moved to a clean room from the desk. A manager changes the unit through the booking edit. |
| L2 | **No housekeeper assignment** per room, no minibar count and no lost-and-found. The board is shared by everyone in housekeeping. |
| L3 | **Inspection is OWNER/MANAGER only**, because there is no supervisor role. With no manager on duty, rooms stay Clean, and check-in only warns. |
| L4 | **Stayover service is daily for every stayover.** There is no "do not disturb" or "guest declined service" flag yet; housekeeping marks such a room Clean. |
| L5 | **No drawer handover.** Each shift declares its own starting cash. Nothing links one shift's closing cash to the next shift's float, the safe or a bank deposit. |
| L6 | **Cash before B2 isn't on any shift.** Expected cash covers lines from B2 on. Desk cash taken outside the folio (none known) wouldn't be counted. |
| L7 | **Managers see other drawers' expected amounts** (oversight). The blind count applies to each holder's own shift, managers included. |
| L8 | **Zero tolerance.** Every difference, even ৳1, waits for a sign-off (owner decision). A tolerance setting can come later if this is noisy. |
| L9 | **A shift can span business dates.** The night audit lists open shifts but doesn't close them; each person counts at the end of their own shift. |
| L10 | **The board refreshes every 60 seconds**, with no push. Two phones see each other's work within a minute; a stale tap is refused (`stale`) and the board reloads. |
| L11 | **Carried over from Phase B L11:** the night-audit cron line must be in the server's crontab (docs/DEPLOYMENT.md). |
| L12 | **Pre-existing (Phase B L13):** the bKash audit test can flag a random token as a phone number. A matching row stays in `resort_test` until the database is recreated. This happened once during B2, and a fresh database passed. |

## Not merged

`main` is unchanged. The four feature commits and this report are on `phase-b2-housekeeping-cash` for the owner's review.

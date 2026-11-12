# Phase A2 §1 — RoomUnit migration

**Audience:** the owner deploying this change to a client VPS, and developers working on availability.
**Status:** implemented on `phase-a2-foundation` (Section 1 commit).

## What changes

Until now a `Room` was a room *type* with a counter, `availableUnits`. From Phase A2:
- each physical room is a `RoomUnit` row (`"CBOD-1"`, `"Villa A"`);
- each new booking is given one unit (`Booking.unitId`);
- availability is computed from those units and the bookings on them.

| | Before | After |
|---|---|---|
| Public booking API | Refused only when `availableUnits <= 0`, whatever the dates | Date-aware: refuses (409) when no unit is free for `[checkIn, checkOut)` |
| Offline booking, booking edit | Counted overlapping bookings against `availableUnits`, no lock | Picks a free unit inside the transaction; the database rejects any double-booking of a unit |
| Booking stepper | Asked for guest details, then failed at the last step if full | Checks the dates first (`GET /api/rooms/[roomId]/availability`) |
| Deleting a room type | Silently deleted its bookings and payments (`ON DELETE CASCADE`) | Refused while it has units or bookings (`RESTRICT`) |
| Room form | "Total Available Units" number | New room type: "Number of Units" (units are created). Existing room type: managed in the Units tab |

## Schema (additive, plus one constraint change)

- `enum RoomUnitStatus { AVAILABLE OCCUPIED RESERVED CLEANING MAINTENANCE OUT_OF_ORDER }`
- `model RoomUnit`:
  - `id` (uuid, like every other model; the brief said cuid);
  - `roomId → Room (RESTRICT)`;
  - `unitNumber` (unique per room type);
  - `floor`, `block`, `status`, `notes`;
  - `isActive`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy`, `archivedAt`.
- `Booking.unitId String?` (`→ RoomUnit`, RESTRICT) with an index. Bookings made before the migration keep `NULL`, because no unit can be inferred for them.
- `Booking.roomId` goes from **CASCADE to RESTRICT** (baseline N10). This is the only non-additive change: a foreign-key rule, not data. No application code deletes rooms. `prisma/seed.ts` now deletes units before rooms.
- The `HousekeepingTask` relation is left out, per adjustment A4. It arrives in Phase B.
- **Exclusion constraint `Booking_unit_no_overlap`** (raw SQL; it can't be expressed in `schema.prisma`):
  ```sql
  EXCLUDE USING gist ("unitId" WITH =, tsrange("checkInDate", "checkOutDate", '[)') WITH &&)
  WHERE ("unitId" IS NOT NULL AND "status" IN ('PENDING', 'CONFIRMED', 'CHECKED_IN'))
  -- FU-7 (migration 20261001170000) adds 'PENDING_MANUAL_VERIFICATION'
  ```
  PostgreSQL itself refuses two live bookings on one unit with overlapping stays. Stays are half-open, so a checkout and the next check-in on the same day don't conflict. The constraint needs the `btree_gist` extension. That extension is *trusted* from PostgreSQL 13 on, so the database owner can create it without superuser rights.
- `Room.availableUnits` is **kept for one release** (deprecated in a comment). See [Rollback](#rollback).

## The three migrations

| Migration | Does | Fails when |
|---|---|---|
| `20260930140000_add_room_unit_model` | Creates the enum, table, `Booking.unitId`, the foreign keys, `btree_gist` and the exclusion constraint | `btree_gist` can't be created (see below) |
| `20260930140100_seed_room_units_from_available_units` | Snapshots each room's `max(availableUnits, 0)` into `_room_unit_seed_snapshot`, then inserts that many units per room: `AVAILABLE`, numbered `<initials of slug words>-<n>` (`coxs-bazar-oceanfront-deluxe` → `CBOD-1 … CBOD-6`), `createdBy = 'system:migration'` | — |
| `20260930140200_verify_unit_count` | Compares seeded units per room with the **snapshot**, raises and aborts the deploy on any mismatch, then drops the snapshot table | Any room type has more or fewer seeded units than it should |

**Why a snapshot, not the live column:** `pnpm build` runs `migrate deploy` while the old release is still serving. A BanglaQR confirmation between migrations 2 and 3 decrements `availableUnits` (baseline N1). Comparing against the live column would then abort a correct deploy. Comparing against the snapshot doesn't.

## Before you deploy: confirm the unit counts

`availableUnits` has been a stock counter. Payment confirmations decrement it and nothing adds it back, so on a live site it can be **lower than the real number of rooms**. The seed trusts it, so check it first, **on the current release**:

```bash
pnpm exec tsx scripts/room-unit-preflight.ts
```

This is read-only. For each room type it prints:
- `availableUnits` and the units the seed would create;
- live bookings that have not ended;
- the most of those that overlap on one night.

It exits 1 when a room type needs attention:
- `NEGATIVE`;
- `ZERO_BUT_ACTIVE`;
- `PEAK_ABOVE_UNITS`: more overlapping bookings than units.

For every room type where `unitsToCreate` is not the real number of rooms, correct "Total Available Units" in `/admin/rooms/[id]` **before** deploying. After the migration, units are added or removed one at a time instead.

Output on the local dev data (`resort_dev`, 2026-10-01):

```
┌─────────┬──────────────────────────────────────┬────────┬────────────────┬───────────────┬──────────────────────┬────────────────────┬───────┐
│ (index) │ slug                                 │ active │ availableUnits │ unitsToCreate │ liveUpcomingBookings │ peakNightlyOverlap │ flags │
├─────────┼──────────────────────────────────────┼────────┼────────────────┼───────────────┼──────────────────────┼────────────────────┼───────┤
│ 0       │ 'coxs-bazar-oceanfront-deluxe'       │ true   │ 6              │ 6             │ 0                    │ 0                  │ '-'   │
│ 1       │ 'coxs-bazar-sunset-royal-villa'      │ true   │ 3              │ 3             │ 0                    │ 0                  │ '-'   │
│ 2       │ 'kuakata-horizon-sunrise-room'       │ true   │ 6              │ 6             │ 0                    │ 0                  │ '-'   │
│ 3       │ 'saint-martins-coral-view-cottage'   │ true   │ 5              │ 5             │ 0                    │ 0                  │ '-'   │
│ 4       │ 'sajek-cloud-view-wooden-cottage'    │ true   │ 4              │ 4             │ 0                    │ 0                  │ '-'   │
│ 5       │ 'sreemangal-executive-tea-view'      │ true   │ 8              │ 8             │ 0                    │ 0                  │ '-'   │
│ 6       │ 'sreemangal-presidential-golf-suite' │ true   │ 2              │ 2             │ 0                    │ 0                  │ '-'   │
│ 7       │ 'sundarbans-mangrove-safari-cabin'   │ true   │ 5              │ 5             │ 0                    │ 0                  │ '-'   │
└─────────┴──────────────────────────────────────┴────────┴────────────────┴───────────────┴──────────────────────┴────────────────────┴───────┘
8 room types, 39 units would be created.
```

## Deploy steps (VPS)

1. Take a backup: `scripts/backup-postgres.sh` (`DEPLOYMENT.md` §7).
2. Run the pre-flight above on the current release and fix any counts.
3. Deploy as usual (`pnpm build` applies the three migrations).
4. Check the result:
   ```sql
   SELECT r.slug, COUNT(u.*) AS units
   FROM "Room" r LEFT JOIN "RoomUnit" u ON u."roomId" = r.id
   GROUP BY r.slug ORDER BY r.slug;
   ```
5. Rename units to the property's real room numbers in `/admin/rooms/[id]?tab=units` ("CBOD-1" → "101"). This is optional but recommended, since staff will see these names.

If `btree_gist` can't be created (a managed database that refuses extensions), migration 1 fails. `migrate deploy` stops before any data changes and the old release keeps running. Ask the host to enable `btree_gist`, then deploy again.

## How availability works now

The logic lives in `src/lib/rooms/availability.ts`.

- **Bookable unit:** `isActive`, not archived, status not `MAINTENANCE` / `OUT_OF_ORDER`. `CLEANING`, `OCCUPIED` and `RESERVED` don't block *future* dates. Booking overlap decides those.
- **Free for `[checkIn, checkOut)`:** bookable, and no live (`PENDING`, `CONFIRMED`, `CHECKED_IN`, and since FU-7 `PENDING_MANUAL_VERIFICATION`) booking on it overlaps the window.
- **Available count** = free units − overlapping live bookings *without* a unit (pre-migration bookings). Each of those still uses one unit of its type.
- **Assignment:** the lowest-numbered free unit, sorted naturally (`2` before `10`). A booking edit keeps its unit when it's still free for the new dates. The assignment runs inside the booking transaction. Concurrent assignments for one room type are serialised by a transaction-scoped advisory lock (`pg_advisory_xact_lock` on the room type, taken in `assignUnit`), so the second request sees the first one's booking and picks another unit. The exclusion constraint remains the backstop for any other write path. If it rejects a transaction, or Postgres picks one as a deadlock victim, `withUnitRetry` re-reads availability and tries again, up to 3 times. The lock was added after the fact; see FU-1 in 07-VERIFICATION.md.
- **Guests don't pick units.** The brief allows guest choice when several are free. Units are always auto-assigned, because unit numbers mean nothing to a guest and staff can reassign. Manual reassignment at the desk belongs to Phase B (front desk / check-in).
- **Unit status follows the stay:**

  | Booking status change | Unit status change |
  |---|---|
  | → `CHECKED_IN` | → `OCCUPIED` |
  | `CHECKED_IN` → `COMPLETED` | `OCCUPIED` → `AVAILABLE` (Phase B changes this to `CLEANING`) |
  | `CHECKED_IN` → `CANCELLED` | `OCCUPIED` → `AVAILABLE` (Phase B changes this to `CLEANING`) |

  A unit someone set to `MAINTENANCE` or `OUT_OF_ORDER` is never changed automatically. `RESERVED` is not set automatically: "reserved" is derived from bookings, and the value stays in the enum for manual use.
- **Checking in a pre-migration booking** assigns it a unit. **Re-opening a cancelled booking** re-checks availability: it keeps its old unit, moves to another, or is refused when the type is full.

### Endpoints

- `POST /api/bookings` (public): validates `checkOut > checkIn` (the old code used `Math.abs`, so reversed dates were accepted). Returns **409** when the dates are full; it used to return 400 on the counter. On success the response shape is unchanged.
- `GET /api/rooms/[roomId]/availability?checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD[&detail=units]` (public, new): `{ roomId, checkIn, checkOut, available, units? }`. At most 60 nights; strict query validation; 404 for an unknown or inactive room type. It reserves nothing.
- `/api/payments/availability` is **untouched**. It answers whether a payment *gateway* is usable, not whether a room is free (baseline N2).

## Admin UI

- **`/admin/rooms`:** each card shows the unit count (units not archived), with a red "N out of service" badge when any are in `MAINTENANCE` or `OUT_OF_ORDER`.
- **`/admin/rooms/[id]`** has two tabs, **Details | Units (n)**. `?tab=units` opens the Units tab directly.
  - List: unit number, floor, block, notes, and a status dropdown.
  - Edit: number, floor, block and notes.
  - Add: leave the number blank to get the next `<PREFIX>-<n>`. Typing the number of an archived unit restores it along with its history.
  - Remove: asks for confirmation and is refused while the unit has an active or upcoming booking. Removed units are **archived**, never hard-deleted, so past bookings keep their unit.
  - Taking a unit out of service while it has upcoming bookings succeeds, but shows a warning listing those booking codes so someone reassigns them.
- **Roles, until Section 2 moves these to `requirePermission`:** add and remove are OWNER only (with 2FA); status and edit need MANAGER or above.
- **Audit:** every unit action writes an `AuditLog` row with module `ROOM`: `ROOM_UNIT_ADDED` / `_RESTORED` / `_UPDATED` / `_STATUS_CHANGED` / `_REMOVED`, each with a before/after `diff`.
- **Booking detail** shows the unit ("Not assigned" for pre-migration bookings).
- **Public pages:**
  - `/destinations/[slug]` shows "N units left" as the bookable unit count. It isn't date-specific; the stepper checks real dates.
  - `/book/[roomId]` passes the bookable unit count to the stepper.

## Rollback

`Room.availableUnits` is kept, and every unit action re-syncs it to the bookable unit count. The previous release reads that column, so it sees sensible stock after a rollback. The previous release also ignores `unitId`, `RoomUnit` and the exclusion constraint:
- bookings it creates have `unitId = NULL`, so the constraint doesn't apply to them;
- the new release counts those bookings as unassigned overlaps when it comes back.

To roll back:
1. Redeploy the previous release. **Do not** roll the migrations back, because the tables are additive.
2. Deleting room types stays blocked, because the foreign key is RESTRICT. No UI does that anyway.

Dropping `Room.availableUnits` is a follow-up release, after the payment code stops decrementing it: deferred list, standing rule.

## Known limitations

1. **Payment code still decrements `Room.availableUnits`** on confirmation (`banglaqr/settlement.ts:51`, `webhooks/payment/route.ts:76-79`). Nothing reads the column for availability any more. It's only a rollback aid, and it can drift below the unit count between unit changes. It gets removed when those files are next touched (standing rule).
2. **PMS sync still writes `availableUnits`** (`pms/sync-engine.ts`, `webhooks/pms/[provider]`). That figure is the PMS's own availability, not a unit count. For a client whose PMS is the source of truth, availability should come from the PMS. That needs its own design and isn't part of A2.
3. **Units can't be reassigned by hand** at the desk yet (Phase B). A booking edit moves a booking only when its unit is no longer free.
4. **Removing a unit races with a booking** created in the same instant. That booking could land on a unit that is being archived. It's rare (one owner action against one guest request on the same unit in the same millisecond) and visible on the booking. A row lock would close it; that's noted for Phase B.
5. **Unit numbers are generated** (`CBOD-1`). The owner should rename them to the property's real numbers.
6. **The dashboard still reads `availableUnits`** for its "0 units" alert. Section 6 rebuilds the dashboard on units.

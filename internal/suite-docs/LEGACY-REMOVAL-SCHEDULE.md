# Legacy removal schedule (CQ-M9)

The deprecated pieces below are fenced (lint gates + deprecation tags) but
still in the tree. Each release removes one layer; none of them is
launch-day work, and none may ride along with an unrelated feature.

## Release R1 — done 2026-11-02 (this phase)

- Removed the `Room.availableUnits` confirm-path decrements
  (`holdRoomUnit()` in BanglaQR settlement/verification/webhook-processor,
  demo `confirm.ts`). Units are the source of truth; bkash/nagad/
  sslcommerz/stripe never decremented and nothing ever incremented, so the
  writes only produced one-way garbage for non-PMS properties.
- Remaining writers (kept): PMS webhook + sync-engine (external truth),
  `syncLegacyAvailableUnits` on unit changes (derived truth, rollback
  safety), init-on-room-create.

## Release R2 — migrate the deferred payment guards

- Migrate the 8 files in `scripts/check-require-role.sh` (`DEFERRED`)
  from `requireRole()` to `requirePermission()`; remove each from the
  list in the same PR.
- Unblocks: deleting the deprecated `UserRole` union in
  `src/lib/auth-helpers.ts` (guarded by `auth-helpers.test.ts`).

## Release R3 — drop the STAFF role

- Precondition: R2 (no `requireRole` callers left).
- Data: `UPDATE "User" SET role = 'FRONT_DESK' WHERE role = 'STAFF'`
  (STAFF already mirrors FRONT_DESK grants exactly).
- Code: remove `"STAFF"` from `ROLES` in `src/lib/permissions.ts`,
  the `STAFF: FRONT_DESK_GRANTS` mirror, and `LegacyRole` +
  `legacyRoleAtLeast`/`highestLegacyRole` (`permissions.ts:237-255`).

## Release R4 — drop the Float money mirrors

- Precondition: all 11 `money-legacy.ts` importers migrated to poisha-only
  writes (`bookingTotalFields` / `paymentAmountFields` / `roomPriceFields`).
- Data: verify `pricePerNight * 100 = pricePerNightPoisha` (Room),
  `totalAmount * 100 = totalAmountPoisha` (Booking),
  `amount * 100 = amountPoisha` (Payment) on prod before dropping.
  (Ratings `Float`s are not money and stay.)
- Code: delete `src/lib/money-legacy.ts`, drop the three columns,
  remove `legacy-money-ok` markers (PMS types/adapter/route + test).

## Release R5 — drop `Room.availableUnits`

- Precondition: the "units left" displays
  (`DestinationDetailClientView`, `SwissBookingWidget`) read unit
  availability instead of the counter.
- Data: drop the column after one release with zero writers: remove the
  PMS webhook/sync writes, `syncLegacyAvailableUnits` + its 3 call sites,
  and the init-on-create default.

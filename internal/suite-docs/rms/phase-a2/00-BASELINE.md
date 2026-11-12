# Phase A2 — Baseline (Section 0)

**Branch:** `phase-a2-foundation`, created from `main` at `9e8280b` (2026-09-30 20:24 +0600).
**Status:** Section 0 only. No application code has changed. Sections 1–8 wait for owner review of this document.
**Audience:** the owner (reviewing before A2 starts) and whoever implements Sections 1–9.

Where this document and the Phase A2 brief disagree, this document describes the code as it is on `main` today. Each disagreement is listed in [§ Adjustments](#adjustments-to-the-brief) or [§ New findings](#new-findings-that-need-a-decision).

> **`main` has changed a lot since Phase A1.** A1 was merged as `0d2d274`. Since then **90 more commits** have landed on `main`: blog hardening, BanglaQR, bKash, Nagad and SSLCommerz. `docs/rms/00-CURRENT-STATE.md` and `docs/rms/phase-a1/01-COMPLETION.md` predate those commits. Wherever they disagree with the code, this baseline follows the code, as the brief instructs. The main differences:
> - there are 19 migrations, not 3;
> - there are 939 tests, not 48;
> - four gateways now have their own `*Settings` models and owner forms;
> - the blog has its own role rules in `src/lib/blog/permissions.ts`.

---

## Adjustments to the brief

The owner approved these five before Section 0 started. They apply to every later section.

| # | Brief says | Adjustment (approved) |
|---|---|---|
| A1 | `docs/rms/01-ROLES-AND-PERMISSIONS.md` is the source of truth for the permission matrix | That file does not exist: the planning set stopped at `00-CURRENT-STATE.md`. It will be written **as its own commit before Section 1**. `phase-a2/02-PERMISSION-MATRIX.md` then implements it. |
| A2 | Update `/admin/dashboard` | There is no `/admin/dashboard`. The dashboard is `/admin` (`src/app/admin/page.tsx` + `DashboardView.tsx`). Section 6 updates `/admin` in place. **No `/admin/dashboard` alias** is added. |
| A3 | Convert the "11" `requireRole` calls | The code has **71 guard call sites** (65 `requireRole` + 6 `requireAuth`, see §0.3). Section 2 migrates only the **operational** call sites. **Payment call sites keep `requireRole`, untouched.** Deferred call sites are listed, under a standing rule: *a later phase that edits a file on the deferred list migrates that file's call sites in the same change.* |
| A4 | `RoomUnit.housekeepingTasks HousekeepingTask[]` | `HousekeepingTask` does not exist. The relation is **left out of `RoomUnit`** and added in Phase B together with the model. |
| A5 | Walkthrough step 7: disable inventory, `/admin/inventory` returns 404 | `/admin/inventory` does not exist. The module flag is tested on **`/admin/rooms`**. A disabled module shows a **"Module disabled" page**, not a bare 404 (still fail-closed: no data, no actions). |

---

## 0.1 Phase A1 state

### Raw output

```
$ git log --oneline main | head -20
9e8280b docs(sslcommerz): section 18 verification report with raw evidence
d0a0870 docs(sslcommerz): section 17 documentation for the hardened integration
c083888 refactor(sslcommerz): section 16 developer conventions
f89622b fix(sslcommerz): IPN asks for a retry only when SSLCommerz couldn't be reached
846bfdc test(sslcommerz): section 15 automated test suite
33820a8 feat(sslcommerz): owner settings form for SSLCommerz limits (decision D8)
ea5d4cc feat(sslcommerz): section 14 notifications
1e075c6 feat(sslcommerz): section 13 failure modes and resilience
e600bb5 test(sslcommerz): section 12 error handling
30974b7 feat(sslcommerz): section 11 rate limiting
c061191 feat(sslcommerz): section 10 audit logging
e0c6ea6 feat(sslcommerz): section 9 reconciliation cron
e9c2e1a feat(sslcommerz): section 8 refund flow
3dd2bb1 feat(sslcommerz): section 7 amount and transaction validation
a286afa feat(sslcommerz): section 6 idempotency and admin status guards
c003834 feat(sslcommerz): section 4 callback security
091f15f feat(sslcommerz): section 5 callback hash verification
de21270 feat(sslcommerz): section 3 session initiation
1c79e7d feat(sslcommerz): section 2 input and callback body validation
de34939 feat(sslcommerz): section 1 credential handling
```

`pnpm test` (plain, as CI runs it with no test database):

```
$ vitest run

 RUN  v4.1.11 /Users/mdamirhossain/ViveScript-Solutions/projects/TravelWebTemplate


 Test Files  28 passed | 36 skipped (64)
      Tests  478 passed | 461 skipped (939)
   Start at  20:51:19
   Duration  3.95s (transform 3.62s, setup 0ms, import 15.75s, tests 2.00s, environment 6ms)
```

The 461 skipped tests are database-backed. They run only when `DATABASE_URL` names a `*_test` database (`src/lib/payments/banglaqr/__tests__/db.ts`). Here is the full suite against a freshly migrated scratch database `resort_a2_test`, with the migration drift test enabled:

```
$ DATABASE_URL=postgresql://resort:***@localhost:5432/resort_a2_test?schema=public \
  SHADOW_DATABASE_URL=postgresql://resort:***@localhost:5432/resort_shadow REQUIRE_DB_TESTS=1 \
  BANGLAQR_TOKEN_SECRET=<test value> BANGLAQR_WEBHOOK_SECRET=<test value> \
  pnpm vitest run --no-file-parallelism

 RUN  v4.1.11 /Users/mdamirhossain/ViveScript-Solutions/projects/TravelWebTemplate


 Test Files  64 passed (64)
      Tests  939 passed (939)
   Start at  20:51:59
   Duration  49.06s (transform 1.36s, setup 0ms, import 7.45s, tests 35.82s, environment 4ms)
```

`pnpm lint`:

```
$ eslint . && pnpm check:guards && pnpm check:money
$ bash scripts/check-admin-api-guards.sh && bash scripts/check-admin-actions-guards.sh && bash scripts/check-admin-actions-guards.sh src/app/actions/banglaqr-actions.ts && bash scripts/check-admin-actions-guards.sh src/app/actions/bkash-actions.ts && bash scripts/check-admin-actions-guards.sh src/app/actions/nagad-actions.ts && bash scripts/check-admin-actions-guards.sh src/app/actions/sslcommerz-actions.ts && for f in src/app/actions/blog/*.ts; do bash scripts/check-admin-actions-guards.sh "$f" || exit 1; done
✓ All admin, cron and webhook route handlers are guarded
✓ Every exported Server Action in src/app/actions/admin-actions.ts calls a guard
✓ Every exported Server Action in src/app/actions/banglaqr-actions.ts calls a guard
✓ Every exported Server Action in src/app/actions/bkash-actions.ts calls a guard
✓ Every exported Server Action in src/app/actions/nagad-actions.ts calls a guard
✓ Every exported Server Action in src/app/actions/sslcommerz-actions.ts calls a guard
✓ Every exported Server Action in src/app/actions/blog/moderation.ts calls a guard
✓ Every exported Server Action in src/app/actions/blog/posts.ts calls a guard
✓ Every exported Server Action in src/app/actions/blog/settings.ts calls a guard
✓ Every exported Server Action in src/app/actions/blog/taxonomy.ts calls a guard
$ bash scripts/check-no-float-money.sh
✓ No legacy Float money field names outside src/lib/money-legacy.ts
```

`pnpm build`: the full output is at the end, in [Appendix A](#appendix-a--pnpm-build-raw-output). Exit code 0. Its one warning is the known Next 16 `middleware` → `proxy` deprecation.

### Checklist

| Check | Result | Evidence |
|---|---|---|
| Postgres is the datasource | ✅ | `prisma/schema.prisma:6` `provider = "postgresql"` |
| `User.role` is the `UserRole` enum | ✅ | `prisma/schema.prisma:16` `role UserRole @default(STAFF)`. The enum at `:36-47` has 10 values. ⚠️ The **TypeScript** `UserRole` in `src/lib/auth-helpers.ts:5` still has only 3 values (see N3). |
| Money reads use `*Poisha` columns | ✅ | `pnpm check:money` → "No legacy Float money field names outside src/lib/money-legacy.ts". The legacy Floats carry `/// @deprecated` (`schema.prisma:122,160,190`) and the typed `no-deprecated` lint rule passes. |
| `pnpm build` runs `migrate deploy`, not `db push` | ✅ | `package.json` `build`: `prisma generate && prisma migrate deploy && next build`. The build log shows "19 migrations found … No pending migrations to apply." |
| F1 hotfix in place (8 routes gone, the 9th guarded) | ✅ | The 8 files deleted by `72a692c` are all absent: `api/admin/{bookings,bookings/[id],destinations,destinations/[id],leads,leads/[id],rooms,rooms/[id]}/route.ts`. `api/admin/pms/test-connection/route.ts:6` has `await requireRole("OWNER")`. `check-admin-api-guards.sh` passes. |
| `pnpm lint` includes `check:guards` and `check:money` | ✅ | `lint`: `eslint . && pnpm check:guards && pnpm check:money`. `check:guards` now covers `admin-actions.ts`, the 4 gateway action files and `actions/blog/*.ts`. |

**Verdict: Phase A1 is merged and green. A2 can start once this document is approved.**

---

## 0.2 RoomUnit readiness

### Current `Room` shape (`prisma/schema.prisma:116-135`)

```prisma
model Room {
  id                  String      @id @default(uuid())
  destinationId       String
  destination         Destination @relation(fields: [destinationId], references: [id], onDelete: Cascade)
  title               String
  slug                String      @unique
  pricePerNight       Float       /// @deprecated
  pricePerNightPoisha Int?
  maxGuests           Int
  bedType             String
  sizeSqFt            Int
  images              String // JSON array string
  amenities           String // JSON array string
  availableUnits      Int         @default(5)
  isActive            Boolean     @default(true)
  createdAt           DateTime    @default(now())
  updatedAt           DateTime    @updatedAt
  bookings            Booking[]
}
```

- A `Room` is a **room type**. No row represents a physical unit.
- `Booking.room` is `onDelete: Cascade` (`schema.prisma:154`), and so is `Payment.booking` (`:186`). Deleting a room type deletes its bookings and their payments. The only code that deletes rooms is `prisma/seed.ts:342` (`room.deleteMany()`); no UI or action does.
- `Booking` has no unit column. `Booking.status` is a free `String` (`:163`).

Local data in `resort_dev`, copied from SQLite in A1 (8 room types, 39 units in total):

```
                slug                | availableUnits | isActive | bookings
------------------------------------+----------------+----------+----------
 coxs-bazar-oceanfront-deluxe       |              6 | t        |        0
 coxs-bazar-sunset-royal-villa      |              3 | t        |        0
 kuakata-horizon-sunrise-room       |              6 | t        |        0
 saint-martins-coral-view-cottage   |              5 | t        |        0
 sajek-cloud-view-wooden-cottage    |              4 | t        |        4
 sreemangal-executive-tea-view      |              8 | t        |        0
 sreemangal-presidential-golf-suite |              2 | t        |        0
 sundarbans-mangrove-safari-cabin   |              5 | t        |        0
```

### Every reader and writer of `Room.availableUnits`

**`availableUnits` is not a fixed count of physical rooms.** Gateway code, the payment webhook and the PMS sync all write to it. The column works as a mutable stock counter. See finding **N1**.

| # | File:line | Read / write | What it does | Category |
|---|---|---|---|---|
| 1 | `src/app/actions/admin-actions.ts:84-93` | read | Offline booking: counts overlapping PENDING/CONFIRMED/CHECKED_IN bookings and refuses when the count reaches `availableUnits`. **Date-aware.** | ops |
| 2 | `src/app/actions/admin-actions.ts:458-469` | read | Booking edit that changes room or dates: same overlap check, excluding the booking itself | ops |
| 3 | `src/app/actions/admin-actions.ts:304,329` | write | `createOrUpdateRoom` sets the value from the room form | ops |
| 4 | `src/app/api/bookings/route.ts:37` | read | Public booking API: refuses only when `availableUnits <= 0`. **Not date-aware**, no overlap count. | ops (public) |
| 5 | `src/lib/payments/banglaqr/settlement.ts:51` | **write** | Decrements by 1 when a BanglaQR payment is confirmed (`updateMany … gt: 0`) | **payment** |
| 6 | `src/app/api/webhooks/payment/route.ts:76-79` | **write** | Decrements by 1 when a generic payment webhook confirms a booking | **payment** |
| 7 | `src/app/api/webhooks/pms/[provider]/route.ts:110-122` | **write** | PMS webhook overwrites it with the PMS's figure | ops (PMS) |
| 8 | `src/lib/pms/sync-engine.ts:39-61` | **write** | PMS pull sync overwrites it and logs previous/new | ops (PMS) |
| 9 | `src/app/admin/page.tsx:83-88` | read | Dashboard alert "room has 0 units available" (`availableUnits: 0`) | ops |
| 10 | `src/app/admin/rooms/page.tsx:36`, `RoomsView.tsx:20,115,118` | read | Rooms list column | ops |
| 11 | `src/app/admin/rooms/[id]/RoomEditView.tsx:23`, `src/components/admin/RoomForm.tsx:22,73-74,118,244` | read/write | Room edit form field (defaults to 5) | ops |
| 12 | `src/app/book/[roomId]/page.tsx:185`, `src/components/travel/BookingStepper.tsx:27` | read | Passed to the stepper as a prop. The stepper does not use it to block a booking; it POSTs to `/api/bookings` (`BookingStepper.tsx:107`) | ops (public) |
| 13 | `src/app/destinations/[slug]/DestinationDetailClientView.tsx:43,323` | read | Public page shows "N units available" | ops (public) |
| 14 | `src/app/style-guide/page.tsx:288` | literal | Demo prop | — |
| 15 | `src/lib/pms/types.ts:31`, `pms/index.ts:30`, `pms/adapters/gyoroom-adapter.ts:62,69`, `pms/README.md` | type/mock | PMS `AvailabilityResult.availableUnits`: the PMS's own *availability* figure, not a unit count | ops (PMS) |
| 16 | `src/content/en.ts:387,648`, `bn.ts:389,650` | i18n | "Available Units" / "উপলব্ধ ইউনিট" labels | — |
| 17 | `prisma/seed.ts:94,110,151,192,208,248,288,328` | seed | Demo values 6, 3, 4, 8, 2, 5, 5, 6 | seed |

### How room availability is computed today

There is **no shared availability function**. There are three separate rules:

1. **Admin offline booking and booking edit** (rows 1–2) are date-aware: `count(bookings overlapping [checkIn, checkOut) with status in PENDING, CONFIRMED, CHECKED_IN) < availableUnits`. The check is not in a transaction with the insert, so two concurrent creates can both pass.
2. **The public booking API** (row 4) checks only `availableUnits > 0`, whatever the dates. A room type with 1 unit can be booked for the same night any number of times until a payment confirmation decrements the counter.
3. **The payment confirmation paths** (rows 5–6) decrement the counter once per confirmed booking and never increment it back on checkout, cancellation or expiry. This was already recorded as cross-gateway issue **A4** in `docs/PAYMENTS-BANGLAQR-SECURITY-REVIEW.md:443`.

⚠️ **The brief's Section 1.4 targets the wrong files.** `src/lib/payments/availability.ts` and `/api/payments/availability` answer "is this **payment gateway** usable right now?" (`getPaymentAvailability`, `getEnabledPaymentProviders`). They have nothing to do with rooms. See finding **N2**.

### Tests that depend on `availableUnits`

All of them are in payment code (the deferred list):

| File:line | Assertion |
|---|---|
| `src/lib/payments/banglaqr/__tests__/fixtures.ts:39` | Fixture room with `availableUnits: 5` |
| `src/lib/payments/banglaqr/concurrency.test.ts:44,97,110,121` | Confirmation decrements `availableUnits` by exactly 1 under concurrency |
| `src/lib/payments/nagad/admin-guards.test.ts:51` | A blocked admin action leaves `availableUnits` unchanged |
| `src/lib/auth-helpers.test.ts` | (not `availableUnits`, but pins the role fallback: see N3) |

No test covers `admin-actions.ts` availability or `/api/bookings`.

---

## 0.3 Permission check inventory

### Raw output

`grep -rn "requireRole" src/ | sort` returns 113 lines. That count includes imports, comments, the definition and test files. With imports, comments, tests and the helper's own definition removed, **71 guard call sites** remain: 65 `requireRole` and 6 `requireAuth`.

The per-call table below was generated by a script. For each `requireRole(` / `requireAuth(` call it prints the enclosing function; the operations were then checked by hand. `requireMfa` (33 matches) is a 2FA gate that sits on top of these guards, not a role check. It stays as it is.

### Operational: migrated to `requirePermission` in Section 2 (20)

| # | Call site | Guard | Role | Operation |
|---|---|---|---|---|
| 1 | `src/app/actions/admin-actions.ts:50` | `requireRole` | STAFF | `createOfflineBooking`: create an offline booking |
| 2 | `src/app/actions/admin-actions.ts:192` | `requireRole` | MANAGER | `updateBookingStatus` to CONFIRMED or CANCELLED |
| 3 | `src/app/actions/admin-actions.ts:194` | `requireRole` | STAFF | `updateBookingStatus` to any other status (CHECKED_IN, COMPLETED, …) |
| 4 | `src/app/actions/admin-actions.ts:270` | `requireRole` | OWNER | `toggleRoomStatus`: activate/deactivate a room type |
| 5 | `src/app/actions/admin-actions.ts:309` | `requireRole` | MANAGER | `createOrUpdateRoom`: create or edit a room type |
| 6 | `src/app/actions/admin-actions.ts:370` | `requireRole` | STAFF | `updateGuestNotes` |
| 7 | `src/app/actions/admin-actions.ts:412` | `requireRole` | MANAGER | `updateBooking`: edit dates, room or amount |
| 8 | `src/app/actions/admin-actions.ts:581` | `requireRole` | MANAGER | `cancelBookingWithRefundDecision` |
| 9 | `src/app/admin/page.tsx:9` | `requireAuth` | any | Dashboard page |
| 10 | `src/app/admin/bookings/page.tsx:19` | `requireAuth` | any | Bookings list |
| 11 | `src/app/admin/bookings/[id]/page.tsx:32` | `requireAuth` | any | Booking detail |
| 12 | `src/app/admin/bookings/new/page.tsx:9` | `requireRole` | STAFF | New offline booking page |
| 13 | `src/app/admin/guests/page.tsx:12` | `requireAuth` | any | Guests list |
| 14 | `src/app/admin/rooms/page.tsx:9` | `requireAuth` | any | Rooms list |
| 15 | `src/app/admin/rooms/[id]/page.tsx:12` | `requireRole` | MANAGER | Room edit page |
| 16 | `src/app/admin/settings/page.tsx:7` | `requireRole` | OWNER | Settings page |
| 17 | `src/app/admin/settings/integrations/page.tsx:11` | `requireRole` | OWNER | PMS integrations page |
| 18 | `src/app/api/admin/pms/test-connection/route.ts:6` | `requireRole` | OWNER | `POST`: PMS test connection |
| 19 | `src/app/api/admin/reports/payments/route.ts:8` | `requireRole` | MANAGER | `GET`: payments report / CSV. It is under `reports/`, not `payments/`, and touches no gateway code, so it is classed as **operational (REPORTS.export)**. The owner may move it to the deferred list. |
| 20 | `src/app/admin/setup-2fa/page.tsx:9` | `requireAuth` | any | 2FA enrolment. **Stays `requireAuth`**: every role must be able to reach it. |

### Blog: see finding N4 (24)

| # | Call site | Role | Operation |
|---|---|---|---|
| 1 | `src/app/actions/blog/posts.ts:35` | STAFF | `savePostAction` |
| 2 | `src/app/actions/blog/posts.ts:231` | MANAGER | `deletePostAction` |
| 3 | `src/app/actions/blog/posts.ts:262` | MANAGER | `bulkPostsAction` |
| 4 | `src/app/actions/blog/posts.ts:296` | STAFF | `previewMarkdownAction` |
| 5 | `src/app/actions/blog/moderation.ts:93` | MANAGER | `approvePostAction` |
| 6 | `src/app/actions/blog/moderation.ts:98` | MANAGER | `rejectPostAction` |
| 7 | `src/app/actions/blog/moderation.ts:103` | MANAGER | `archivePostAction` |
| 8 | `src/app/actions/blog/moderation.ts:109` | MANAGER | `saveModerationNoteAction` |
| 9 | `src/app/actions/blog/settings.ts:13` | OWNER | `updateBlogSettingsAction` |
| 10 | `src/app/actions/blog/taxonomy.ts:19` | MANAGER | `saveCategoryAction` |
| 11 | `src/app/actions/blog/taxonomy.ts:49` | MANAGER | `deleteCategoryAction` |
| 12 | `src/app/actions/blog/taxonomy.ts:67` | MANAGER | `saveTagAction` |
| 13 | `src/app/actions/blog/taxonomy.ts:94` | MANAGER | `deleteTagAction` |
| 14 | `src/app/actions/blog/taxonomy.ts:113` | MANAGER | `createTagFromNameAction` |
| 15 | `src/app/admin/blog/page.tsx:23` | STAFF | Blog list page |
| 16 | `src/app/admin/blog/new/page.tsx:8` | STAFF | New post page |
| 17 | `src/app/admin/blog/[id]/page.tsx:18` | STAFF | Edit post page |
| 18 | `src/app/admin/blog/[id]/preview/page.tsx:21` | STAFF | Preview page |
| 19 | `src/app/admin/blog/categories/page.tsx:8` | MANAGER | Categories page |
| 20 | `src/app/admin/blog/tags/page.tsx:8` | MANAGER | Tags page |
| 21 | `src/app/admin/blog/pending/page.tsx:8` | MANAGER | Moderation queue |
| 22 | `src/app/admin/blog/pending/[id]/page.tsx:14` | MANAGER | Moderation detail |
| 23 | `src/app/admin/blog/settings/page.tsx:12` | OWNER | Blog settings |
| 24 | `src/app/api/admin/blog/images/route.ts:38` | STAFF | `POST`: image upload |

After the role gate, the blog applies per-post rules from `src/lib/blog/permissions.ts` (`isManagerOrOwner`, `canEditPost`, …; see `docs/blog/PERMISSIONS.md`).

### Payments: deferred, `requireRole` left untouched (27)

| # | Call site | Role | Operation |
|---|---|---|---|
| 1 | `src/app/actions/banglaqr-actions.ts:108` | MANAGER | `confirmBanglaQRPaymentAction` |
| 2 | `src/app/actions/banglaqr-actions.ts:128` | MANAGER | `rejectBanglaQRPaymentAction` |
| 3 | `src/app/actions/banglaqr-actions.ts:145` | MANAGER | `requestBanglaQRReceiptAction` |
| 4 | `src/app/actions/banglaqr-actions.ts:162` | OWNER | `updateBanglaQRSettingsAction` |
| 5 | `src/app/actions/banglaqr-actions.ts:180` | MANAGER | `getBanglaQRReceiptUrlAction` |
| 6 | `src/app/actions/banglaqr-actions.ts:197` | OWNER | `deleteBanglaQRReceiptAction` |
| 7 | `src/app/actions/banglaqr-actions.ts:215` | OWNER | `confirmBanglaQRWithoutReceiptAction` |
| 8 | `src/app/actions/banglaqr-actions.ts:238` | OWNER | `releaseExpiredBanglaQRBookingsAction` |
| 9 | `src/app/actions/bkash-actions.ts:68` | OWNER | `refundBkashPaymentAction` |
| 10 | `src/app/actions/bkash-actions.ts:124` | MANAGER | `checkBkashPaymentStatusAction` |
| 11 | `src/app/actions/bkash-actions.ts:148` | OWNER | `updateBkashSettingsAction` |
| 12 | `src/app/actions/nagad-actions.ts:74` | OWNER | `refundNagadPaymentAction` |
| 13 | `src/app/actions/nagad-actions.ts:129` | OWNER | `resolveNagadRefundAction` |
| 14 | `src/app/actions/nagad-actions.ts:154` | MANAGER | `checkNagadPaymentStatusAction` |
| 15 | `src/app/actions/nagad-actions.ts:174` | OWNER | `updateNagadSettingsAction` |
| 16 | `src/app/actions/sslcommerz-actions.ts:80` | OWNER | `refundSSLCommerzPaymentAction` |
| 17 | `src/app/actions/sslcommerz-actions.ts:134` | OWNER | `resolveSSLCommerzRefundAction` |
| 18 | `src/app/actions/sslcommerz-actions.ts:159` | MANAGER | `checkSSLCommerzPaymentStatusAction` |
| 19 | `src/app/actions/sslcommerz-actions.ts:181` | OWNER | `updateSSLCommerzSettingsAction` |
| 20 | `src/app/admin/payments/banglaqr-verification/page.tsx:14` | MANAGER | BanglaQR verification queue page |
| 21 | `src/app/admin/settings/payments/page.tsx:23` | OWNER | Payment gateway settings page |
| 22 | `src/app/api/admin/payments/banglaqr/receipt-file/route.ts:15` | MANAGER | `GET`: receipt file |
| 23 | `src/app/api/admin/payments/bkash/test-connection/route.ts:32` | OWNER | `POST` |
| 24 | `src/app/api/admin/payments/nagad/test-connection/route.ts:33` | OWNER | `POST` |
| 25 | `src/app/api/admin/payments/sslcommerz/test-connection/route.ts:33` | OWNER | `POST` |
| 26 | `src/app/api/admin/payments/refund/route.ts:14` | OWNER | `POST`: generic refund |
| 27 | `src/app/api/admin/payments/status/route.ts:11` | MANAGER | `GET`: payment status |

**Standing rule for the deferred list** (it will also go in `02-PERMISSION-MATRIX.md`): any later phase that edits a file listed above migrates **every** guard in that file to `requirePermission` in the same change, and runs that gateway's full test suite (`pnpm test:<gateway>:db`). Until that happens, the matrix records the module/action each deferred call site *will* map to, so the sidebar and the page guard agree.

`scripts/check-admin-actions-guards.sh:7` and `check-admin-api-guards.sh:10` already accept `requirePermission(` as a guard, so the lint gate does not need changing to allow the migration.

---

## 0.4 Settings and dashboard: current state

Both pages were rendered on a production build (`next start -p 3100`) against the scratch database `resort_a2_test`, which had `pnpm db:seed` and `seed-admin` applied, signed in as a scratch OWNER. The visible text was extracted from the returned HTML.

### `/admin/settings`

`src/app/admin/settings/page.tsx` → `requireRole("OWNER")` → `requireMfa()` → `<SettingsClientView />` (`src/app/admin/SettingsClientView.tsx`, 337 lines).

Rendered text, in order:

```
Property & Portal Settings | Manage system configurations, booking policies, payment integrations, and staff roles. |
General Config | Resort Identity Defaults | Property Name | Reservation Desk Phone | Official Email |
bKash Tokenized Checkout (V2) | Sandbox | bKash Tokenized Integration Status |
bKash checkout is active. Customers can pay directly with their bKash account. |
App Key | App Secret | Merchant Username | Merchant Password |
Credentials are set via server environment variables (.env.production). Changing credentials requires server restart. |
Test bKash Connection | Booking Rules & Check-In Window | Standard Check-In Time | Standard Check-Out Time |
Minimum Stay (Nights) | Free Cancellation (Hours) |
Property Management System (PMS) Integration | PMS synchronization engine (GyoRoom / Staah / Cloudbeds) will be configured in Phase 11. |
Save Settings
```

| Element | Behaviour |
|---|---|
| Property name / phone / email | Uncontrolled `<Input defaultValue={brand.*}>` (`:111,119,128`). Not saved anywhere. |
| bKash enabled toggle | Local `useState` only (`:28-30,149-157`). The status text flips; nothing persists. Brand config is the real switch. |
| bKash credentials | Four masked, read-only inputs showing fixed bullet strings (`:185-221`). No values are read. |
| Test bKash Connection | **Works**: `POST /api/admin/payments/bkash/test-connection` (`:43`) |
| Check-in 14:00 / check-out 11:00 / min stay 1 / free cancellation 48 | Hard-coded `defaultValue` literals (`:282,288,296,306`), not read from `brand.config.ts` (which has `checkinTime` / `checkoutTime`) |
| PMS block | Static placeholder text ("Phase 11") |
| **Save Settings** | `handleSave` (`:69-73`) calls `preventDefault()`, sets `saved=true` for 4 s and shows "Settings saved". **It persists nothing**: no action, no fetch. |
| No tabs | ✅ confirmed |
| `/admin/settings/payments` and `/admin/settings/integrations` | Both render (200 as OWNER) but are **orphaned**. Nothing in the UI links to them; only `revalidatePath` calls reference `/admin/settings/payments`. Payment settings now have four real per-gateway owner forms there (`BkashSettingsForm`, `NagadSettingsForm`, `SSLCommerzSettingsForm`, `BanglaQRSettingsForm`) backed by the `*Settings` singleton models. |

### `/admin` (dashboard)

`src/app/admin/page.tsx` → `requireAuth()` (any signed-in role) → `<DashboardView>`.

Rendered text (scratch DB with no bookings):

```
Dashboard Overview | Real-time metrics, recent bookings, check-in schedules, and operational alerts. |
Total Bookings | 0 | 0 | new this month | Revenue This Month | ৳0 | BDT calculated from active bookings |
Occupancy Rate | 0 | % | 0 | / | 8 | rooms booked | Operational Alerts | 0 | Issues requiring staff attention |
Payment Methods & Gateway Performance | Export CSV Report | bKash MFS | Active | Primary Tokenized Gateway | ৳0 |
Nagad MFS | Scaffold | Secondary MFS | BDT 0 | SSLCommerz | Scaffold | Card & Internet Banking | BDT 0 |
Recent Bookings | View All | … | No bookings found. | Upcoming Arrivals | No upcoming check-ins scheduled for today.
```

| KPI | Source | Computation (`src/app/admin/page.tsx`) | Problem |
|---|---|---|---|
| Total Bookings | `booking.count()` | All bookings ever, every status (`:11`) | Includes cancelled |
| New this month | `bookingsThisMonth.length` | Bookings **created** between server-local month start and end (`:13-24`) | Server-local time |
| Revenue This Month | `sumPoisha(totalAmountPoisha)` | Bookings **created** this month, status ≠ CANCELLED (`:26-30`) | **Booked value, not collected.** Includes PENDING and unpaid bookings, and ignores refunds. (F8) |
| Occupancy Rate | `roomsBookedThisMonth / room.count()` | Distinct **room types** with a CONFIRMED/CHECKED_IN/COMPLETED booking created this month, divided by the number of room types, rounded (`:32-39`) | Not occupancy: it counts types, not units or nights, over the wrong window. (F8) |
| Operational alerts | `room.availableUnits = 0 && isActive` + PENDING bookings older than 24 h (`:83-110`) | Counter-based and server-local | Tied to the counter (N1) |
| Recent bookings | Last 10 by `createdAt` | — | fine |
| Upcoming arrivals | CONFIRMED with `checkInDate >= server-local today`, 5 rows (`:59-73`) | — | Server-local time |
| **Payment Methods panel** | `DashboardView.tsx:219-278` | "bKash MFS Active" shows **Revenue This Month** (`:250`), i.e. booked value from every channel labelled as bKash. Nagad and SSLCommerz are hard-coded "Scaffold" / "BDT 0" (`:258-275`), although both are now live. | **Misleading** |
| Export CSV Report | `href="/api/admin/reports/payments?format=csv"` (`:228`) | That route needs MANAGER. The dashboard needs only `requireAuth`, so a STAFF user sees a link that returns 403. | Inconsistent guard |

### Timezone handling on date boundaries

- The dashboard uses `new Date(y, m, d)` with **server-local** time (`page.tsx:14-15,59`). The development Mac runs in `Asia/Dhaka` (`Intl…timeZone` → `Asia/Dhaka`), so the bug doesn't show locally.
- The Docker image sets no `TZ` (`Dockerfile`), so a container runs in **UTC**. There, "today" starts at 06:00 Dhaka time, and the month boundaries are also 6 h off.
- `docs/DEPLOYMENT.md:406` tells PM2 deployments to set `TZ=Asia/Dhaka`. That is a per-server convention and nothing in code enforces it.
- The existing explicit-timezone helper is **`src/lib/payments/nagad/time.ts`** (`Intl.DateTimeFormat` with `timeZone: "Asia/Dhaka"`), not `nagad/initialize-payment.ts` as the brief says. `src/components/seo/LastUpdated.tsx:16` also passes `timeZone: "Asia/Dhaka"` for display. See N6.

---

## 0.5 Role usage audit

Assigned users:
- **Local `resort_dev`:** 2 OWNER, 1 STAFF, and none of the other 7 roles.
- **Production:** unknown from here. The owner must run `select role, count(*) from "User" group by 1` on the VPS before Section 3's STAFF → FRONT_DESK update.

"Code paths" counts `"<ROLE>"` string literals in `src/`, excluding tests.

| Role | Users (local) | Code checks it | Sidebar items visible (`AdminShell.tsx`) |
|---|---|---|---|
| OWNER | 2 | 70 literals: all `requireRole("OWNER")` sites, `requireMfa` (2FA forced for OWNER only, `auth-helpers.ts:61`), blog `canEditSettings`, seed | All 7: Dashboard, Bookings, BanglaQR Queue, Blog Articles, Rooms, Guests, Settings |
| MANAGER | 0 | 55 literals: `requireRole("MANAGER")` sites, blog `isManagerOrOwner` | 6: everything except Settings |
| STAFF | 1 | 37 literals: `requireRole("STAFF")` sites, `getCurrentUser` default `\|\| "STAFF"` (`auth-helpers.ts:30`), Better Auth `defaultRole: "STAFF"` (`auth.ts:27`), Prisma `@default(STAFF)` | 5: Dashboard, Bookings, Blog Articles, Rooms, Guests |
| FRONT_DESK | 0 | **0** | 5 (treated as STAFF) |
| HOUSEKEEPING | 0 | **0** | 5 (treated as STAFF) |
| KITCHEN | 0 | **0** | 5 (treated as STAFF) |
| STOREKEEPER | 0 | **0** | 5 (treated as STAFF) |
| ACCOUNTANT | 0 | **0** (2 in tests) | 5 (treated as STAFF) |
| HR | 0 | **0** | 5 (treated as STAFF) |
| AUDITOR | 0 | **0** | 5 (treated as STAFF) |

Sidebar filtering (`src/components/admin/AdminShell.tsx:74-95`) keeps its own copy of `ROLE_HIERARCHY` (`STAFF 1, MANAGER 2, OWNER 3`) and computes `userLevel = ROLE_HIERARCHY[userRole] || 1`. The nav labels are hard-coded English (`:42-70`).

### Evidence: a new role gets STAFF write access today

This used a scratch user with `role = 'AUDITOR'` on the port-3100 production build (scratch DB):

```
signin 200
nav: ['Dashboard', 'Bookings', 'Blog Articles', 'Rooms', 'Guests']
/admin/bookings/new                      Offline Booking      ← rendered: AUDITOR can open the create-booking form
/admin/blog/new                          Write                ← rendered: AUDITOR can open the blog editor
/admin/settings                          NEXT_HTTP_ERROR_FALLBACK;403
/admin/payments/banglaqr-verification    NEXT_HTTP_ERROR_FALLBACK;403
```

(The root `loading.tsx` streams, so a `forbidden()` shows up as a 200 carrying the `NEXT_HTTP_ERROR_FALLBACK;403` digest rather than a 403 status. This is the same streaming behaviour recorded in A1 for redirects.)

So `requireRole("STAFF")` passes for all 7 new roles (`auth-helpers.ts:71`, `|| 1`). An AUDITOR, who is meant to be read-only, can create offline bookings, edit guest notes, move bookings to CHECKED_IN or COMPLETED, write blog drafts and upload images. `src/lib/auth-helpers.test.ts:67-68` currently **pins** this behaviour (`requireRole("STAFF")` resolves for ACCOUNTANT). No production user holds a new role yet, so nothing is exposed today. See N3.

---

## New findings that need a decision

Each finding has a recommendation. Unless the owner says otherwise, the recommendation is what the later sections will do.

| # | Finding | Affects | Recommendation |
|---|---|---|---|
| **N1** | `Room.availableUnits` is a **mutable stock counter**, not a physical-unit count. BanglaQR settlement and the payment webhook decrement it on confirmation and never increment it back. The PMS webhook and sync overwrite it with the PMS's availability figure. So in production it may be **lower than the number of physical rooms**, and it keeps changing after migration. | §1.3 seed and verify, §9.3 | **(a)** Before running the seed migration, the owner confirms the physical unit count per room type. A pre-flight script (`scripts/room-unit-preflight.ts`, read-only) prints `slug, availableUnits, confirmed bookings in the future` for review. If a count is wrong, the owner corrects it through the room form before deploying. **(b)** `verify_unit_count` asserts equality **at migration time only**. **(c)** After A2, availability reads unit rows. The payment code's decrement keeps writing the deprecated column (untouched, deferred), and nothing reads it for availability. §9.3 compares against the value **captured at migration time**, not the live column. **(d)** For clients with a PMS, the PMS figure is not a unit count. It is recorded as a limitation, and PMS-driven availability is re-designed in its own phase. |
| **N2** | `src/lib/payments/availability.ts` and `/api/payments/availability` are **gateway** availability, not room availability. Room availability is in `admin-actions.ts:84-93,458-469` and `api/bookings/route.ts:37`. | §1.4 | Put the new unit-based `getAvailableUnits()` in a new `src/lib/rooms/availability.ts`. Use it from `admin-actions.ts` and `api/bookings/route.ts`, which **makes the public API date-aware**: a behaviour fix, called out in the PR. Leave both payment files untouched. Per-unit availability is exposed through a new `GET /api/rooms/[roomId]/availability`, not through the payments endpoint. |
| **N3** | `requireRole` and `AdminShell` treat every new role as STAFF (`|| 1`). An AUDITOR can create bookings (evidence above). The TS `UserRole` type has 3 values, not 10. | §2, §3 | Section 2 makes unknown or unmapped roles **fail closed**: no fallback level, and `requireRole` uses the matrix. Replace `auth-helpers.test.ts:67-68` with a test asserting that the fallback is gone. Derive the TS `UserRole` from the Prisma enum. **Until Section 2 merges, do not assign any of the 7 new roles in production.** |
| **N4** | The brief's `Module` list has no **BLOG** module, but the blog has 24 guarded call sites, a nav item, and its own tested rules. | §2 | Add `BLOG` to the matrix, so the sidebar and new roles resolve correctly. Migrate the 24 blog **entry** guards to `requirePermission("BLOG", …)` in Section 2, since they are not payment code. Keep the per-post rules in `src/lib/blog/permissions.ts` as they are, called after the entry guard. *Alternative: add blog to the deferred list.* |
| **N5** | Deferred payment pages still check `requireRole("MANAGER"/"OWNER")` while the sidebar moves to the matrix. The two could disagree: a nav link that returns 403, or a hidden page that is reachable. | §2.3 | The matrix records the target mapping for deferred pages: BanglaQR Queue → `FINANCE.approve`; Payment settings → `SETTINGS.edit`. A unit test asserts that, for every role, "nav visible" ⇒ "legacy `requireRole` would pass". The two cannot drift until those files migrate. |
| **N6** | The timezone helper lives in payment code (`nagad/time.ts`). The brief says to "extract" it. | §6.3 | Create `src/lib/timezone.ts` (Dhaka day/month boundaries with `Intl`, no dependency). **Do not edit `nagad/time.ts`** (payment code). It can re-export from the new module when Nagad is next touched. |
| **N7** | The Resend sender `onboarding@resend.dev` is hard-coded in **9 places across 6 files**. Four of those files are payment email modules (`email/{bkash,nagad,sslcommerz,banglaqr}.ts`). | §4.4 | Add `getEmailFrom(label)` in `src/lib/email/sender.ts`, reading `RESEND_FROM_EMAIL` with the current default. Use it in the new invitation and reset emails, `email/index.ts` and `email/blog.ts`. The four payment email files are **deferred** under the standing rule. Document in `.env.example` that the variable only partially applies until they migrate. |
| **N8** | The new `RES-YYYYMM-NNNNN` format (16 chars) must survive payment-side derivations. | §8 | Checked, and **no payment change is needed**. The bKash, Nagad and SSLCommerz booking-code schemas allow `[A-Za-z0-9-]{3,32}` (`bkash/schemas.ts:15`, `nagad/schemas.ts:40`, `sslcommerz/schemas.ts:43`), and BanglaQR allows any 1–32 chars (`banglaqr/schemas.ts:15`). Nagad orderId: 14-char prefix + 4 hex = 18 ≤ 20 (`nagad/settlement.ts:43-45`). bKash invoice: `RES-202610-00001-ABCD` = 21 chars. SSLCommerz tran_id ≤ 64 (`sslcommerz/schemas.ts:24`). Existing `RES-######` codes stay valid, since codes are never re-parsed. The `bkash/schemas.ts:14` comment goes stale, which is harmless. |
| **N9** | The brief's user management relies on `User.active` and "last login". Neither field exists. Better Auth's admin plugin already has `banned` / `banReason` / `banExpires` (`schema.prisma:17-19`), and its `banUser` revokes sessions. | §4 | **Deactivate = `banned: true`** through the admin plugin, which blocks sign-in and revokes sessions, instead of a parallel `active` column. Pending invites use a new `Invitation` model rather than a half-created `User`. **Last login:** add a nullable `User.lastLoginAt`, set by a Better Auth `session.create.after` hook. Sessions are deleted on sign-out, so they can't be used for this. |
| **N10** | `Booking.room` stays `onDelete: Cascade`. The brief's `RoomUnit … Restrict` does **not** stop a room-type delete from wiping its bookings and payments. `prisma/seed.ts:342` `room.deleteMany()` will fail once units exist. | §1.1 | Also change `Booking.room` and `Booking.unit` to `Restrict`. This is a constraint change, not a data change, and no app code path deletes rooms. Update `seed.ts` to delete units and bookings first. Flagged here because it is a non-additive constraint change. |
| **N11** | Dashboard access and sidebar: under the brief's matrix FRONT_DESK and others lose `REPORTS.view`, so `/admin` (the post-login landing) would be forbidden to them. | §2.3, §6 | Add a role landing rule: after login, redirect to the first permitted nav item. FRONT_DESK → `/admin/bookings`. Keep `/admin` itself gated by `REPORTS.view`. |
| **N12** | "Collected revenue" needs a received-at time and a set of success statuses. `Payment` has no `receivedAt`. Gateways stamp `executedAt`, BanglaQR stamps `verifiedAt`, and cash rows only have `createdAt`. Statuses in use include `SUCCESS`, `COMPLETED`, `PAID` (cash, in local data), `REFUNDED`, `PARTIALLY_REFUNDED`. | §6.2 | Define it once in `04-DASHBOARD-METRICS.md`: collected = Σ `amountPoisha − refundedAmountPoisha` over payments in the success set, dated by `coalesce(executedAt, verifiedAt, createdAt)` in Dhaka time. No schema change. |
| **N13** | The dashboard's Payment Methods panel is fake, and its CSV link is under-guarded relative to the page. | §6.4 | Section 6 replaces the panel with real per-provider collected totals from N12. The panel is shown only to roles with `REPORTS.export`. |
| **N14** | STAFF → FRONT_DESK changes blog access. STAFF can author blog drafts today, and `blog/permissions.ts` checks the role literal. | §3.1 | The matrix grants FRONT_DESK the same BLOG actions STAFF has, so the migration is behaviour-neutral. The owner can remove them afterwards. |

---

## Scratch artefacts created by this audit

These are local only and were not committed.
- Database `resort_a2_test`: seeded demo data, plus a scratch OWNER and a scratch AUDITOR (`test-auditor@demo.resort`). It is safe to drop.
- The port-3100 server has been stopped.
- `resort_dev` was only read. `pnpm build` ran `migrate deploy` against it, which reported "No pending migrations".

## Next step

Once the owner approves this document, the next commit is `docs/rms/01-ROLES-AND-PERMISSIONS.md`, the permission matrix source of truth (adjustment A1). Section 1 starts after that.

---

## Appendix A — `pnpm build` raw output

```
$ prisma generate && prisma migrate deploy && next build
Loaded Prisma config from prisma.config.ts.

Prisma config detected, skipping environment variable loading.
Prisma schema loaded from prisma/schema.prisma

✔ Generated Prisma Client (v6.19.3) to ./node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_typescript@5.9.3__typescript@5.9.3/node_modules/@prisma/client in 331ms

Start by importing your Prisma Client (See: https://pris.ly/d/importing-client)

Tip: Need your database queries to be 1000x faster? Accelerate offers you that and more: https://pris.ly/tip-2-accelerate

Loaded Prisma config from prisma.config.ts.

Prisma config detected, skipping environment variable loading.
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "resort_dev", schema "public" at "localhost:5432"

19 migrations found in prisma/migrations


No pending migrations to apply.
▲ Next.js 16.3.5 (Turbopack)
- Environments: .env
✓ Running next.config.ts took 108ms
- Experiments (use with caution):
  ✓ authInterrupts
  · optimizePackageImports

⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.

  To migrate automatically, run:
  npx @next/codemod@canary middleware-to-proxy .

  Learn more: https://nextjs.org/docs/messages/middleware-to-proxy
  Creating an optimized production build ...
✓ Compiled successfully in 4.2s
  Running TypeScript ...
  Finished TypeScript in 12.5s ...
  Collecting page data using 7 workers ...
  Generating static pages using 7 workers (0/86) ...
  Generating static pages using 7 workers (21/86) 
  Generating static pages using 7 workers (42/86) 
  Generating static pages using 7 workers (64/86) 
✓ Generating static pages using 7 workers (86/86) in 1283ms
  Finalizing page optimization ...

Route (app)                                         Revalidate  Expire
┌ ○ /                                                       1h      1y
├ ○ /_not-found
├ ○ /about
├ ƒ /admin
├ ƒ /admin/blog
├ ƒ /admin/blog/[id]
├ ƒ /admin/blog/[id]/preview
├ ƒ /admin/blog/categories
├ ƒ /admin/blog/new
├ ƒ /admin/blog/pending
├ ƒ /admin/blog/pending/[id]
├ ƒ /admin/blog/settings
├ ƒ /admin/blog/tags
├ ƒ /admin/bookings
├ ƒ /admin/bookings/[id]
├ ƒ /admin/bookings/new
├ ƒ /admin/guests
├ ƒ /admin/login
├ ƒ /admin/payments/banglaqr-verification
├ ƒ /admin/rooms
├ ƒ /admin/rooms/[id]
├ ƒ /admin/settings
├ ƒ /admin/settings/integrations
├ ƒ /admin/settings/payments
├ ƒ /admin/setup-2fa
├ ○ /amenities
├ ƒ /api/admin/blog/images
├ ƒ /api/admin/payments/banglaqr/receipt-file
├ ƒ /api/admin/payments/bkash/test-connection
├ ƒ /api/admin/payments/nagad/test-connection
├ ƒ /api/admin/payments/refund
├ ƒ /api/admin/payments/sslcommerz/test-connection
├ ƒ /api/admin/payments/status
├ ƒ /api/admin/pms/test-connection
├ ƒ /api/admin/reports/payments
├ ƒ /api/auth/[...all]
├ ƒ /api/blog/submit
├ ƒ /api/bookings
├ ƒ /api/callback
├ ƒ /api/chat
├ ƒ /api/contact
├ ƒ /api/cron/banglaqr-release
├ ƒ /api/cron/banglaqr-retention
├ ƒ /api/cron/bkash-reconcile
├ ƒ /api/cron/blog-attempts-cleanup
├ ƒ /api/cron/fetch-google-reviews
├ ƒ /api/cron/nagad-reconcile
├ ƒ /api/cron/pms-sync
├ ƒ /api/cron/sslcommerz-reconcile
├ ƒ /api/payments/availability
├ ƒ /api/payments/banglaqr/generate-dynamic
├ ƒ /api/payments/banglaqr/submit-receipt
├ ƒ /api/payments/banglaqr/token
├ ƒ /api/payments/bkash/callback
├ ƒ /api/payments/bkash/create
├ ƒ /api/payments/bkash/token
├ ƒ /api/payments/nagad/callback
├ ƒ /api/payments/nagad/initialize
├ ƒ /api/payments/nagad/token
├ ƒ /api/payments/sslcommerz/cancel
├ ƒ /api/payments/sslcommerz/fail
├ ƒ /api/payments/sslcommerz/initiate
├ ƒ /api/payments/sslcommerz/ipn
├ ƒ /api/payments/sslcommerz/success
├ ƒ /api/payments/sslcommerz/token
├ ƒ /api/reviews/google
├ ƒ /api/webhooks/payment
├ ƒ /api/webhooks/payment/banglaqr
├ ƒ /api/webhooks/payment/bkash
├ ƒ /api/webhooks/pms/[provider]
├ ƒ /blog
├   /blog/[slug]
│ └ ● /blog/ultimate-coxs-bazar-travel-guide                1h      1y
├ ƒ /blog/category/[slug]
├ ƒ /blog/submit
├ ƒ /blog/submit/success
├ ƒ /blog/tag/[slug]
├ ƒ /book/[roomId]
├ ƒ /booking/confirmation/[id]
├ ○ /brand/logo.png
├ ○ /brand/logo.svg
├ ○ /contact
├ ○ /destinations                                           1h      1y
├   /destinations/[slug]
│ ├ ● /destinations/coxs-bazar                              1d      1y
│ ├ ● /destinations/sajek-valley                            1d      1y
│ ├ ● /destinations/sreemangal                              1d      1y
│ └ ● [+3 more paths]
├ ○ /dining
├ ○ /experiences
├ ○ /explore-the-area
├   /explore-the-area/[slug]
│ ├ ● /explore-the-area/lawachara-national-park
│ ├ ● /explore-the-area/madhabkunda-waterfall
│ ├ ● /explore-the-area/finlay-tea-estates
│ └ ● [+2 more paths]
├ ○ /faq
├ ○ /feed.xml                                               1h      1y
├ ○ /gallery
├ ○ /how-to-reach
├ ○ /icon
├ ○ /offers
├ ○ /opengraph-image
├ ○ /payment/banglaqr/reupload
├ ƒ /payment/bkash/result
├ ƒ /payment/nagad/result
├ ƒ /payment/sslcommerz/result
├ ○ /press-kit                                              1d      1y
├ ○ /press-kit/download                                     1d      1y
├ ○ /privacy
├ ○ /refund-policy
├ ○ /reviews                                                1h      1y
├ ○ /robots.txt
├ ○ /share-your-stay
├ ○ /sitemap.xml                                            1h      1y
├ ○ /style-guide
└ ○ /terms


ƒ Proxy (Middleware)

○  (Static)   prerendered as static content
●  (SSG)      prerendered as static HTML (uses generateStaticParams)
ƒ  (Dynamic)  server-rendered on demand
```

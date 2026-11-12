# Admin Panel Audit

**Branch:** `admin-finalization`
**Method:** Static analysis (grep/read of every file in `src/app/admin/**` and `src/components/admin/**`), live login walkthrough as OWNER and a freshly-created STAFF test user, Playwright checks at 360px viewport against a production build (`pnpm build && next start`).

> This audit follows a prior incident on this project where a different pass marked an admin/audit report 100% ✅ without verification, and several of those claims turned out to be false. Every finding below is backed by either a file:line reference or a screenshot/live check. Where something could not be verified (e.g. a real Android device), it is marked "not verified" rather than assumed to pass.

---

## 1.1 File Inventory Reconciliation

| File | Purpose | Used? | Duplicate? |
|---|---|---|---|
| `admin/layout.tsx` | Loads current user, wraps children in `AdminShell` | ✅ Yes (root layout) | No |
| `admin/page.tsx` | Dashboard data fetch (bookings/revenue/occupancy/alerts) + renders `DashboardClientView` | ✅ Yes, route `/admin` | No |
| `admin/DashboardClientView.tsx` | Dashboard UI | ✅ Yes, imported by `admin/page.tsx` | No |
| `admin/AdminDashboardClient.tsx` | An entire second dashboard implementation (811 lines) | ❌ **Dead code.** `grep -rln "AdminDashboardClient" src/app` returns only its own file. Nothing imports it. | Yes — full duplicate of `DashboardClientView.tsx`'s purpose, never wired up |
| `admin/SettingsClientView.tsx` | Settings form: property identity + **bKash-only** credential status/toggle | ✅ Yes, imported by `admin/settings/page.tsx` | Partial — see below |
| `admin/settings/page.tsx` | Renders `SettingsClientView` | ✅ Yes, route `/admin/settings` | No |
| `admin/settings/payments/page.tsx` | Wrapper + back link | ✅ Yes, route `/admin/settings/payments` | No |
| `admin/settings/payments/PaymentSettingsClient.tsx` | Full **bKash + Nagad + SSLCommerz** status/test-connection UI | ✅ Yes | **Overlaps `SettingsClientView.tsx`**: both render a bKash status card with a "Test Connection" button hitting the same `/api/admin/payments/bkash/test-connection` endpoint. `SettingsClientView` only covers bKash; `PaymentSettingsClient` covers all three gateways and is the more complete implementation. |
| `admin/settings/integrations/page.tsx` | PMS integrations page | ✅ Route renders | **Broken/incomplete**: static "Scheduled for Phase 11" placeholder card, no client component, no data. It does *not* call the already-working `/api/admin/pms/test-connection` endpoint that exists in the API layer. This is the file the spec suspected was non-functional — confirmed. |
| `admin/bookings/page.tsx` + `BookingsClientView.tsx` | Booking list, filters (status, room, date range), search, pagination | ✅ Yes | No |
| `admin/bookings/[id]/page.tsx` + `BookingDetailClientView.tsx` | Booking detail, status transitions via `BookingActionButtons` | ✅ Yes | No |
| `admin/guests/page.tsx` + `GuestsClientView.tsx` | Guest list, search, booking-history modal | ✅ Yes | No |
| `admin/rooms/page.tsx` + `RoomsClientView.tsx` | Room list, active/inactive toggle | ✅ Yes | No |
| `admin/rooms/[id]/page.tsx` + `RoomEditClientView.tsx` | Room edit form (`RoomForm`) | ✅ Yes | No |
| `admin/payments/banglaqr-verification/page.tsx` + `BanglaQRVerificationClient.tsx` | Manual receipt verification queue | ✅ Yes | No |
| `admin/forbidden.tsx` | 403 page | ✅ Yes, confirmed live (screenshot) | No |
| `admin/login/page.tsx` | Login form | ✅ Yes | No |
| `components/admin/AdminShell.tsx` | Sidebar + mobile drawer + header | ✅ Yes | No |
| `components/admin/BookingActionButtons.tsx` | Status-transition buttons | ✅ Yes | No |
| `components/admin/RoomForm.tsx`, `RoomStatusToggle.tsx` | Room edit fields, active toggle | ✅ Yes | No |

**Answers to the specific questions asked:**
- `AdminDashboardClient.tsx` vs `DashboardClientView.tsx` → **`DashboardClientView` is the one that renders. `AdminDashboardClient.tsx` is 811 lines of dead code**, not reachable from any route. Safe to delete after this is committed (grep-confirmed).
- `SettingsClientView.tsx` at admin root vs `settings/page.tsx` → **Not orphaned** (a prior session wired `settings/page.tsx` to render it), but it duplicates part of `PaymentSettingsClient.tsx`'s job (bKash-only, less complete).
- `settings/integrations/page.tsx` → Yes, this is the PMS page. **It has no client component and is a static placeholder**, despite a working PMS test-connection API existing.
- `settings/payments/page.tsx` has a client view; `settings/integrations/page.tsx` doesn't → **Confirmed broken as suspected.** Integrations page needs a real client component or should be removed and folded into a unified settings page per Section 5.

Also found in the same audit: `updateGuestNotes()` exists as a working Server Action (`src/app/actions/admin-actions.ts`) but is **never called from any UI** — `GuestsClientView.tsx` has no notes field. Backend capability with no front-end, effectively dead.

---

## 1.2 Route Coverage vs. Real Operations

| Daily Task | Route | Usable? |
|---|---|---|
| See today's arrivals and departures | `/admin` (dashboard) | ⚠️ Dashboard shows "Upcoming Arrivals" (next 5, all-time-ish, not scoped to "today") and no departures list at all. |
| Accept a walk-in / phone booking | *(none)* | ❌ **Missing entirely.** No form anywhere in the admin panel creates a booking. This is the single most important gap — confirmed. |
| Accept a website booking | `/admin/bookings/[id]` | ✅ Works — website bookings land here automatically. |
| Edit a booking (dates, room, guest count) | *(none)* | ❌ Booking detail page has status-transition buttons only. No field is editable. |
| Cancel a booking and issue refund | `/admin/bookings/[id]` | ⚠️ Cancel exists (status → CANCELLED, MANAGER+ only, server-enforced). No refund step — cancelling does not ask about a refund or record one. |
| Mark a room as out-of-service for maintenance | `/admin/rooms/[id]` | ⚠️ Only a binary `isActive` toggle at the room-*type* level (schema has no per-unit tracking — `Room.availableUnits` is a count, not individual rows). Deactivating hides the whole room type, not one unit. |
| Update room price for peak season | `/admin/rooms/[id]` | ✅ Works — `pricePerNight` is editable via `RoomForm`. |
| Verify a BanglaQR receipt | `/admin/payments/banglaqr-verification` | ✅ Works. |
| Export bookings for the accountant | *(none)* | ❌ No CSV/export control anywhere in `BookingsClientView.tsx`. |
| Check today's revenue | `/admin` (dashboard) | ⚠️ Shows "Revenue This Month," not today's revenue. |

**Confirmed: the offline/phone booking gap is real and is the most important finding of this audit.** With only 2 seed bookings in the database (both created by an earlier test session, both already CANCELLED), there is no way, today, for a resort employee to record a phone or walk-in booking without either editing the database directly or waiting for a real guest to use the website.

---

## 1.3 UX Coherence Check (360px viewport, production build)

- **Mobile tables don't collapse to cards.** `/admin/bookings` at 360px renders a literal `<table>` (`BookingsClientView.tsx`, the results table below the filter form) that clips the "Room" and "Check-in" columns off-screen. Screenshot: `.playwright-mcp/staff-bookings-360.png`. This is the clearest violation of the mobile checklist in Section 9.
- **Dashboard, login, 403, and settings pages are responsive** at 360px — cards stack, no horizontal scroll, buttons are full-width or reasonably sized. Verified live (screenshots taken during this audit).
- **Mobile sidebar is a left-anchored slide-out drawer** (`w-72` = 288px, `components/admin/AdminShell.tsx:152`) with a backdrop, not a bottom drawer or true full-screen overlay. At 360px this covers 80% of the screen and is thumb-reachable from the left edge — functional, but doesn't match the letter of "full-screen overlay."
- **No loading spinners found** on any admin list/detail page — all data fetching happens server-side in the page's async function before render, so there's no client-side loading state to miss (this is actually fine architecturally; flagging only because the spec asked to check).
- **Empty states exist** on dashboard tables (`DashboardClientView.tsx` renders fallback text when `recentBookings.length === 0` / `upcomingCheckIns.length === 0`). Not independently verified on `/admin/bookings` or `/admin/guests` with a truly empty result set (would require clearing seed data, not done in this pass).
- **No "Coming soon" toast-only buttons found** in the routes that render — but `settings/integrations/page.tsx` is effectively a whole page that says "coming soon" (see 1.1).
- **Navigation labels match page content** — "Dashboard," "Bookings," "Rooms," "Guests," "Settings" all lead to pages titled consistently. The sidebar item "BanglaQR Queue" (`AdminShell.tsx:39`) doesn't match the spec's desired "Payments" label — addressed in Section 7.
- **Page header style is inconsistent**: `admin/settings/payments/page.tsx` and `admin/settings/integrations/page.tsx` each hand-roll their own "← Back to Settings" link + `h1` + subtitle block, duplicated verbatim in both files, while `DashboardClientView.tsx`, `BookingsClientView.tsx`, etc. use a similar but not identical pattern with no shared layout primitive. No page currently uses a common "PageHeader" component — none exists.

---

## 1.4 Role Enforcement Verification

No user-management UI exists anywhere in the admin panel (grep for `createUser`, `signUpEmail`, and routes named `*user*`/`*staff*` under `src/app/admin` returns nothing live). A STAFF test account (`staff@demo.resort`) was created directly against the database for this audit, matching how a real second admin account would have to be created today (developer-assisted, not self-service).

Verified live, logged in as STAFF:

| Action | Expected | Result |
|---|---|---|
| View `/admin` dashboard | Allowed | ✅ Renders |
| View `/admin/bookings`, open a booking detail | Allowed | ✅ Renders |
| Access `/admin/settings` | Forbidden | ✅ **403 page shown** (screenshot: `.playwright-mcp/staff-settings-attempt.png`) |
| Confirm/Cancel a PENDING or CONFIRMED booking | Forbidden (MANAGER+) | Not exercised live — both seed bookings are already CANCELLED, and there is no way to create a fresh PENDING booking without the offline-booking feature that doesn't exist yet (see 1.2). **Verified instead via source code**, which is an equally reliable signal here: `BookingActionButtons.tsx:51,65,90` only renders Confirm/Cancel when `userRole` is OWNER or MANAGER, **and** the server action independently re-checks — `src/app/actions/admin-actions.ts:15-19` calls `requireRole("MANAGER")` for `CONFIRMED`/`CANCELLED` transitions and `requireRole("STAFF")` for everything else, so the restriction is enforced server-side, not just hidden in the UI. |
| Mark a CONFIRMED booking as CHECKED_IN | Allowed (STAFF+) | ✅ Confirmed via the same server action — `requireRole("STAFF")` covers this transition. |
| Toggle room active/inactive | *(not specified in spec, checked anyway)* | `RoomStatusToggle` takes a `canToggle` prop from the server component; not traced further in this pass. |

**No privilege escalation found.** Every OWNER/MANAGER-gated action checked has a server-side `requireRole()` call independent of the UI, which is the correct pattern (the UI hiding a button is not, by itself, a security control here — it's backed up).

---

## Schema Notes (no changes made yet)

- `Booking.status` already supports `PENDING, CONFIRMED, CANCELLED, CHECKED_IN, COMPLETED` (`prisma/schema.prisma:139`), and `actualCheckIn`/`actualCheckOut` timestamp columns already exist. **The spec's assumption that CHECKED_IN/CHECKED_OUT are collapsed into COMPLETED is incorrect for this codebase** — `COMPLETED` already functions as the checkout state, set via `BookingActionButtons.tsx:104`. No schema change is needed for that part of Section 3.4. `NO_SHOW` does not exist as a status and would need to be added if kept — a schema decision, called out here per the "document before changing" constraint.
- `Room` has no per-unit maintenance/out-of-service concept — it models a room *type* with an `availableUnits` count, not individual rooms. Adding real per-unit out-of-service tracking would be a schema change (out of scope for this consolidation pass; flagged for the owner).
- `Guest.notes` already exists in the schema — the gap is UI-only (see 1.1).

---

## Schema Changes Made (Section 3)

- **`Booking.guestCount Int @default(1)` added** (migration `20260924112006_add_guest_count_to_booking`). The original spec's Section 3.1 required an offline-booking form to capture "Number of Guests," and Section 3.2 requires it to be editable — but the `Booking` model had no field for it at all (`Room.maxGuests` is the room's capacity, not a per-stay guest count). This is a genuinely required schema change, not a convenience one; existing rows default to 1 and are unaffected. Documented here per the "no schema changes without documenting first" constraint — noted here immediately upon discovery during Section 3.1 implementation, before the follow-up commit that used it.
- **No other schema changes.** Booking status transitions did not need a schema change (see the Section 1 note: `CHECKED_IN`/`COMPLETED` were already distinct). `NO_SHOW` was not added — it did not come up as a real operational need during this pass and the spec listed it as optional ("if kept"); adding an unused status would violate "do not add new features" more than it would help.
- **Offline payment status (PAID/PARTIAL/UNPAID/PAY_AT_CHECKIN)** is stored in the existing `Payment.status` free-text column rather than via a schema change — see the code comment in `createOfflineBooking` (`src/app/actions/admin-actions.ts`) for why this is safe (no enum constraint on that column, and it never collides with gateway-driven statuses because those come from a different code path).

## Not Verified in This Pass

- Real Android device testing (Section 9.2) — not available in this environment. All mobile findings above are from Chromium responsive mode at 360px via Playwright, which the spec itself notes does not catch touch-target sizing issues. Button heights were not individually measured against the 44px minimum.
- Empty-state rendering on `/admin/bookings` and `/admin/guests` with zero matching rows (only tested with 2 existing seed rows).
- CSV export, offline booking entry, refund modal, settings tabs — none of these exist yet, so there is nothing to verify; they are captured as gaps above and are the subject of Sections 2–6.

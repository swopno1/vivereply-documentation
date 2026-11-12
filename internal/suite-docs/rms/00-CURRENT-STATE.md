# 00 — Current State Audit

> **Purpose.** Record exactly what the admin panel, data model and infrastructure look like *today*, before any RMS work begins. Every later document in `docs/rms/` builds on this one. If something here is wrong, the error carries into every plan that depends on it.
>
> **Method.** Every item was checked by reading source files and running `grep`/`find` against the tree. No prior report (`docs/archive/ADMIN-AUDIT.md`, `docs/archive/PROJECT-STATUS.md`, `docs/archive/FINAL-AUDIT.md`, etc.) was trusted.
>
> **Audited tree:** branch `main` @ `791b8d3` ("docs: organic search submission report and verification results"), audited 2026-09-28. The `src/app/admin` tree is identical on `organic-search`.
>
> **Legend:** ✅ Confirmed in code · ❌ Not found · ⚠️ Exists but differs materially from what the RMS brief assumes

---

## Post-A1 Update (2026-09-29, branch `phase-a1-foundation`)

The audit below still describes `main` as it was before Phase A1. Once the Phase A1 PR is merged, these findings are resolved:

| Finding | Status | How | Details |
|---|---|---|---|
| **F1** Unauthenticated `/api/admin/*` | ✅ Resolved | Hotfix PR #75 removed the 8 dead routes and guarded the 9th. A1 extends `middleware.ts` to `/api/admin/*` with server-side session validation (forged cookie → 401), and `pnpm lint` fails on any unguarded admin, cron or webhook route or admin Server Action. | [phase-a1/02-VERIFICATION.md](phase-a1/02-VERIFICATION.md) |
| **F2** SQLite | ✅ Resolved | PostgreSQL 16 datasource. Local via `docker-compose.dev.yml`. SQLite data copied with `scripts/migrate-sqlite-to-postgres.ts`. | same |
| **F3** Money as `Float` | ✅ Resolved | Integer `*Poisha` columns, backfilled by migration. Every read uses them. The Float columns stay (deprecated, kept in step by `src/lib/money-legacy.ts`) until a cleanup release drops them. | same |
| **F4** `db push` / drifted migrations | ✅ Resolved | One re-baselined PostgreSQL init migration plus two additive money migrations. Deploys run `pnpm db:deploy` (`prisma migrate deploy`) before the build. A test fails on schema/migration drift. | same |
| **F9** No tests | ✅ Resolved | Vitest: 48 tests (money, auth guards, migration drift). | same |
| F5 Room types only, no `RoomUnit` | Open | Phase A2 | — |
| F6 Missing admin routes | Open | Later phases | — |
| F7 No user management; settings Save is a no-op | Open | Phase A2 | — |
| F8 Dashboard KPI definitions | Open | The dashboard now reads paisa, but still sums booked value, not collected revenue | — |
| F10 Random `bookingCode` collisions | Open | Phase B | — |

New issues found and fixed during A1 (not in the list below):
- **The PMS webhook** accepted unauthenticated `booking.created` requests when `PMS_WEBHOOK_SECRET` was unset. It now rejects them.
- **Self-signup** is disabled (§5 below).
- **OWNER accounts** must enable 2FA before reaching settings.

---

## 1. Headline findings

These change the RMS plan and must be read before anything else.

| # | Finding | Severity | Consequence for the RMS |
|---|---|---|---|
| F1 | **Nine `/api/admin/*` route handlers have no authentication.** `middleware.ts` only matches `/admin/:path*`, which does not cover `/api/admin/*`. Anyone on the internet can change a booking's status, create, edit or delete rooms and destinations, and download every lead (name, phone, email). None of these routes has a caller in the UI. See §4. | **Critical (security)** | First task of Phase A: delete the dead routes or put guards on them. Add a lint/test rule so that every `api/admin` handler calls a guard. |
| F2 | The database is **SQLite** (`prisma/schema.prisma:6`). | High | Decision taken: move to **PostgreSQL** in Phase A, before any financial tables exist. |
| F3 | All money is stored as **`Float`** (`Room.pricePerNight`, `Booking.totalAmount`, `Payment.amount`). | High | New models use `Int` poisha. Existing columns get `*Poisha` shadow columns, backfilled without changing the old columns. See 03. |
| F4 | `pnpm build` runs **`prisma db push`**, not `migrate deploy` (`package.json:10`). `main` has only **3 migrations**, and the blog models (`BlogPost`, `BlogImage`, `BlogCategory`, `BlogTag`, `BlogSettings`, `BlogSubmissionAttempt`) and `ProcessedWebhook` exist in the schema **with no migration**. | High | Migration history no longer matches the schema. It must be re-baselined as part of the Postgres move. The build must switch to `migrate deploy`. |
| F5 | `Room` is a **room type**, not a physical room. It has an `availableUnits: Int @default(5)` counter (`schema.prisma:111`). No room numbers exist anywhere. | High | A new `RoomUnit` model is a prerequisite for room assignment, the status board, housekeeping, room moves and the Daily Sheet. |
| F6 | Several routes the brief assumes exist are **not on `main`**: `/admin/dashboard`, `/admin/booking-portal`, `/admin/daily-sheet`, `/admin/finance`, `/admin/reports`, `/admin/stakeholder`, `/admin/messages`. Some exist on older, unmerged branches (§11). | Medium | These are new work, not extensions. Scope and estimates in 06/08 reflect that. |
| F7 | There is **no user-management UI**. The settings page has no tabs, and its Save button does nothing (`SettingsClientView.tsx:64-67` only toggles a "saved" banner). | Medium | Users, invitations and role assignment are new work in Phase A. |
| F8 | Dashboard KPIs are **not true metrics**. "Revenue this month" sums `totalAmount` of bookings *created* this month (booked value, not earned or collected). "Occupancy" is the number of distinct *room types* booked divided by the number of room types. Month boundaries use server-local time, not Asia/Dhaka (`src/app/admin/page.tsx:12-36`). | Medium | 09 and the reporting design redefine occupancy, ADR, RevPAR and revenue. The current numbers must not be carried into owner reports. |
| F9 | **No test framework** is installed (no vitest/jest/playwright in `package.json`). | Medium | Phase A adds one. See 13. |
| F10 | `bookingCode` is `RES-` plus a random 6-digit number (`admin-actions.ts:81`) with a unique constraint and no retry. A collision throws an error. | Low | Replace with a sequence-based code during Phase B, and use the same approach for invoice and PO numbers. |

---

## 2. Admin pages (`src/app/admin/**/page.tsx`)

| Brief assumes | Status | What actually exists | Guard |
|---|---|---|---|
| `/admin/dashboard` | ⚠️ | No such route. The dashboard is **`/admin`**: `src/app/admin/page.tsx` (server data) and `DashboardView.tsx` (403 lines). It shows total bookings, revenue this month, occupancy rate, operational alerts (a room type with 0 units, unpaid bookings older than 24h), recent bookings and upcoming arrivals. | `requireAuth()` |
| `/admin/booking-portal` | ❌ | — | — |
| `/admin/bookings` | ✅ | `bookings/page.tsx` and `BookingsView.tsx`: list with filters | `requireAuth()` |
| `/admin/bookings/[id]` | ✅ | `BookingDetailView.tsx` (874 lines): edit booking, status actions via `BookingActionButtons`, cancel with a refund decision, booking log timeline, payment list | `requireAuth()` (actions are guarded individually) |
| `/admin/bookings/new` | ✅ (not in brief) | Offline or phone booking entry (`NewBookingView.tsx`) | `requireRole("STAFF")` |
| `/admin/daily-sheet` | ❌ | — | — |
| `/admin/rooms` | ⚠️ | `rooms/page.tsx` and `RoomsView.tsx`: list of **room types**, with an active/inactive toggle | `requireAuth()` |
| `/admin/rooms/[id]` | ✅ | `RoomEditView.tsx` and `RoomForm.tsx`: room type editor | `requireRole("MANAGER")` |
| `/admin/guests` | ✅ | `GuestsView.tsx`: searchable list, notes editing | `requireAuth()` |
| `/admin/customers` | ❌ | — | — |
| `/admin/finance` | ❌ | Nothing under this path. The closest match is below. | — |
| `/admin/payments/banglaqr-verification` | ✅ (not in brief) | Manual BanglaQR receipt verification queue: confirm, reject, request receipt | `requireRole("MANAGER")` |
| `/admin/reports` | ❌ | No page. Only `api/admin/reports/payments` exists (§4). | — |
| `/admin/stakeholder` | ❌ | — | — |
| `/admin/messages` | ❌ | — | — |
| `/admin/settings` | ⚠️ | A single `SettingsClientView` with **no tabs**. Save is a no-op (F7). | `requireRole("OWNER")` |
| `/admin/settings/payments` | ✅ | Payment gateway settings and bKash, Nagad and SSLCommerz connection tests | `requireRole("OWNER")` |
| `/admin/settings/integrations` | ✅ | PMS integration settings | `requireRole("OWNER")` |
| settings "pms" tab | ⚠️ | Exists as the `/settings/integrations` page, not a tab | — |
| settings "users" tab | ❌ | No user list, invitations or role assignment anywhere | — |
| `/admin/blog/*` | ✅ (not in brief) | 9 pages: list, new, `[id]`, preview, categories, tags, pending, `pending/[id]`, settings | Mixed. `categories` and `tags` pages have no page-level guard; their actions guard instead. |
| `/admin/login` | ✅ | Email and password login with 2FA | Public |
| `forbidden.tsx` | ✅ | Rendered by `forbidden()` from `requireRole`. Enabled by `experimental.authInterrupts` in `next.config.ts`. | — |

Route-level guards are inconsistent. Several pages use `requireAuth()` (any logged-in user) and rely on each action to check the role. The RMS standard (01) will be: **every page calls `requirePermission(module, "view")`, and every action calls `requirePermission(module, action)`.**

---

## 3. Server Actions (`src/app/actions/`)

### 3.1 `admin-actions.ts` (706 lines)

| Action | Line | Guard | Writes audit? |
|---|---|---|---|
| `createOfflineBooking` | 32 | `STAFF` | ✅ BookingLog + AuditLog, in a transaction |
| `updateBookingStatus` | 173 | `MANAGER` for some statuses, `STAFF` for others | ✅ |
| `toggleRoomStatus` | 233 | `OWNER` | ✅ AuditLog |
| `createOrUpdateRoom` | 260 | `MANAGER` | ✅ |
| `updateGuestNotes` | 334 | `STAFF` | ✅ |
| `confirmBanglaQRPaymentAction` | 361 | `MANAGER` | ✅ (via the BanglaQR lib) |
| `rejectBanglaQRPaymentAction` | 385 | `MANAGER` | ✅ |
| `requestBanglaQRReceiptAction` | 409 | `MANAGER` | ✅ |
| `releaseExpiredBanglaQRBookingsAction` | 434 | `OWNER` | ✅ BookingLog |
| `updateBooking` | 492 | `MANAGER` | ✅ in a transaction |
| `cancelBookingWithRefundDecision` | 633 | `MANAGER` | ✅ in a transaction |

These are the pattern to follow: guard, then transaction, then domain log plus AuditLog. The RMS keeps this pattern and centralises it in a helper (03 §Conventions).

### 3.2 Other action files
- ✅ `blog-actions.ts` (467 lines): blog CRUD and moderation, writes AuditLog.
- ✅ `guest-submission-actions.ts` (233 lines): public guest blog submissions.

---

## 4. Admin API routes (`src/app/api/admin/**/route.ts`)

| Route | Methods | Guard | UI callers | Status |
|---|---|---|---|---|
| `bookings` | PATCH (set any status) | **none** | none | 🔴 **Unauthenticated write** |
| `bookings/[id]` | PATCH | **none** | none | 🔴 **Unauthenticated write** |
| `destinations` | GET, POST | **none** | none | 🔴 **Unauthenticated write** |
| `destinations/[id]` | PATCH, DELETE | **none** | none | 🔴 **Unauthenticated delete** (cascades to rooms and bookings through `onDelete: Cascade`) |
| `leads` | GET (all leads) | **none** | none | 🔴 **Unauthenticated PII read** |
| `leads/[id]` | PATCH | **none** | none | 🔴 **Unauthenticated write** |
| `rooms` | GET, POST, PATCH | **none** | none | 🔴 **Unauthenticated write** |
| `rooms/[id]` | PATCH, DELETE | **none** | none | 🔴 **Unauthenticated delete** (cascades to bookings) |
| `pms/test-connection` | POST | **none** | settings/integrations | 🟠 Unauthenticated outbound call |
| `payments/refund` | POST | `OWNER` | booking detail | ✅ |
| `payments/status` | GET | `MANAGER` | — | ✅ |
| `payments/{bkash,nagad,sslcommerz}/test-connection` | POST | `MANAGER` | settings | ✅ |
| `reports/payments` | GET | `MANAGER` | — | ✅ |

**Why the middleware doesn't protect these:** `src/middleware.ts` has `matcher: ["/admin/:path*"]`, so `/api/admin/...` never reaches it. Even for `/admin/*` pages, the middleware only checks that a session cookie is *present*, not that it is valid. The real protection is the guard called in each page or action.

> **Note on scope:** this planning branch changes no code. F1 is recorded here and as the first task in 08 (`A-001`). It should be fixed as a hotfix on `main` straight away, not left waiting for Phase A.

---

## 5. Roles and authentication

| Item | Status | Evidence |
|---|---|---|
| Better Auth | ✅ | `src/lib/auth.ts`, using the `prismaAdapter(prisma, { provider: "sqlite" })` adapter |
| Email and password login | ✅ | `emailAndPassword.enabled: true` |
| Two-factor (TOTP and backup codes) | ✅ | `twoFactor({ issuer: "ResortAdmin" })` plus the `TwoFactor` model |
| Better Auth `admin` plugin | ✅ | `admin({ defaultRole: "STAFF" })`. It provides ban, impersonate, `setRole` and `listUsers` APIs, and supports **comma-separated multiple roles** in `User.role`. **No UI uses any of this yet.** |
| Role `OWNER` | ✅ | `src/lib/auth-helpers.ts:5` |
| Role `MANAGER` | ✅ | same |
| Role `STAFF` | ✅ | same, and the default for new users |
| Any other role | ❌ | — |
| Role storage | ⚠️ | `User.role String? @default("STAFF")`. A free-text string with no enum and no DB constraint. |
| `requireRole()` | ✅ | `auth-helpers.ts:53`. Numeric hierarchy `STAFF 1 < MANAGER 2 < OWNER 3`. Checks "at least this role", calls `forbidden()` on failure. Unknown roles fall back to level 1. |
| `requireAuth()` / `getCurrentUser()` | ✅ | `auth-helpers.ts:15,39`. Redirects to `/admin/login`. |
| Permission-based checks (module × action) | ❌ | Only the hierarchy exists. It can't express "ACCOUNTANT may approve expenses but not create bookings". |
| Role-based sidebar | ✅ | `AdminShell.tsx:37-70` `NAV_ITEMS[].minRole`, filtered at `:91`. The hierarchy is **duplicated** in `AdminShell.tsx:72-76`. |
| Sidebar labels translated | ❌ | `NAV_ITEMS` titles are hard-coded English, even though `t.adminShell.*` keys exist in `en.ts:215` (including unused `users` and `audit` keys). |
| User invitation | ❌ | — |
| Self-signup | ⚠️ | Better Auth `emailAndPassword` allows sign-up by default. There is no sign-up UI, but the endpoint under `/api/auth/*` is reachable. **Must be disabled** (`disableSignUp`) when invitations ship. |
| `Session`, `Account`, `Verification`, `TwoFactor` models | ✅ | `schema.prisma:32-80` |

---

## 6. Data models (`prisma/schema.prisma`, 393 lines)

| Model | Status | Key fields | RMS gaps |
|---|---|---|---|
| `User` | ✅ | id, name, email, `role String?`, banned, twoFactorEnabled | No staff profile, phone, or active or department flags. Roles held as a string. |
| `Session` | ✅ | token, expiresAt, ipAddress, userAgent, impersonatedBy | — |
| `Account` | ✅ | providerId, password hash | — |
| `Verification` | ✅ | identifier, value, expiresAt | Can be reused for invitation tokens |
| `TwoFactor` | ✅ | secret, backupCodes | — |
| `Destination` | ✅ | slug, name, location, JSON-string image and amenity arrays | Marketing entity. There is one property per deployment. |
| `Room` | ⚠️ | title, slug, `pricePerNight Float`, maxGuests, `availableUnits Int`, isActive | This is a **room type**. No physical units, housekeeping status, floor/block or rate plans (F5). |
| `Guest` | ✅ | fullName, email, phone, nidOrPassport, address, notes | No dedup key (the same phone can create multiple guests), no preferences or blacklist. Offline bookings with no email get a placeholder email `<code>@no-email.local` (`admin-actions.ts:86`). |
| `Booking` | ⚠️ | bookingCode, roomId, guestId, checkIn/OutDate, guestCount, `totalAmount Float`, `status String`, actualCheckIn/Out | No source, room unit, group, corporate account, discount, tax breakdown, balance or folio. Status is a free string (`PENDING, CONFIRMED, CANCELLED, CHECKED_IN, COMPLETED`). There is no `NO_SHOW`. **`onDelete: Cascade` from Room and Guest.** Deleting a room type deletes its bookings and payments, which is unacceptable once accounting exists. |
| `BookingLog` | ✅ | bookingId, action, note, userId | Per-booking activity log. Keep it. |
| `Payment` | ⚠️ | provider, paymentId, transactionId, `amount Float`, `status String` | No cash or bank-transfer method, no received-by, no link to a folio or journal. Cascades from Booking. |
| `PaymentLog` | ✅ | gateway request/response events | Gateway diagnostics. Keep it. |
| `Lead` | ✅ | name, phone, type, status | Marketing. Out of RMS scope, but its API is exposed (F1). |
| `GoogleReviewCache` | ✅ | reviewId, rating, text | Marketing. Out of RMS scope. |
| `AuditLog` | ⚠️ | userId, action, entity, entityId, `metadata String?` (JSON), createdAt | No before/after diff, IP, user agent or module column. No index on `(entity, entityId)` or `createdAt`. Extended additively in 03. |
| `Blog*` (6 models, 2 enums) | ✅ | — | Out of RMS scope. Their conventions (`createdBy`, `archivedAt`, `@@index`) are the model for new RMS tables. |
| `ProcessedWebhook` | ✅ | provider, `transactionId @unique` | An idempotency guard for webhooks. The same pattern is used for RMS postings. |
| Role / Permission | ❌ | — | Design choice in 01/03: permissions live in code, not tables, for v1. |

**Enums:** Prisma enums are used only for blog (`BlogPostStatus`, `BlogPostSource`). All operational statuses are free strings. New RMS models use Prisma enums, which become native enums on Postgres.

**Money:** `Float` everywhere (F3). **Dates:** `DateTime` with no timezone convention. Business-date logic uses server-local time (F8).

---

## 7. Infrastructure

| Item | Status | Evidence / notes |
|---|---|---|
| Next.js App Router | ✅ | `next` 16.3.5, React 19.2.8 |
| Prisma | ✅ | 6.19.3, `prisma-client-js` generator |
| Prisma migrations | ⚠️ | 3 migrations (`init`, `add_payment_id_to_payment`, `add_guest_count_to_booking`). The build uses `db push` instead (F4). |
| Seeds | ✅ | `prisma/seed.ts` + `seed-demo-bookings` / `seed-test-users` / `seed-operations` modules (`pnpm db:seed`); `prisma/seed-admin.ts` is the separate production first-OWNER bootstrap |
| Server Actions | ✅ | §3 |
| Email (Resend) | ✅ | `src/lib/email/index.ts` sends through raw `fetch` to `api.resend.com` (no SDK). Six templated senders. The **sender is hard-coded** as `onboarding@resend.dev` (`:87`), which is a sandbox address unsuitable for staff invitations. |
| SMS / WhatsApp sending | ❌ | Only `wa.me` links on the public site |
| File storage (R2 / S3) | ✅ | `src/lib/storage/r2.ts`, used for blog images. Reusable for receipts and attachments. |
| Cron jobs | ✅ | `api/cron/banglaqr-release`, `fetch-google-reviews`, `pms-sync`, protected by `src/lib/cron-auth.ts` (fails closed without `CRON_SECRET`). The scheduler is external (see `docs/DEPLOYMENT.md`). |
| PMS integration | ✅ | `src/lib/pms/` (adapter interface, `sync-engine.ts`, one adapter: `gyoroom-adapter.ts`), with a webhook at `api/webhooks/pms/[provider]` |
| Payment gateways | ✅ | bKash, Nagad, SSLCommerz, BanglaQR (`src/lib/payments/`). Webhooks are idempotent via `ProcessedWebhook`. |
| Payment availability check | ✅ | `src/lib/payments/availability.ts` and `api/payments/availability`. Counts against `Room.availableUnits`. |
| Deployment | ✅ | BDIX VPS, PM2 or Docker, Nginx (`docs/DEPLOYMENT.md`, `Dockerfile`, `ecosystem.config.js`). Cloudflare is DNS-only. |
| Error monitoring | ❌ | No Sentry or other tool wired into the app |
| Backups | ❌ | No backup job or restore procedure in the code. SQLite is a single file, `prisma/dev.db`. |
| Tests | ❌ | No test runner or test files (F9) |
| Lint | ✅ | `pnpm lint` (ESLint 9, `eslint-config-next`) |
| `optimizePackageImports` | ✅ | `next.config.ts:16` |
| Validation library | ✅ | `zod` ^3.23.8 is installed. Admin actions validate partly by hand. |
| Date library | ✅ (none) | Native `Date` only, as `CLAUDE.md` requires. `Intl.DateTimeFormat` with `Asia/Dhaka` is used only in `src/lib/payments/nagad/initialize-payment.ts`. |

---

## 8. Internationalisation

| Item | Status | Evidence |
|---|---|---|
| `src/content/en.ts` / `bn.ts` | ✅ | 784 and 783 lines, in parallel structure |
| Admin string groups | ✅ | `adminShell`, `adminPage`, `adminDashboard`, `adminBookings`, `adminBookingDetail`, `adminBookingNew`, `adminRooms`, `adminRoomEdit`, `adminGuests`, `adminSettings` |
| `useTranslation()` hook | ✅ | `src/content/useTranslation.ts`. Used by DashboardView, SettingsClientView and others. |
| Language switcher in admin | ✅ | `AdminShell.tsx:278` |
| Fully translated admin | ⚠️ | Sidebar labels and some badges are hard-coded in English (§5) |
| Bengali numerals and dates | ⚠️ | `src/lib/formatters.ts` exists. Its coverage for ৳ amounts and Bengali digits needs checking in Phase A. |

---

## 9. Brand config and feature flags

| Item | Status | Evidence |
|---|---|---|
| `brand.config.ts` | ✅ | `src/components/brand/brand.config.ts` (333 lines). A typed `BrandConfig`, where `brandConfig = defaultBrandConfig`. |
| `features` flags | ✅ | `interactiveMap`, `googleReviews`, `areaGuideMap`, `aiChatbot`. All relate to the public site. |
| `rms` section | ❌ | — |
| Payment gateway toggles | ✅ | `payments.{bkash,nagad,sslcommerz,banglaqr}.enabled` |
| Property facts useful to the RMS | ✅ | `property.checkinTime` / `checkoutTime` (14:00 / 11:00), `policies.earlyCheckIn` / `lateCheckOut` with fees in BDT, and `policies.children.extraBedFeeBdt`. These are the source values for early check-in and late check-out charges in the folio. |
| Runtime-editable settings | ❌ | Config is compiled in. Changing a flag requires a redeploy. The one exception is blog settings (the `BlogSettings` singleton table). |

---

## 10. Reusable UI building blocks

| Component | Path | Use in the RMS |
|---|---|---|
| `AdminShell` | `src/components/admin/AdminShell.tsx` | Extend it: permission-driven nav, grouped sections, mobile bottom bar |
| `PageHeader` | `src/components/admin/PageHeader.tsx` | `{ title, subtitle, action }`. The standard page header (11). |
| `EmptyState` | `src/components/ui/EmptyState.tsx` | The standard empty state (11) |
| `Skeleton` | `src/components/ui/skeleton.tsx` | Loading states |
| `Card`, `Badge`, `Button`, `Input`, `Dialog`, `Sheet`, `Tabs` | `src/components/ui/` | The shadcn-style primitives. There is **no Table, Select or DatePicker component**; each view hand-rolls these. They have to be built in Phase A. |
| `BookingActionButtons` | `src/components/admin/BookingActionButtons.tsx` | The pattern for status-transition buttons |
| `RoomStatusToggle` | `src/components/admin/RoomStatusToggle.tsx` | The pattern for inline toggles |

---

## 11. Stale branches that may cause confusion

Some remote branches contain admin pages that are **not on `main`** and should not be treated as existing:

| Branch | Extra admin pages |
|---|---|
| `origin/client/sync-step-2-admin-auth` | `dashboard`, `destinations`, `leads`, `pricing`, `reports` |
| `origin/client/sync-step-3-pms` | same plus `settings/integrations` |
| `origin/client/the-wave-resorts` | same as sync-step-3 |
| `origin/wip-admin_scaffold` | `payments/verification` |

These may explain why earlier reports listed `/admin/dashboard` and `/admin/reports`. The unguarded `api/admin/{destinations,leads,rooms}` routes (F1) are probably leftovers of this scaffold, whose UI pages were removed but whose API handlers stayed.

---

## 12. Brief vs reality: summary

| Brief item | Reality | Planning implication |
|---|---|---|
| 11 admin modules exist | 5 exist (`/admin`, bookings, rooms, guests, settings). There are also BanglaQR verification and blog. | Front Desk, Daily Sheet, Finance, Reports, Stakeholder and Messages are **new builds** |
| Settings has general, payments, pms and users tabs | No tabs. Payments and integrations are subpages. No users UI. Save is a no-op. | The settings rebuild is Phase A work |
| Roles OWNER, MANAGER, STAFF | ✅ Hierarchy only | Replace with a permission map. Map existing STAFF users to FRONT_DESK (01). |
| AuditLog exists | ✅ Minimal | Extend it additively (03) |
| Prisma migrations | ⚠️ Drifted and unused by the build | Re-baseline during the Postgres move |
| Money handling | `Float` | Integer poisha for everything new |
| Rooms inventory | Room *types* only | `RoomUnit` is a Phase A prerequisite |
| Security posture | 🔴 9 unauthenticated admin API routes | Hotfix now, plus a guard-enforcement test |

---

## 13. Verified absent (searched, found nothing)

- Any model or code for inventory, suppliers, purchase orders, expenses, journal entries, chart of accounts, invoices, VAT, staff profiles, shifts, attendance, leave, salary, housekeeping tasks, room-service tickets or daily snapshots.
- Any `/admin/*` route for front desk, housekeeping, room service, inventory, purchase, expenses, finance, HR, reports, audit log or messages.
- Any test file (`*.test.ts`, `*.spec.ts`) or test runner.
- Any backup script.
- Any feature-flag or module-gating helper.

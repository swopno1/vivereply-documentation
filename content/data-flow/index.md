# Data-Flow Documentary — Bird's-Eye View

> **Living document.** This file grows as each training module is written. Its
> jobs: explain how the application really works end to end, answer technical
> questions with evidence, and surface anomalies, misconfigurations, data
> bleeding, miscalculations, logical errors and duplication *before* they reach
> guests or the books.
>
> **Rule for contributors:** every flow states its *source of truth* (the code
> or doc it was read from). A flow marked *(verified)* was read from the
> implementation on `client/demo1`. A flow marked *(to verify)* is inferred or
> carried over from older docs — treat it as a hypothesis until someone reads
> the code.

## 1. Global invariants

These hold everywhere. Any code or process that breaks one is a bug.

1. **Business day rules the system.** All operational dates (dashboard, sheet,
   audit, arrivals) use the property's *business day*, which advances only
   when the night audit closes the previous day (~04:00 property time). Source:
   `src/lib/business-day.ts`, `getPropertyTimezone()` (`src/lib/settings.ts`,
   default `Asia/Dhaka`, editable in Settings → General).
2. **Money is stored in poisha, displayed in taka.** Integer arithmetic only;
   no float money math. Source: `src/lib/money*.ts`, `paymentAmountFields()`.
3. **Timestamps are UTC instants; interpretation is property-local.** The
   database stores instants. "Today", "this month", and day boundaries are
   always computed in the property time zone. Helpers: `businessDate()`,
   `calendarDate()`, `zonedParts()` (`src/lib/timezone.ts`).
4. **Revenue shown anywhere = cash collected.** Money *arrived* minus
   *completed refunds*. Never earned revenue, never pipeline value. Source:
   `collected()` in `src/lib/dashboard/metrics.ts`; full definition in
   `docs/ops/money-flow.md`.
5. **Every state change is audited.** Financial and operational mutations go
   through permission checks (`requirePermission`), MFA where configured, and
   write audit rows. Never edit records to make a report look right.

## 2. Core entities and key relations (verified)

| Entity | Key fields | Relates to |
|---|---|---|
| `Booking` | `bookingCode` (unique), `status`, `checkInDate`, `checkOutDate`, `totalAmountPoisha`, `guestCount`, `roomId`, `unitId?`, `guestId` | `Guest`, `Room`, `RoomUnit?`, `Payment[]`, `FolioLine[]` |
| `Guest` | `fullName`, `email`, `phone` | `Booking[]` |
| `Room` | `title`, `pricePerNightPoisha`, `isActive` | `RoomUnit[]`, `Booking[]` |
| `RoomUnit` | `unitNumber`, `status` (operational), `housekeeping` (DIRTY/CLEAN/INSPECTED) | `Room`, `Booking[]` |
| `Payment` | `provider` (String), `amountPoisha`, `providerAmount?`, `providerCurrency?`, `status`, `source` (GATEWAY/DESK) | `Booking` |
| `FolioLine` | `kind` (ROOM_CHARGE, PAYMENT, …), `direction`, amount | `Booking` |
| `*Refund` | `BkashRefund`, `NagadRefund`, `SSLCommerzRefund`, `StripeRefund`; `status`, `completedAt`, `amountPoisha` | `Payment` |
| `PaymentGatewaySetting` | `gateway`, `enabled`, `settlementCurrency`, `conversionRate` (BDT/unit) | — (per-gateway config) |
| `PaymentGatewayCredential` | `gateway`, `key`, encrypted `value` (write-only) | — |

**Booking statuses:** `PENDING` → `CONFIRMED` → `CHECKED_IN` → `COMPLETED`,
with `CANCELLED`, `NO_SHOW`, and `PENDING_MANUAL_VERIFICATION` (Bangla QR
receipt awaiting human review) as side states.

## 3. Flow catalog

### 3.1 Dashboard revenue — cash collected (verified)

**Path:** `Payment` (source=GATEWAY, collected statuses) + `FolioLine`
(desk payments) − `*Refund` (status=COMPLETED)
→ `collected()` → `loadDashboardMetrics()` → KPI cards + Payments-by-method.

**Windowing:** a payment counts when its money *arrived*
(`executedAt`, else `verifiedAt`, else `createdAt`) falls in the window.
Desk money is keyed by **business date** (fixed 2026-10-29; was `createdAt`).

**Consumers:** Revenue Today / Revenue This Month cards, Payments-by-method
card, CSV export (`/api/admin/reports/payments?format=csv`).

**Bleed watch:** Stripe refunds live in `StripeRefund` (added 2026-10-29);
any *new* gateway must add its refund table to `collected()` or its refunds
will silently inflate revenue. Pending (not completed) refunds never subtract.

### 3.2 Occupancy and availability (verified)

**Path:** `Booking` (status=CHECKED_IN) × `RoomUnit` (active, in service)
→ `occupiedTonight / bookableUnits` → Occupancy card;
→ per-room-type unit availability → Available Tonight card, Attention Required
(zero-availability rooms).

**Invariant:** availability is computed from **units**, never from any
counter column. Maintenance/out-of-order units are excluded from both sides
of the occupancy fraction.

### 3.3 Night audit and business day (verified)

**Path:** cron → `GET /api/cron/night-audit`
→ `runNightAuditCron({ timeZone })`
→ loop: `getOpenBusinessDay()` → `autoCloseDue(date, timeZone, now)`
→ `closeBusinessDay({ date, mode: "auto" })`.

**Close rule:** a day closes when it is over **and** (property-local time ≥
04:00 **or** the day is older than yesterday). Self-correcting: missed days
close on the next run regardless of hour. Manual close is also possible from
the Night Audit page.

**Effects of a close:** posts room charges (accruals → `FolioLine`
ROOM_CHARGE), advances the business day, keeps unresolved arrivals for the
desk (they appear in Front Desk arrivals as overdue arrivals).

**Trigger note:** the schedule (`vercel.json`, currently daily ~04:xx Dhaka)
is only a dumb trigger — the *decision* is timezone-aware. The route
docstring expects hourly; daily works because of the catch-up rule.

### 3.4 Booking lifecycle (verified)

**Path:** guest checkout / staff creation → `Booking` (PENDING)
→ payment success → CONFIRMED → front-desk check-in → CHECKED_IN
→ check-out → COMPLETED (folio settled).
Side exits: CANCELLED (releases the unit), NO_SHOW (never arrived),
PENDING_MANUAL_VERIFICATION (Bangla QR receipt → human review → CONFIRMED or
cancelled).

**Money connection:** the booking's `totalAmountPoisha` is server-computed;
every gateway create-route cross-checks the client amount against it and
refuses mismatches. Payments attach to the booking; refunds attach to
payments.

**Idempotency:** bookings carry an `Idempotency-Key`; gateway webhooks are
exactly-once (duplicate deliveries → 200, no double-apply).

### 3.5 Payment flows (verified)

**Online (all gateways):** guest picks method → server verifies booking
(id + code + amount = total) → creates `Payment` (INITIATED) → gateway
session/QR → guest pays → **webhook** (signature-verified)
→ payment SUCCESS (exactly once) → booking CONFIRMED.

**Gateway registry:** `GATEWAY_REGISTRY` (`src/lib/payments/registry.ts`) is
the single source of truth — kind (LOCAL/INTERNATIONAL), fields, currencies.
Credential resolution per field: **env → dashboard (encrypted) → default**.
Env-complete gateway = active with dashboard toggle locked.

**Desk:** cash/card taken at front desk → `FolioLine` PAYMENT on the
booking's folio → counted in `collected()` by business date.

**Refunds:** per-gateway refund tables, `COMPLETED` status + `completedAt`
window → subtracted in `collected()`. Desk refunds → folio.

### 3.6 Front-desk operations (verified)

**Path:** `loadFrontDeskToday({ timeZone, date })` → three lists:
- **Arrivals:** checkInDate = today AND status ∈ \{PENDING,
  PENDING_MANUAL_VERIFICATION, CONFIRMED, CHECKED_IN}, **plus** earlier
  arrivals the night audit kept (no-show-from statuses) — i.e. guests still
  on their way.
- **Departures:** checkOutDate = today AND status ∈ \{CHECKED_IN, COMPLETED}.
- **In-house:** status = CHECKED_IN, earliest checkout first.
- **Overdue flag:** CHECKED_IN with checkOutDate < today.

**No money on this page by design** (FRONT_DESK has no FINANCE access).

### 3.7 Settings → behavior (verified)

`Settings → General` (timezone, contact email/phone, fees) feeds:
business-day computation, dashboard header, audit timing, and guest-facing
contact details. Timezone changes take effect on the next computation — no
redeploy needed.

### 3.8 Daily sheet (verified)

**Path:** `loadDailySheet({ date, businessDate, withOwnerSummary })` →
sections: owner summary (from the night audit's `DaySummary`, only if the
day closed) + at-a-glance + arrivals/departures/in-house tables + unit grid
+ money-due + notes.

**Date rules:** `?date=` up to 60 days back (read-only), business date
(working), 7 days ahead (planning). Past sheets show balances as owed
**now**, not historically.

**Money-due balance includes unposted future nights** — it is a collection
forecast, not today's target.

**Notes flow:** `addDailyNoteAction` (500 chars, target role or everyone,
optional carry-over) → note reappears daily until `markDailyNoteDoneAction`.
Notes need FRONT_DESK.create; never on past days.

### 3.9 Cash shifts (verified)

**Path:** `openCashShiftAction({ openingFloatPoisha })` → `CashShift` OPEN
→ desk cash payments/refunds stamp onto the open shift automatically
→ `closeCashShiftAction({ countedPoisha, countDetail })` → variance computed
→ `CLOSED` (balanced) or `NEEDS_REVIEW` (short/over) → manager sign-off
(`found`/`repaid`/`written-off`) → `REVIEWED`.

**Blind count:** the expected amount is hidden until after submit — the
count cannot be nudged toward it. Final on submit; a manager note is
required when closing someone else's shift.

**Voids after the count** adjust what the drawer *should* have held; they
are shown as explanation for a variance, never rewriting the count.

**Feeds:** desk cash → `collected()` (dashboard revenue, by-method Cash);
unsigned shifts → daily-sheet owner summary + night-audit checklist.

### 3.10 Night audit detail (verified)

**Path:** `loadAuditChecklist(date, { timeZone })` → operator decisions
(`decideArrivalAction`: KEEP keeps the room held, NO_SHOW releases the unit
and keeps payment) → `closeBusinessDayAction({ date })`
→ posts `FolioLine` ROOM_CHARGE per in-house stay → writes `DaySummary` to
the `BusinessDay` row → business date advances.

**Guards:** close requires the day to be over AND zero undecided arrivals;
irreversible by design (posted charges may already be on guest folios).

**History:** last 7 `BusinessDay` CLOSED rows — closer (person or
`system:` auto-close), occupancy, room revenue, collected, unresolved
counts. The daily sheet's Owner summary reads these rows; it never
recomputes.

### 3.11 Housekeeping (verified)

**Path:** `loadHousekeepingBoard({ date })` → sections: to-clean (arrivals
today first → guest-left → stayovers), awaiting inspection, ready
(collapsed), occupied-serviced (collapsed), out-of-service.

**State machine (owner decision 2026-10-07):** checkout → DIRTY;
`setHousekeepingAction` with optimistic `expected` guard (stale →
"someone else changed this room"): MARK_CLEAN (DIRTY→CLEAN, edit),
INSPECT_PASS (CLEAN→INSPECTED, approve, vacant only), INSPECT_FAIL
(CLEAN→DIRTY, approve, note required), MARK_DIRTY (CLEAN/INSPECTED→DIRTY,
edit, note optional).

**Rules:** check-in warns on non-INSPECTED, never blocks; occupied rooms are
never inspected. Notes via `addHousekeepingNoteAction` /
`markHousekeepingNoteDoneAction` (500 chars, role target, carry-over).

**Feeds:** readiness badges (front desk), daily-sheet "empty and ready"
count, night-audit dirty-room flag; stayover rooms re-queue at day close.
Each card's "since \{time} by \{name}" is the audit trail.

### 3.12 Room service (verified)

**Path:** `loadRoomServiceBoard({ date })` → to-do (NEW/PREPARING/READY,
oldest first, 30s refresh) + finished-today (collapsed).
`advanceRoomServiceOrderAction` / `cancelRoomServiceOrderAction` with
optimistic `expected` guard (stale → board refreshes).

**Money moment:** charge posts to the folio on DELIVERED (confirm dialog
shows the amount), never at order placement. Cancel needs a reason (≥3
chars), charges nothing, keeps the reason.

**Menu:** `MenuItem` rows (EN name, optional BN name, category, price
poisha, sort order, isAvailable, archivedAt). Kitchen toggles sold-out
(edit); managers add/price/archive (approve). Archive is non-destructive:
past orders keep their item copy.

**Guards:** orders only for CHECKED_IN stays; open orders block checkout
and flag the night-audit checklist; kitchen roles see dishes, not prices
(`showMoney` gating).

### 3.13 Chatbot handoffs (Concierge build, verified)

**Path:** server component reads `CONCIERGE_BRIDGE_KEY` (never reaches the
browser) → mints a fresh 15-minute embed token per page load
(`POST /api/bridge/embed-tokens`, bridge-key auth, bound to the dashboard
origin) → renders the Concierge staff iframe (`/staff/embed`).

**Deliberate non-design:** no custom handoffs UI over the bridge API — the
widget is the manage path (list/filter, transcript, notes, assign,
close/reopen). Expired token → refresh the page, never a key prompt.

**Setup states:** no key → 3-step setup notice (mint in Concierge Settings
→ Bridge keys, set env, redeploy); bad origin → origin notice; token
failure → check key active, refresh.

### 3.14 Inventory (verified)

**Path:** `StockItem` rows (name EN + optional BN, category, unit, reorder
level, `qtyOnHandMilli`, average cost, `stockValuePoisha`, `archivedAt`) →
movements → counts.

**Movements** (`/move?kind=`): RECEIVE (qty + price per unit → updates
average cost; supplier/invoice ref optional), ISSUE (qty + to-department:
Kitchen/Housekeeping/Front desk/Maintenance/Other), WASTE (qty + required
reason). Multi-line, posted together. The unit locks once stock has moved;
archive is non-destructive (history stays).

**Counts** (blind): the form never carries the book quantity; blank lines
are skipped. SUBMITTED → manager review (book vs counted, variance, value
effect, required reason) → APPROVED posts each difference as an ADJUST
movement, REJECTED changes nothing. A counter can never approve their own
count (separation of duties).

**Money visibility:** stock values shown only with export/approve
permission — quantities for operators, values for managers.

**Feeds:** low-stock items + counts awaiting approval → daily-sheet owner
summary.

### 3.15 Expenses (verified)

**Path:** `/admin/expenses` → one month at a time (`?month=YYYY-MM`,
default business month) + everything SUBMITTED, oldest first.
`/expenses/new` → SUBMITTED → manager approve/reject.

**Fields:** date spent, category (10 fixed), description, amount poisha,
payment method (Cash/Bank/bKash/Nagad/Card/Cheque), optional payee,
supplier link, bill/voucher/transaction ref.

**Rules:** every expense is approved by someone else — the enterer/last
editor can never approve their own (separation of duties); rejection
requires a note. **Expenses never touch front-desk cash drawers** —
record the payment method instead.

**Feeds:** expenses awaiting approval → daily-sheet owner summary; month
export (CSV) for the accountant.

### 3.16 Bookings (verified) — the hub

**Lifecycle:** PENDING → CONFIRMED → CHECKED_IN → COMPLETED, with
CANCELLED / NO_SHOW exits and PENDING_MANUAL_VERIFICATION for gateway
receipts needing a human. Transitions via `updateBookingStatus` /
`cancelBookingWithRefundDecision`; check-in warns on non-INSPECTED units
(never blocks); checkout blocked by open room-service orders or unsettled
folio. Editing locked once CANCELLED/COMPLETED; every amount change needs
a written reason (lands in the status history / `BookingLog`).

**New booking** (BOOKING.create): guest (name/phone/email) + stay (room,
dates, guest count, total) + payment (status PAID/PARTIAL/UNPAID/
PAY_AT_CHECKIN; method Cash/bKash/Nagad/SSLCommerz/BanglaQR/Other;
reference) + details (source Walk-in/Phone/Email/Referral, notes).

**Folio** (`loadFolio`): chronological `FolioLine` entries — charges
(categories incl. early-check-in/late-check-out fees from settings),
payments (cash needs an open shift), discounts (reason), refunds (reason);
voids keep the struck line with a reason; idempotent posting keys.
Balance = charges − discounts − payments + refunds; the projection line
adds unposted nights (posted one-at-a-time by the night audit).

**Fan-out:** bookings feed front-desk lists, daily-sheet tables + money-due,
night-audit charges/decisions, room-service orders + folio charges, cash
shifts (desk payments), the dashboard (revenue, occupancy, ADR/RevPAR),
and Concierge drafts arrive as PENDING bookings.

### 3.17 Blog (verified)

**Lifecycle:** DRAFT → PENDING → PUBLISHED, with REJECTED / ARCHIVED
exits; SCHEDULED is a filter view (PUBLISHED + future `publishedAt`).
Sources: STAFF (editor) vs GUEST (website story form → PENDING
automatically, confirmation email on submit and on publish).

**Editor** (`PostEditor`, shared by new + edit): title, slug, excerpt,
Markdown content, one category, tags, photos (count/size/type limits from
settings, each with a description). `staffPostsAutoPublish` decides
whether staff publish directly or queue.

**Moderation** (`/pending`, BLOG.approve): oldest first with flag reasons;
approve → PUBLISHED, reject → REJECTED with a required reason.
Taxonomy (`/categories`, `/tags`, BLOG.edit): name EN + BN, slug,
description, display order, active flag, live post counts.

**Settings:** auto-publish, posts per page, author bylines, RSS, guest
confirmation emails, guest allowed categories, length/photo limits,
allowed mime types. All apply going forward.

### 3.18 Rooms, guests, settings (verified)

**Rooms:** `Room` (type: title, bed type, max guests, price/night, active,
destination, slug, photos) → `RoomUnit` (physical: number, status,
housekeeping state). Bookings hold the type; check-in assigns a unit.
Price/night feeds quotes, folio charges, ADR/RevPAR. Edit page
(`[id]`/`new`, ROOMS.edit/create): Details tab + Units tab with live
booking counts (never remove a unit with future bookings).

**Guests:** `Guest` records (name/phone/email from booking; NID-passport +
address at check-in). One record per person; the phone is the operational
key (desk dialing, Concierge verification). Directory search across
name/email/phone with booking history per guest.

**Settings** (`?tab=`, each tab permission-gated): general (identity,
contact email → lead alerts, property timezone → every date in the
system, check-in/out windows, early/late fees → folio auto-fill, email
status card); payments (owner-only gateway cards: env > dashboard >
default, per-gateway currency + static rate, write-only secrets); pms
(external connections); users (USERS.* — least privilege, personal
accounts, deactivate-don't-delete); modules (feature flags; gateway
payment admin works even with finance off — guests' money never depends
on a flag); tax (tax-inclusive pricing by design).

### 3.19 Finance (verified)

**The books:** double-entry ledger behind every operational screen.
`LedgerAccount` (code, EN+BN names, type, `isMoney` flag; system accounts
GUEST_RECEIVABLE, ACCOUNTS_PAYABLE, PETTY_CASH) → `JournalEntry` (sources:
MANUAL/AUTO/SUPPLIER_BILL/SUPPLIER_PAYMENT/TRANSFER/PETTY_CASH_COUNT/REVERSAL)
→ `JournalLine` (debit/credit poisha). **Posted entries are never edited
or deleted — corrections are REVERSAL entries linked to the original.**
Start: `ledgerStartDate` (first business date covered) + opening balances
as a journal dated that day; everything recorded from that date
auto-posts. **ManualJournal** (create → SUBMITTED → approve posts);
**SupplierBill** (OPEN until fully paid; overdue = due < business date) +
**SupplierPayment** (SUBMITTED → approve); **PettyCashCount** (blind count,
approve posts difference); **TRANSFER** entries move money between money
accounts. **Months:** 13 (current + 12 back); close needs approve,
reopen needs edit (owner). **Reports:** trial balance (integrity first),
P&L, balance sheet, ageing (`?type=trial|pnl|balance|ageing&from&to`).
**BanglaQR queue** (`PENDING_MANUAL_VERIFICATION` bookings) reachable
from Finance → Waiting for approval (FINANCE approve), night-audit
banner, daily sheet, booking detail.

### 3.20 HR and purchasing (verified)

**HR:** `Employee` (code, name EN+BN, department, designation, join/left
dates, monthly salary) → `AttendanceDay` (one day, `?date=`, never future;
month view aggregates) → `PayrollRun` (month, status, gross/net/headcount;
suggested month = earliest without valid run; lines snapshot salary +
attendance; VOID kills a bad run — never edit finalized numbers;
per-line payslips). Join date starts everything; left date ends it.

**Purchasing:** `Supplier` (archive blocked by open POs) → `PurchaseOrder`
(PO-YYYYMM-####; DRAFT → SUBMITTED → APPROVED → PARTIALLY_RECEIVED →
RECEIVED → CLOSED, or CANCELLED; 50 lines max, ৳2 crore cap; open =
DRAFT/SUBMITTED/APPROVED/PARTIALLY_RECEIVED) → **receive** (only against
APPROVED/PARTIALLY_RECEIVED; posts goods into inventory, updates average
cost; short deliveries → PARTIALLY_RECEIVED with outstanding remainder).
New PO can start from a low-stock item (`?item=`). Receiving and the
supplier bill are two sides of the same event — they must agree.

### 3.21 Public website (verified)

Guest-facing site ((swiss) route group): `/stay` → `/stay/[slug]` →
`/book/[roomId]` (BookingStepper: dates → availability → guest details →
server-computed quote → payment) → `/booking/confirmation/[id]`
(noindex). Payment result pages per gateway
(`/payment/{bkash,nagad,sslcommerz}/result`); BanglaQR → receipt upload →
PENDING_MANUAL_VERIFICATION (+ `/payment/banglaqr/reupload`);
`/demo-gateway/[provider]` inert unless `PAYMENT_MODE=simulate`. Online
bookings are identical records to desk bookings (same statuses, folios).
Contact form POSTs `/api/contact` (lead saved + Resend alert to settings
contact email; phone required). Content: destinations, experiences,
explore-the-area, dining, amenities, gallery, offers, about, how-to-reach,
location, faq, reviews, press-kit; policies: terms, privacy,
refund-policy. Public blog (`/blog`, category/tag, `[slug]`) reads the
same published posts as the admin blog; `/blog/submit` → PENDING guest
posts in the moderation queue; `/share-your-stay` invites stories.

### 3.22 ViveReply Chatbot — Concierge build (verified behavior, separate codebase — read-only)

The Chatbot product line's current build (*ViveReply Concierge*): AI
front-desk agent at app.vivereply.com; own DB, joined to the Suite by
HTTP + IDs (spec v1: `GET /api/concierge/ping` →
`{"ok":true,"suiteVersion":1}`). 7 tools: check_availability, get_quote,
create_booking_draft (PENDING hold + code), verify_booking,
lookup_booking_by_code, request_booking_details, request_handoff.
Guardrails: retraction guard (EN+BN); staged verification (code → dates +
first name + status; full details only to the stored email). Widget:
iframe via widget.js (sync embed). Tenant binding: per-tenant
ApprovedDomain rows (ACTIVE required or error panel); catalogue maps
`suiteRoomIds` positionally to Suite rooms. Staff side:
`/admin/concierge-handoffs` (FRONT_DESK.view) — server-minted 15-min
embed tokens via `POST /api/bridge/embed-tokens`; bridge key server-only
(minted in Concierge Settings → Bridge keys, shown once). Framing:
"front-desk agent", never an MCP.

## 4. Reconciliation map

Numbers that must agree with each other; a mismatch is an anomaly, not a
coincidence.

| A | B | Must match when |
|---|---|---|
| Dashboard Revenue Today | Daily Sheet cash total | Same business day |
| Payments-by-method month sum | Revenue This Month net | Same month (refunds! the by-method card shows *gross*) |
| Gateway dashboard payout | `Payment` SUCCESS rows | Same window, same currency |
| Folio balance zero | Booking COMPLETED | After settlement |
| Occupancy card | In-house list count | Same moment |
| Available Tonight | Sum of per-room availability | Same moment |

**Known definitional differences (not anomalies):**
- Dashboard revenue (cash collected) vs. ADR/RevPAR (earned room revenue from
  posted charges) — different concepts, both correct.
- Dashboard anchors to business date; some exports anchor to calendar day —
  compare like with like.

## 5. Anomaly and misconfiguration watchlist

Living list. Each entry: symptom → likely cause → where to look.

1. **Revenue suddenly drops to 0** → gateway env vars missing after a
   redeploy, or brand payments disabled. Check `/api/payments/availability`.
2. **Refunds not reducing revenue** → refund stuck in non-COMPLETED status,
   or a new gateway's refund table not wired into `collected()`.
3. **Same money counted twice** → desk-recorded a payment that also arrived
   online (discipline issue) — compare gateway payouts vs folio.
4. **Business day stuck** → night-audit cron not firing or failing; check
   `/admin/system` job heartbeats, then the recovery procedure.
5. **Occupancy 0% but guests present** → units archived/out-of-order, or
   check-ins done on wrong bookings.
6. **Availability frozen (no units sellable)** → unbounded CHECKED_IN holds
   (overstay) — the bounded-hold fix is post-launch work; do not reseed
   production-like data.
7. **Alert won't clear** → the underlying condition is still true; fix the
   cause (e.g. the booking is still unpaid).
8. **Pending verifications piling up** → nobody working the Bangla QR queue;
   guests may be told they're unpaid.
9. **Currency/rate wrong on Stripe card** → owner hasn't set the BDT rate;
   Stripe stays off by design until rate + currency are set.
10. **Dashboard shows yesterday at 02:00** → normal; the business day rolls
    at the night audit (~04:00), not midnight.

11. **Cash difference with no note** → holder skipped the note or a
    void landed after the count; read the shift detail before concluding.
12. **Night audit won't close** → undecided arrivals (the page names them)
    or the day isn't over; auto-close covers it at 04:00.
13. **Owner summary says "Not closed yet"** → the audit hasn't run; figures
    are pending, not zero.
14. **Money-due total looks huge** → it includes unposted future nights by
    design; compare against folio balances, not today's collections.

## 6. Open questions (to verify)

- Exact folio posting mechanics for over-posted nights and early-departure
  credits (m11) — read `closeBusinessDay` accrual code.
- Ledger auto-posting schedule and the empty-P&L-until-then behaviour.
- `pending-expiry` 24h rule vs. daily scheduling (24–48h effective window).
- Generic webhook route vs. per-gateway routes (m7).

## Changelog

- **2026-10-30** — Created.
- **2026-10-30** — Added daily-sheet, cash-shift, and night-audit flows;
  extended the watchlist (11–14).
- **2026-10-30** — Added housekeeping flow (§3.11).
- **2026-10-30** — Added room-service (§3.12) and concierge-handoffs
  (§3.13) flows. Concierge-handoffs route flagged: may be renamed later.
- **2026-10-30** — Added inventory flow (§3.14).
- **2026-10-30** — Split inventory movements into RECEIVE / ISSUE /
  WASTE training pages.
- **2026-10-30** — Added expenses flow (§3.15).
- **2026-10-30** — Added bookings flow (§3.16): lifecycle, new-booking
  form, detail cards, folio posting rules, fan-out map.
- **2026-10-30** — Added blog flow (§3.17).
- **2026-10-30** — Added rooms/guests/settings flow (§3.18). Seeded with dashboard, night-audit, booking,
- **2026-10-30** — Added finance (§3.19), HR/purchasing (§3.20), public website (§3.21), Concierge (§3.22).
  payment, and front-desk flows (all verified against `client/demo1`).
  Watchlist seeded from the 2026-10-29 money-flow audit.

# Delivery Record and Demonstration Guide

Date: 2026-11-01. Status: demo mode, on the production track.
Companion: the inspection series in this folder ([00](00-EXECUTIVE-SUMMARY.md) to [07](07-GO-LIVE-CHECKLIST.md)).

This is the single record of what was inspected, decided, and changed so far,
plus what the owner should review to demonstrate the project: technical terms,
features, KPIs, and differentiators.

## Part A — What we did (delivery record)

### A1. Production-readiness inspection (read-only, no code changed)

Six focused audits (security, /admin deep dive, code quality, UI/UX,
business/hospitality/legal, functions/data) produced docs 00–07. Headline:
10 launch blockers, ~12 Highs, ~30 Mediums, ~25 Lows, 15 follow-ups.
Verdict then: not production-ready; strong foundations
(poisha money discipline, double-booking-proof inventory, permission matrix,
per-gateway audit depth).

### A2. Demo-mode contract (agreed before any change)

Demo stays fully intact while the repo is made production-movable:
demo data, demo seed, `PAYMENT_MODE=simulate`, demo email banners unchanged.
Phase 0 skips agreed: seed gating, simulate hard-fail, email-banner gating.
Every change must be demo-compatible or env-gated, with proof (test or
command output).

### A3. Batch 1 — secrets, IP trust, audit triage

- `.dockerignore` now excludes `.env*` (keeps `.env.example`), so the live
  Supabase URL on disk can no longer bake into images. Owner action left:
  rebuild images from clean context and rotate any secret ever built in.
- Rate-limit client IP unified on the shared proxy-safe helper
  (`lib/blog/client-ip.ts`: X-Real-IP, else last X-Forwarded-For): the 4
  checklist routes plus 2 extra instances found by sweep (Stripe create
  rate limit + audit IP, Stripe admin-actions audit IP). Six new test
  files, written failing-first (10 failures proving live bypass), now
  8 files / 19 tests green including pre-existing contact/callback XFF
  tests. Repo-wide search: zero first-XFF parses left in `src`.
- `pnpm audit` fully triaged: 4 criticals (next RCE x3, better-auth
  account-takeover x2), next SSRF/DoS + moderates, sanitize-html x2,
  zod v4 decision, transitives and dev-only tail.

### A4. Dependency upgrades (with recovery)

First `pnpm up` failed on registry timeouts and left `node_modules`
half-unlinked; repaired with a resilient reinstall, verified healthy,
retried: next 16.3.5 → 16.4.1, better-auth 1.7.5 → 1.7.14,
sanitize-html 2.17.7 → 2.18.1. Post-upgrade audit: 0 critical,
0 production-runtime high. Full suite 815 passed with only the 4
pre-existing failures (proven identical on the pristine tree via stash
check); `tsc` clean. Zod v3→v4 left as a separate major-bump decision.

### A5. Handoff privilege fix (admin High A-H1)

Concierge mutations required only FRONT_DESK view, so read-only AUDITOR
could mutate live state with no audit trail. Now requires `edit` and
writes `HANDOFF_ASSIGNED` / `HANDOFF_STATUS_CHANGED` / `HANDOFF_NOTE_ADDED`
rows via never-throwing `logAudit`. Verified AUDITOR is the only
view-without-edit role, so no legitimate flow loses access. Enforcement
suite extended: 121/121 green across all 10 roles.

### A6. Phase 2 guest-trust batch 1

- Booking params end-to-end: tested `?checkIn=&checkOut=&guests=` parser
  (strict dates, first-value-wins, guests 1–99); book page reads
  `searchParams`; stepper seeds dates and capacity-clamped guests.
- Contact phone validation: tested BD/international validator, specific
  errors in the existing alert region, normalized digits sent to the API.
- Chrome unify: new `(swiss)/error.tsx` boundary in Swiss styling and a
  flat-restyled booking skeleton.
- Price sweep (owner chose ৳ via `formatBdt`): 7 hardcoded sites
  converted with `toPoisha`; fixtures verified whole-taka so values are
  unchanged; zero hardcoded sites left.
- Accessibility semantics: bilingual skip link + main target with
  scroll margin; mobile menu Esc/trap/scroll-lock/`aria-current`/
  reduced-motion; stepper list semantics + associated labels +
  autocomplete/inputMode + alert errors; payment radiogroup + radio
  roles; `overflow-x: clip`; focus-visible rings. `tsc` + eslint clean.
  `html lang` deliberately unchanged: the client already syncs it
  post-hydration and a server cookie read would force the whole app
  dynamic (first-paint-only residual, accepted).

### A7. Lint to zero

`eslint .`: 81 problems (4 errors, 77 warnings) → 0. `_meta.ts`
convention files silenced via a scoped config override (72 warnings, zero
code risk); 4 Stripe `any` errors replaced with `unknown` narrowing that
is behavior-identical for real Stripe responses and safer for malformed
ones; 5 dead imports/consts removed. Secret scan clean (no live keys in
source). Full suite 827 passed, same 4 pre-existing failures. `next build`
exit 0 with `migrate deploy` deliberately skipped (live DB — needs
explicit owner consent).

### A9. Phases 1–3 + Phase 4 hardening (condensed record)

Phase 1 (Secure + staff-ready /admin): handoff mutations require
edit/manage with audit rows (AUDITOR 403 tested, 121/121 enforcement
green); security headers + nginx HSTS/frame-ancestors; chat rate limit +
input cap + timeout; login redirect + rememberMe=false + forgot-password;
payments verification off legacy MANAGER with nav entry; rooms view-only
path; case-insensitive search + validated params; PII masking matrix
(NID/bank/salary, CSV parity); payments index verified real. Owed: the
4-role walkthrough recording.

Phase 2 (Guest-trust + legal): booking params end-to-end; all prices via
`formatBdt` (owner chose ৳); a11y semantics + small-text contrast sweep
on the booking path; privacy/terms/refund versioned + consent-gated
analytics (real copy is an owner action); NID masking; confirmation
bearer-URL + rate limit. Owed: keyboard/visual demo checks.

Phase 3 (Hospitality completeness): BZ-H1 VAT/SD engine + BIN + checkout
breakdown + invoice; BZ-H2 rate plans + promos + bookable offers; BZ-H3/H4
guest self-cancel/modify + enforced tiers + override audit; BZ-M1 deposits
+ pay-at-property + folio balance-due; BZ-M2 SMS/WhatsApp templates +
cancel emails. Pending: BZ-M3 iCal, BZ-M4/M5 multi-room.

Phase 4 (Hardening & hygiene): L2–L4 seed-admin redaction + R2 fallback
audit + JSON-LD helper; M7 env checks for Stripe/R2/PMS/PAYMENT_MODE;
M8 Zod on public routes + shared clientIp/apiOk/apiErr; M12 VPS/Docker
primary + pnpm pin + R2 runtime config; M9 zombie availableUnits writes
removed + STAFF/legacy removal schedule; M11 docs consolidated
(documentation/ → docs/manual); H3/M6 gateway dedupe/refund plan;
M4/M5 Booking/Payment status + provider enums and typed JSON columns
(577/577 suite, tsc 0).

### A10. M10 UI tests + Playwright + demo DB migration (2026-11-02)

- `*.test.tsx` enabled (happy-dom + Testing Library, docblock opt-in);
  BookingStepper.test.tsx 6/6 green (seed/clamp/validation/availability/
  sold-out). tsc 0, eslint clean.
- Playwright harness: read-only booking-smoke green in 15.2s
  (destinations → room → book → guest details, zero writes); gated
  booking-confirm green in 34.6s under PLAYWRIGHT_WRITE_TESTS=1 with
  explicit consent (pay-at-property → confirmation page), test booking
  RES-202611-00002 deleted after, zero rows left.
- The smoke caught real drift: demo Supabase was behind the code
  (`/book/*` crashed, P2021 SeasonalRate missing). With consent, deployed
  5 migrations (tax, rates, deposits, enums, typed JSON). The enums
  migration failed first try (42883: exclusion constraint + 16 gateway
  partial indexes compare status/provider to text); fixed by dropping
  and re-creating those dependents inside the migration. Verified after:
  3 enum types, exclusion constraint + all 16 indexes present, 629
  bookings / 364 payments intact, zero data loss.
- Environment notes: the dev sandbox cannot launch Chromium (Mach
  bootstrap denied) or bind localhost (EPERM), so browser runs need an
  unsandboxed shell; `migrate deploy` needs the session pooler
  (pooler host port 5432 — `db.<ref>.supabase.co` does not resolve for
  this project and port 6543 is transaction-mode).

### A11. Decisions log (owner-confirmed unless noted)

- Production target: VPS / Docker primary; Vercel stays for demo/preview.
- Terms checkbox will be mandatory in demo too (demos the exact prod flow).
- Confirmation page keeps the bearer-URL model with hardening (rate
  limit + masked sensitive fields), no code+phone gate.
- Price display: ৳ through shared `formatBdt` (en ৳8,500 / bn ৮,৫০০৳).
- Demo-banner removal skipped per demo-mode contract.
- `lang`: accepted residual (engineer decision, documented above).
- Zod v4: pending major-bump decision with full-suite verification.
- E2E write leg runs only with PLAYWRIGHT_WRITE_TESTS=1 plus explicit
  owner consent per run, against demo Supabase for now (no local
  postgres: Docker.app broken, brew needs a sudo chown); the SMOKE-TEST
  booking is deleted after each run.
- Demo DB migrations run by hand with consent until the deploy pipeline
  owns `migrate deploy` (CQ-H2); seed is never re-run against demo
  without a separate explicit decision (it wipes bookings).

## Part B — Necessary notes (backlog and owner actions)

### B1. Owner actions (only you can do these)

- Rotate any secret ever built into a Docker image; rebuild from clean context.
- Enable Dependabot (or equivalent) in GitHub settings.
- Consent explicitly before anyone runs `prisma migrate deploy` against the
  live pooler; long-term it belongs in the deploy pipeline, not `next build`.
- Have counsel review the privacy/terms/refund rewrite before collecting
  real guest PII or money (Phase 2 item, not yet written).
- Decide VAT/SD posture with your accountant (engine currently absent).
- Decide payroll/NID/salary visibility: full bank accounts in payroll CSV
  and MANAGER-visible salaries are flagged confirm-intent, not bugs.
- Reinstall local pnpm with build scripts allowed (clears the Node.js
  fallback notice on your machine).

### B2. Verification still owed (needs the running demo)

Keyboard/visual pass over: param-seeded booking flow, contact errors,
Swiss error page, skeleton look, price rendering (en + bn digits), skip
link, mobile menu focus behavior, stepper announcements; plus the
4-role /admin walkthrough recording. Component-test infra now exists
(happy-dom `.tsx` + BookingStepper 6/6) and Playwright covers
book→guest-details and pay→confirm, so re-runs are one command
(`pnpm test:e2e:smoke`, write leg gated + consent).

### B3. Pre-existing issues left untouched (do not attribute to this work)

- 4 failing tests / 3 files (night-audit db setup, permissions §6 table,
  module-flags x3) — proven identical on the pristine tree.
- `pnpm lint` gate chain: eslint is green; `check:guards` still fails on
  legacy `requireRole` (stripe-actions, stripe-disputes) and unguarded
  gateway-actions — this is the tracked Phase 1 payments migration.
- Zod v3 advisory (memory exhaustion) needs the v4 major decision.
- Stripe client sends `payment_method_types[0]=card`, which current
  Stripe guidance says to omit in favor of dashboard configuration.
  Behavior change — queued for payments review, not snuck into lint.

### B4. Remaining tracked work (in checklist order)

Phase 0–2 and most of 3–4 are landed (see A9–A10). Still open: Phase 3
BZ-M3 iCal export + sales disclosure and BZ-M4/M5 multi-room/group +
occupancy/extra-bed + special requests; Phase 1 4-role walkthrough
recording; Phase 2 keyboard/visual demo checks. Demo-mode skips still
held: seed gating, simulate hard-fail, email-banner gating. Owner infra
actions: Dependabot on; fix local postgres path (Docker.app broken,
brew needs sudo chown) or accept demo-Supabase E2E; deploy pipeline to
own `migrate deploy` (CQ-H2); counsel review of legal copy; VAT/SD,
NID/payroll-visibility, and Meta WA-template decisions.

## Part C — Technical terms to review (demo glossary)

Money and payments: poisha-minor units (all money stored as integers —
no float rounding on guest charges); hosted checkout (card data never
touches our server — the PCI-safe posture); payment rails
(bKash/Nagad/SSLCommerz/Stripe/BanglaQR); idempotency (provider retries
never double-charge or double-record); reconcile cron (background job
that settles sessions whose webhook never arrived); dispute/chargeback
(guest-paid-then-contested flow, tracked per gateway); refund ledger
(per-gateway refund records feeding gross-minus-refunds math).

Bookings and inventory: RoomUnit (each physical sellable unit, the
source of truth — not the legacy counter); exclusion constraint (the
database rule that makes double-booking impossible); booking lifecycle
(PENDING → CONFIRMED → CHECKED_IN → COMPLETED, plus CANCELLED/NO_SHOW);
pending expiry (unpaid holds auto-release after 24h); folio (the guest's
running bill: room, extras, payments); night audit (the daily close that
locks the books); no-show (held inventory the guest never claimed).

Security and access: RBAC + permission matrix (10 staff roles, every
screen/action mapped); allowlist-over-blocklist thinking (deny by
default); bearer link (an unguessable link used as the key — used for booking
confirmation); HMAC webhook signatures (proves callbacks really came
from the gateway); MFA/2FA (second factor on sensitive admin actions);
PII masking (hiding NID/bank digits from roles that don't need them);
rate limiting (per-IP sliding-window caps against abuse and scraping);
X-Forwarded-For vs X-Real-IP (why only the proxy-appended address is
trusted); security headers (HSTS/CSP/frame rules that harden browsers).

Web and experience: i18n en/bn (full English + Bengali, incl. Bengali
digits ৮,৫০০৳); lakh grouping (1,00,000 — the local digit convention);
WCAG AA (the 4.5:1 contrast and keyboard/focus bar); skip link, focus
trap, aria-current (screen-reader and keyboard essentials); static vs
dynamic rendering (prebuilt pages vs per-request — affects speed and
freshness); consent gating (trackers load only after the guest accepts).

Data and operations: Prisma/migrations (versioned database changes —
never run blindly against live); seed data (demo fixtures; must refuse
production one day); cron (scheduled jobs: reconcile, expiry, night
audit); audit log (who did what, when — the accountability backbone);
retention policy (how long each data class is kept, and deletion rights).

## Part D — Features inventory (what to show)

Guest site [Live, demo content]: home, stay listing + detail, offers,
gallery, dining, experiences, location/how-to-reach, contact with
validated callback form, FAQ, reviews display, share-your-stay, blog.
Booking engine [Live]: availability search with live unit counts,
3-step flow (dates/stay → guest details → payment), 5 rails
(bKash/Nagad/SSLCommerz/Stripe/BanglaQR), email confirmation, generic
booking lookup, bearer-link confirmation page. Known gaps (roadmap, not
defects of this pass): seasonal rate plans, promo codes, deposits,
multi-room cart, guest self-cancel/modify, SMS/WhatsApp notifications,
enforced refund tiers, VAT/SD invoices, real channel-manager sync
(current adapter is a mock — no OTA yet).

Admin / back office [Live except where noted]: dashboard, bookings +
detail/folio, guests, rooms + physical units, front desk (daily sheet,
cash shifts), housekeeping, concierge + handoffs, night audit, finance
(journals, months, payables, petty-cash, reports, BanglaQR
verification), room service + menu, inventory (counts, moves,
issue/receive/waste), purchasing + suppliers, expenses, HR
(staff/attendance/payroll), blog CMS with guest pipeline, settings
(general/modules/users; payments live, PMS + tax tabs are labeled
placeholders), access/invites, system health, audit log, data-flow
reference docs. Invite/reset flows, 2FA, and the 10-role permission
matrix enforced on every checked surface.

Platform: bilingual en/bn content with locale cookie; Resend guest +
lead emails; GA4 + Meta Pixel (to be consent-gated); RAG chatbot with
WhatsApp fallback; receipt storage pipeline; per-gateway reconcile
crons; CSV exports with injection guards.

## Part E — KPIs to review and check

Check these on a cadence (daily ops, weekly business). Honest status:
most need a dashboard built — the raw data exists (audit logs,
bookings, payments, crons), the views mostly do not yet.

Revenue and conversion: direct-booking share (own site vs OTA/phone —
the core pitch; needs booking-source tracking); search-to-book
conversion; payment success rate per rail (target 95%+; Stripe/bKash/
Nagad/SSLCommerz/BanglaQR separately — data in Payment rows); average
daily rate and occupancy (needs rate-plan + folio reporting);
cancellation and no-show rates (lifecycle statuses exist).

Payments and finance: reconcile lag per gateway (pending webhooks
settled within hours — cron last-run timestamps); dispute rate and
win/loss (Stripe dispute ledger); refund turnaround time (REQUESTED →
COMPLETED age); gross-minus-refunds tie-out (dashboard math must match
ledger monthly); night-audit on-time close (daily, before business date
rolls).

Operations: handoff acknowledgement time (concierge responsiveness);
housekeeping unit turnaround (dirty → clean per unit status);
unresolved-booking age (PENDING older than 24h should be near zero
after expiry runs); lead response time (contact/callback → staff
action); content moderation queue age (guest blog pipeline).

Reliability and security: public-page availability and p95 latency
(needs APM/synthetics — nothing wired today); checkout error rate
(5xx on booking/payment routes); cron success rate per job (12 jobs on
VPS after the migration item); failed admin logins and lockouts;
rate-limit hit rate by endpoint (abuse signal); audit-log completeness
spot-checks (every mutation leaves a row).

Guest experience: confirmation-email delivery rate (Resend bounces);
contact-form completion rate; review score trend (Google cache +
post-stay solicitation once built); accessibility spot-checks per
release (keyboard-only booking run); Bengali-mode parity checks
(digits, dates, key flows).

## Part F — Differentiators (USPs) for the pitch

Bangladesh-first payments: five rails including bKash, Nagad, and
BanglaQR alongside Stripe and SSLCommerz — guests pay how they actually
pay. Double-booking-proof inventory: physical units guarded by a
database exclusion constraint, not hope. A real back office, not a
brochure site: folio, night audit, housekeeping, purchasing, payroll,
and journals in one login. Accountability by design: 10-role permission
matrix with an audit row behind sensitive actions. Money without
rounding bugs: integer-poisha discipline enforced by lint. Bilingual to
the digits: full bn mode with local numerals and lakh grouping.
PCI-sane: hosted checkouts keep card data off your servers. And the
honest roadmap slide: OTA sync, VAT engine, and guest self-service are
sequenced next — sell direct-booking independence today, platform
depth tomorrow.

---

End of record. Update this file as phases land; it is the owner's
one-page-per-topic companion to the engineering trail in 00–07.

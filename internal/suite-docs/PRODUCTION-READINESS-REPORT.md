# Production Readiness Report — 2026-10-09

Audit and finalization pass for the `demo.vivereply.com` deploy and for direct replication to
resort clients. Branch: `hardening/production-finalization` (cut from `main`, which already
carries all four payment-gateway hardening passes and RMS Phase A1/A2/B/B2 merged).

**Headline:** this codebase was already well past a typical "needs an audit" state. All four
payment gateways have dedicated hardening history (`docs/PAYMENTS-*-VERIFICATION.md`,
`*-SECURITY-REVIEW.md`); the booking/RMS concurrency model is enforced at the database level,
not just in application code; SEO/structured-data coverage is extensive. This pass closed a
short list of concrete gaps (below) rather than rebuilding anything, and leaves a clear,
owner-actionable checklist for what's left before a *real client's* money and guest data go
through it.

Three read-only surveys (payments/RMS/booking, SEO/AEO/GEO, security) covered the codebase;
every finding below was then re-verified directly against current source before acting on it —
two survey findings turned out to be false positives or need a different fix than first assumed
(§5, §7), which is called out explicitly rather than silently corrected.

---

## 1. General finalization — what changed this pass

Five commits on `hardening/production-finalization`, each independently reviewable:

| Fix | File(s) | Why |
|---|---|---|
| Mask NID/passport, drop internal logs on booking confirmation | `src/app/booking/confirmation/[id]/page.tsx` | Page is reachable by UUID alone, no login — see §6. |
| Fail closed on missing `BETTER_AUTH_SECRET` in production | `src/lib/auth.ts` | Previously only warned; a PM2 cluster would run each worker on a different secret. |
| `pnpm check:env` — one-command pre-deploy secret checklist | `scripts/check-production-env.ts` | See §4. |
| `HowTo` JSON-LD on `/how-to-reach` + `public/llms.txt` | `src/lib/structured-data/how-to.ts`, `public/llms.txt` | See §2. |
| Remove duplicate font preload | `src/app/layout.tsx` | One of three root causes already diagnosed by the paused perf sprint; see §2. |

`pnpm lint`, `pnpm build` and `pnpm test` (711 passed, 0 failed, 590 skipped — the skipped
suites need a `DATABASE_URL_TEST` database and run via `pnpm test:*:db`) all pass clean on top
of these changes.

### Not changed, and why

- **The generic webhook router** (`src/app/api/webhooks/payment/route.ts`) — first assessed as
  dead/dangerous code to delete. On closer reading it's the opposite: every gateway adapter's
  `verifyWebhook()` is hard-coded to refuse it, and all four gateways' test suites assert this
  refusal by name (`GENERIC_WEBHOOK_REJECTED`/`GENERIC_WEBHOOK_REFUSED` audit log events,
  checked in `src/lib/payments/{bkash,nagad,sslcommerz,banglaqr}/*.test.ts`). It's a deliberate,
  tested, audit-logged tripwire, not dead code — deleting it would have removed working
  monitoring and broken four test files. Left unchanged.
- **Dynamic BanglaQR, real malware scanning for receipts, Sentry/error tracking** — all
  previously, explicitly deferred by owner decision (dynamic QR: D2 in
  `docs/PAYMENTS-BANGLAQR-VERIFICATION.md`). Not reopened here.
- **The rest of the paused performance-remediation sprint** (Noto Bengali `unicode-range`,
  hero image `fetchpriority`) — these need a measured Lighthouse re-run to confirm, which is
  exactly what that sprint (`docs/perf/REMEDIATION-LOG.md`, branch `perf-remediation`) was
  already set up to do. Only the one safe, already-diagnosed, zero-risk fix (duplicate preload)
  was taken here; resuming the full sprint is an owner call (§2 flags the current numbers).

---

## 2. SEO / AEO / GEO

`docs/seo/` is a complete, current spec (strategy, AEO/GEO guide, content/schema conventions,
local SEO checklist, performance budget) — not a wishlist. Verified against code:

- **Structured data**: every schema type in `docs/seo/SCHEMA-REFERENCE.md` is implemented and
  wired to a real page (`src/lib/structured-data/`). Added `HowTo` this pass — `/how-to-reach`
  had a semantic `StepList` with no matching rich-result type; now it does, built from the same
  strings the visible list renders so they can't drift apart.
- **Sitemap, robots.txt, feed.xml**: all implemented and matching the documented conventions.
- **Per-page metadata**: present on every spot-checked public route.
- **Two previously-flagged issues are fixed in current code, not stale**: the homepage
  `AggregateRating` reads live Google review data (not hardcoded 4.9/48), and the destination
  detail page's phone number is a passed-in prop sourced from brand config, not a literal.
- **New**: `public/llms.txt`, pointing AI assistants/research tools at the booking,
  property-info, policy and contact pages. **This is a per-client template** (same pattern as
  `docs/seo/KEYWORD-MAP.md`) — it ships with the sample "Client Resort & Spa" copy and must be
  regenerated with the real brand name and domain before a client site goes live.
- **Genuinely unfilled, by design, not a bug**: `docs/seo/KEYWORD-MAP.md` and
  `LOCAL-SEO-CHECKLIST.md` are blank per-client templates requiring real keyword research and a
  Google Business Profile claim — these cannot be completed generically; they're a go-live step
  for each deployment (demo included).
- **Performance budget — the one real open gap**: last measured 2026-09-28, homepage Lighthouse
  mobile 81/100 (target ≥90), LCP 5.3s (target ≤2.5s), JS/fonts both over budget. Root causes
  are already diagnosed (`docs/perf/REMEDIATION-LOG.md`); the owner paused the sprint mid-way.
  One of the three diagnosed fixes is done (§1); the other two need the owner's go-ahead to
  resume measuring.
- **Bengali SSR** is a documented, known limitation (client-side `?lang=bn` toggle; canonical
  always points to English) with its own migration plan in `SEO-STRATEGY.md` §8 — not addressed
  here, by design (out of scope for a finalization pass, it's a routing-architecture change).

**Owner action before a real client launches:** fill in that client's `KEYWORD-MAP.md` and
`LOCAL-SEO-CHECKLIST.md`, regenerate `llms.txt` with their brand, and decide whether to resume
the performance sprint before or after launch.

---

## 3. RMS

See `docs/rms/INDEX.md` (new this pass) for the full per-module reference. Summary: Front Desk,
Housekeeping, Rooms, Reports and Owner Dashboard are live and merged. Settings' PMS and Tax tabs
are documented placeholders, not broken features. Known, scoped-out gaps: room moves (a manager
edits the booking's unit instead of a dedicated "move" action), housekeeper assignment, and
drawer handover/safe tracking — all explicitly deferred to a later phase in
`docs/rms/phase-b2/03-VERIFICATION.md`, not oversights.

---

## 4. Module completeness

Cross-codebase scan for `TODO`/`FIXME`/stub markers found only the already-known, already-
documented items: dynamic BanglaQR bank adapters (owner decision to keep disabled), BanglaQR
receipt malware scanning (re-encode only, no real AV), Sentry error tracking (console.error
today), and the Settings PMS/Tax placeholder tabs. No undocumented incomplete feature was found
posing as finished.

**New**: `pnpm check:env` — every payment gateway already validates its own configuration at
request time, but nothing checked all of them plus the core secrets (auth, cron, email) in one
pass before a deploy. This is the single most useful thing for replicating this template to a
new client: run it against that client's `.env` before go-live and it lists exactly what's
missing, gated on which modules that client has turned on.

---

## 5. Payment gateways

All four (bKash, Nagad, SSLCommerz, BanglaQR) have been through a dedicated hardening pass with
verification and security-review docs. Current, still-open items **requiring the owner's
credentials or a business decision, not more code**:

| Gateway | Open item |
|---|---|
| bKash | No real SNS webhook has ever been received — verifier is untested against live traffic. Refund window (7 days) is an assumption pending the merchant agreement. |
| Nagad | No sandbox credentials were ever obtained — initialize-signature format, `X-KM-IP-V4`, callback field name and base URLs are implemented per published spec only, never exercised live. |
| SSLCommerz | IPN delivery from the real SSLCommerz servers is unverified (sandbox can't reach localhost) — needs a public HTTPS store to confirm. Production endpoint never exercised, sandbox only. |
| All four | Refund window (7 days) is an assumed default in every gateway, not confirmed per merchant agreement. |

**Cron scheduling — re-verified, not a gap.** An earlier survey pass flagged "no scheduler
wired up." That's a false positive: this project deploys to a BDIX VPS via PM2/Nginx, not a
serverless platform, and `docs/DEPLOYMENT.md` §7.2a–d already documents the exact crontab lines
for every reconcile/retention/night-audit job, keyed off `CRON_SECRET`. Confirmed present and
correct; no code change needed. **Owner action:** actually add those crontab lines on the demo
VPS (and every client VPS) — the doc existing isn't the same as the cron running.

**Inventory counter — re-verified, lower severity than first flagged.** A survey finding read
as "inventory isn't restored when a booking is cancelled," which would be a real booking-
correctness bug. On inspection, that only affects the **deprecated** `Room.availableUnits`
column. Real availability is computed from `RoomUnit` rows plus a Postgres exclusion constraint
(§7), and the guest-facing "Available Units" number on destination/room pages reads a live
`_count.units`, not the stale column. This is vestigial technical debt (the column drifts and is
inconsistently written by BanglaQR's settlement code and the PMS sync engine), not a guest-
facing bug. Left as-is — a correct fix means touching PMS-sync semantics, which is a separate,
larger piece of work than this pass's scope.

---

## 6. Security

- **Fixed this pass**: booking confirmation PII exposure (§1), auth secret fail-closed (§1).
- **Admin route/Server Action guards**: all three automated guard scripts
  (`check-admin-api-guards.sh`, `check-require-role.sh`, `check-server-actions.sh`) run inside
  `pnpm lint` and pass. Spot-checked several admin routes directly (not just trusting the
  scripts) — each calls `requireRole`/`requirePermission` correctly.
  - `hotfix/f1-unauth-admin-routes` (already merged to `main`) is the historical incident these
    scripts exist to prevent recurring: eight unauthenticated admin API routes were deleted
    outright. The scripts statically grep for guard calls on every route under
    `src/app/api/admin/**`, `cron/**`, `webhooks/**` — they'd catch a plain missing guard, but
    not a guard called with the wrong resource/action, or a route under a directory they don't
    scan.
- **Webhook/callback signature verification**: every live entry point verifies a signature
  before trusting a payload (bKash: AWS SNS cert pinning + RSA verify; SSLCommerz: hash-checked
  IPN; BanglaQR: HMAC-SHA256, timing-safe compare). The generic router's safety is covered in
  §1.
- **Rate limiting**: Postgres-backed with an advisory lock (survives PM2-cluster restarts,
  unlike an in-memory counter) for every payment endpoint. **Gap**: better-auth's own sign-in
  endpoint is not covered by this and runs on the library's uncustomized default limiter — worth
  reviewing if brute-force login attempts become a concern.
- **Secrets**: no live keys found in tracked source; only intentional, clearly-labeled test
  fixtures (Nagad test RSA keys, SSLCommerz sandbox vectors). No central env-validation existed
  before this pass for the ~28 secret-like variables across modules — `pnpm check:env` (§4) now
  covers the most important ones; each gateway still validates its own at request time.
- **Update (go-live, `phase-h-golive`):** the sign-in limiter is now database-backed and shared by every PM2 worker, with tight limits on sign-in, the TOTP step and password reset per client address (nginx `X-Real-IP`). Failed and successful sign-ins are audited. The audit log's IP no longer trusts the client-supplied first `X-Forwarded-For` entry. See `docs/rms/go-live/01-GO-LIVE.md`.
- **Known, accepted-risk, not fixed this pass**: a signed-in but under-permissioned admin user
  sees the 403 UI with an HTTP 200 status, because `src/app/admin/layout.tsx` renders before the
  page's own `forbidden()` check runs. No data is exposed — it's a wrong status code, not an
  access-control gap (the page itself still refuses to render real data). Fixing it properly
  means moving auth into middleware, a larger architectural change than this pass's scope.

---

## 7. Booking system (website ↔ RMS integration)

Verified end to end, not just read about: `src/app/api/bookings/route.ts` writes into the same
`Booking`/`RoomUnit`/`Guest` tables the RMS front-desk and admin views operate on — there is no
separate "website" data model.

Concurrency safety is enforced at three layers, not just application logic:
1. A Postgres **`EXCLUDE USING gist`** constraint (`Booking_unit_no_overlap`) rejects two live
   bookings overlapping on one unit, at the database level, regardless of what wrote them.
2. `assignUnit()` takes a **transaction-scoped advisory lock** per room type before assigning,
   avoiding GiST-index deadlocks between concurrent requests for the same room type.
3. `withUnitRetry()` retries the whole transaction from scratch on a constraint violation or a
   detected deadlock (Postgres `40P01`).

This is a genuinely solid design, already built — nothing to fix here.

---

## 8. Documentation produced this pass

- `docs/PRODUCTION-READINESS-REPORT.md` — this report.
- `docs/rms/INDEX.md` — per-module RMS reference (what it does, who can use it, routes, library
  code, link to the full phase doc) tying together the existing phase-by-phase docs, for the
  planned RMS documentation project.
- `docs/seo/SCHEMA-REFERENCE.md`, `docs/seo/AEO-GEO-GUIDE.md` — updated with the new `HowTo`
  schema and `llms.txt` entries.
- `docs/DEPLOYMENT.md` — documented `pnpm check:env`.

## 9. Owner action checklist before go-live (demo and every client)

- [ ] Set `BETTER_AUTH_SECRET`, `CRON_SECRET`, `RESEND_API_KEY`/`RESEND_FROM_EMAIL` in `.env`.
- [ ] Run `pnpm check:env` and resolve everything it flags for the gateways this deployment
      actually enables.
- [ ] Add the crontab lines in `docs/DEPLOYMENT.md` §7.2a–d for every enabled gateway (the docs
      existing is not the same as the jobs running).
- [ ] Confirm the 7-day refund window with each enabled gateway's merchant agreement.
- [ ] For Nagad: obtain sandbox credentials and run a real test payment before enabling it for
      a live client. For SSLCommerz: get a public HTTPS IPN URL and confirm real IPN delivery.
- [ ] Fill in that client's `docs/seo/KEYWORD-MAP.md` and `LOCAL-SEO-CHECKLIST.md`; regenerate
      `public/llms.txt` with their brand name and domain.
- [ ] Decide whether to resume the paused performance-remediation sprint before launch.

## 10. Addendum: RMS finished (2026-10-09)

After this report, Phases E, F, G, A3 and the go-live work completed the RMS:
- **E:** purchasing and expenses.
- **F:** the books, supplier bills and payments, petty cash, reports.
- **G:** HR and payroll.
- **A3:** the audit log viewer; the audit log made append-only.
- **Go-live:** system health, heartbeats for every scheduled job, sign-in rate limits, the complete crontab.

Every module in `RMS_MODULE_KEYS` is built; none is "planned". The per-client steps are in [`docs/GO-LIVE-CHECKLIST.md`](GO-LIVE-CHECKLIST.md), which replaces the §9 list above, and the per-module reference is `docs/rms/INDEX.md`.

**Closed from this report:**
- §6's sign-in limiter gap.
- §5's "add the crontab lines": three jobs were undocumented. DEPLOYMENT.md §7.2e now lists all of them, and Admin › System health shows which have actually run.

**Still open, unchanged:**
- the gateway items in §5 (they need credentials or the merchant agreements);
- dynamic BanglaQR and real receipt malware scanning (owner decisions);
- Sentry or other error tracking;
- the 200-status-on-403 quirk (§6);
- the paused performance sprint;
- VAT (needs the property's registration details).

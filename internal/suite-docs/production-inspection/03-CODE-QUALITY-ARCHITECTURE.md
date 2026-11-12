# 03 — Code Quality & Architecture

Overall: structurally above-average monolith with genuinely good money/auth/settings foundations, weighed down by payment duplication, a Payment god-model, deploy-target drift, and docs sprawl. No Critical data-loss/RCE pattern seen; 3 Highs below.

## High

### CQ-H1 — Vercel cron gap: only night-audit scheduled, reconcile jobs orphaned (blocker on Vercel)
- Evidence: `vercel.json` crons: `[/api/cron/night-audit]` vs `src/app/api/cron/*` 12 routes: `bkash-reconcile`, `nagad-reconcile`, `sslcommerz-reconcile`, `stripe-reconcile`, `ledger-posting`, `pms-sync`, `pending-expiry`, `banglaqr-release`/`retention`, `blog-attempts-cleanup`, `fetch-google-reviews`.
- Risk: on Vercel, EXECUTING/VERIFYING payments never reconcile; pending bookings never expire.
- Fix: add all cron paths (Hobby limit is 2/day-triggered — use one fan-out route or upgrade), or document Vercel as demo-only and VPS cron owns jobs. Add monitoring for last-run timestamps.

### CQ-H2 — Migrations run inside build
- Evidence: `package.json` `build`: `prisma generate && prisma migrate deploy && next build`. `Dockerfile:38-39` (`ARG DATABASE_URL`, generate + build).
- Risk: concurrent deploys race `migrate deploy`; build requires live DB (comment admits); failed migration fails build artifact.
- Fix: split migrate into deploy pipeline (Vercel: post-promotion hook; VPS: release command). Keep build = `generate` + `next build` only.

### CQ-H3 — Payment god-model
- Evidence: `prisma/schema.prisma:287-363` Payment carries BanglaQR (~12 cols), bKash, Nagad, SSLCommerz, Stripe groups + 4 separate refund models (`BkashRefund`, `NagadRefund`, `SSLCommerzRefund`, `StripeRefund`).
- Risk: every gateway change touches central table; partial unique indexes in raw SQL per migration desync easily.
- Fix: extract per-gateway detail tables 1:1 with Payment, or single `detail Json` + Zod per provider; unify refunds into one `Refund` with provider enum. Do as a planned migration, not a launch-day edit.

## Medium

### CQ-M4 — Stringly-typed core statuses
- `schema.prisma:261` (`Booking.status` String), `:291`/`:297` (`Payment.provider/status` String). Elsewhere enums exist (`RoomUnitStatus :217-224`), so convention is inconsistent.
- Fix: migrate Booking/Payment status + provider to Postgres enums.

### CQ-M5 — JSON-in-String columns
- `schema.prisma:119-121` (Destination `galleryImages`/`amenities`), `:140-141` (Room `images`/`amenities`) as String.
- Fix: convert to `Json` or native `String[]`; add Zod at read boundary.

### CQ-M6 — Per-gateway module duplication (~1500 lines refactorable)
- `src/lib/payments/{bkash,nagad,sslcommerz,banglaqr}/rate-limiter.ts`, `token.ts`, `audit.ts`, `config.ts`, `settings.ts`, `notifications.ts` — e.g. `bkash/rate-limiter.ts:33-56` vs `nagad/rate-limiter.ts:42-66` ~90% identical wrappers over well-designed `shared/rate-limit.ts:22-39` (advisory-lock sliding window).
- Fix: generic `enforceGatewayRateLimit(provider, check, {errorFactory, auditFn})` in `shared/`; same for token issuance and audit envelope.

### CQ-M7 — Stripe missing from production env checks
- `src/lib/system/env-checks.ts:94-95` lists Core/Email/Bkash/Nagad/SSL/BanglaQR; `registry.ts:129-142` shows STRIPE live with required `secretKey` + `webhookSecret`.
- Fix: add `checkStripe()` requiring `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` when enabled; also cover R2/blog/PMS vars and `PAYMENT_MODE`.

### CQ-M8 — Inconsistent API validation + no shared response helper
- `src/app/api/bookings/route.ts:31-43` manual destructure + truthiness (no zod, no email/phone format check) while `money.ts` uses Zod `AmountSchema`. Route-local `clientIp()` (`:20-24`) duplicates `lib/blog/client-ip` (used in `auth.ts:109`). Error shapes hand-rolled per route vs `demoError()` in `demo-payments/handlers.ts:20-22`.
- Fix: Zod on all public routes; extract `clientIp` + `apiOk`/`apiErr` into `lib/http.ts`; unify `demoError`.

### CQ-M9 — Zombie availability counter + deprecated role remnants
- `schema.prisma:142-148` (`availableUnits` still decremented by payment code, documented unreliable). `permissions.ts:219-255` (STAFF mirror + legacy hierarchy), `auth-helpers.ts:12-21` (`@deprecated UserRole`), `auth.ts:122-124`.
- Fix: stop decrementing `availableUnits` in confirm paths (units are source of truth); schedule removal release for STAFF + `money-legacy.ts` + Float columns together.

### CQ-M10 — Test gaps: zero UI coverage, `.tsx` excluded
- `vitest.config.mts` include: only `*.test.ts`. Zero `*.test.tsx`. Largest UI files (`BookingDetailView` ~877 lines, `DashboardView` ~476, `BookingStepper` 484) untested. No E2E runner (`eslint.config.mjs` only gitignores `.playwright-mcp/`).
- Fix: add jsdom/happy-dom + testing-library, include `**/*.test.{ts,tsx}`; start with BookingStepper + payment-panel state machines; add one Playwright smoke (book → pay → confirm).

### CQ-M11 — Docs sprawl + brand-in-routing
- 286 files under `docs/` + `documentation/` + `wip/` plus 14 root `*.md`. `wip/` contains `leads_clean.csv`, patches, sales scripts. Route group `src/app/(swiss)/` hardcodes demo brand. Dual blog trees `src/app/blog/*` and `src/app/(swiss)/blog/*`.
- Fix: single `docs/` tree with INDEX + `archive/` for phase logs; move `wip/` sales artifacts out of repo; rename `(swiss)` → `(site)` with brand via config; consolidate blog routes.

### CQ-M12 — Three deploy targets drifting
- `vercel.json` (Vercel) vs `Dockerfile` (standalone) vs `ecosystem.config.js` (PM2 cluster) + `cache-handler.cjs`. `Dockerfile:10` uses `pnpm@latest` while `packageManager` pins `pnpm@12.4.2`. `next.config.ts` `r2PublicPattern()` reads `R2_PUBLIC_DOMAIN` at build time (build/runtime skew).
- Fix: pin pnpm in Dockerfile; move R2 host to runtime config; declare one primary target in `DEPLOYMENT.md`, mark others community-supported.

## Low

- `LanguageContext.tsx:23,53` module-global `selectedLang` + `useSyncExternalStore`; SSR always English so Bengali visitors flash EN first. If BN traffic matters, set lang from `NEXT_LOCALE` cookie in root layout (server).
- `tsconfig.json`: `strict` true but no `noUncheckedIndexedAccess`/`exactOptionalPropertyTypes` — cheap wins for 965-file TS codebase.
- `console.*` in 53 files vs `lib/error-tracking.ts` + per-gateway `log.ts` existing — route through loggers.
- `middleware.ts` full Prisma session lookup per admin request (DB round-trip, nodejs runtime) — consider edge-safe JWT session or short cache.
- `src/app/actions/admin-actions.ts:1027` lines god-file importing 4 gateway status-guards — split per domain (bookings/rooms/guests).
- `src/content/en.ts` + `bn.ts` (3355/3354 lines) parallel dictionaries — parity script mitigates; long-term move to keyed JSON + typecheck.
- `PaymentAdapter` (`payments/types.ts:49-53`) aspirational — gateways use bespoke names (`create` vs `initialize` vs `initiate`, see demo `CREATE_ENDPOINT` map `handlers.ts:37-42`). Implement for real or delete.

## Strengths (keep)

Poisha money discipline + lint enforcement. Exhaustive permission matrix with doc-cross-check test. Settings singleton w/ brand fallback and cross-worker invalidation. Idempotent booking transaction with unit retry. Per-gateway audit/rate-limit/reconcile depth + 122 test files. Demo-mode 404 gating (`handlers.ts:24-26`).

## Unresolved

- `payments/gateways.ts` + `resolve.ts` + `vault.ts` bodies unopened — PaymentAdapter adoption beyond `types.ts` not fully confirmed.

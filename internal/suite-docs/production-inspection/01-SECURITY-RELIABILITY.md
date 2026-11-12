# 01 — Security & Reliability

Scope: auth, secrets, injection, validation, headers, rate limiting, webhooks, dependencies.
Method: read-only, all findings from opened bodies. No exploit executed.

## Blocker / High

### H1 — `.env` baked into Docker image (High, production blocker)

**Status 2026-11-01: exclusion FIXED** (`.dockerignore:13-14` now excludes `.env*`, keeps `.env.example`). Remaining owner actions: rebuild images from clean context, rotate any secret ever built into an image.
- Evidence: `.dockerignore:1-12` never excludes `.env`. `Dockerfile:24` `COPY . .` copies context into builder. Local `.env` holds live remote Supabase pooler `DATABASE_URL` plus auth/payment secrets (host verified, values redacted). Git history clean, but any image/layer access leaks prod credentials.
- Fix: add `.env*` to `.dockerignore` (keep `!.env.example`). Pass secrets via build args/env only. Rotate any secret ever built into an image. Add CI check that image layers contain no `.env`.

### H2 — Rate-limit bypass via spoofed X-Forwarded-For (High, blocker)

**Status 2026-11-01: FIXED.** All 4 routes plus two extra instances found by sweep (`api/payments/stripe/create` rate limit + audit IP, `stripe-actions.ts` audit IP) now use proxy-safe `clientIp` from `lib/blog/client-ip`. Proof: 6 new test files, 8 files / 19 tests green (incl. pre-existing contact/callback XFF tests); repo-wide search confirms zero first-XFF parses left in `src`.
- Evidence: `src/app/api/bookings/route.ts:20-24`, `lookup/route.ts:23-27`, `send-details/route.ts:26-30`, `rooms/[roomId]/availability/route.ts:24-28` key limits off FIRST XFF entry (client-controlled; nginx appends real IP last and sets `X-Real-IP`). Effects: booking mass-hold caps defeated; `lookup` 60/hr enumeration cap defeated (leaks first name + stay dates + status); availability scraping cap defeated; `send-details` 10/hr cap defeated → targeted email bombing + Resend quota burn to any known guest address.
- Fix: use existing proxy-safe `clientIp()` from `src/lib/blog/client-ip.ts` (x-real-ip, else LAST xff) everywhere, as payment modules already do. Add regression test with multi-entry XFF.

### H3 — Hardcoded TEST/DEMO banner in guest emails (High, blocker)
- Evidence: `src/app/api/bookings/send-details/route.ts:99` and `src/lib/email/index.ts:49,94,128` embed `TEST / DEMO EMAIL — Krishnachura Retreat demo site (demo1.vivereply.com)… please ignore it` with no env gate. Every production confirmation, lead alert, receipt disclaims itself as fake.
- Fix: render banner only when `NODE_ENV != production` or explicit `DEMO_BANNER=true`. Scrub demo domain from prod templates.

### H4 — Demo payments can confirm real bookings free (High, blocker)
- Evidence: `src/demo-payments/handlers.ts` approve path calls `applyDemoConfirmation` → PRODUCTION booking CONFIRMED + payment record + email with no money moved. `token.ts:13-15` falls back to hardcoded `demo-payments-dev-secret-NOT-FOR-PRODUCTION`. `PAYMENT_MODE=simulate` not checked by `scripts/check-production-env.ts` / `env-checks.ts`. Single env var + forgeable default token = free stays.
- Fix: refuse simulate mode when `NODE_ENV=production` unless explicit `DEMO_PAYMENTS_SECRET` set; add `PAYMENT_MODE` to `check:env` fail list; alert on `NEXT_PUBLIC_PAYMENT_MODE` mismatch.

## Medium

### M1 — `/api/chat` unbounded OpenAI spend
- Evidence: `src/app/api/chat/route.ts:1-28` no rate limit, auth, or length cap. `ragService.ts:51-74` calls `gpt-4o-mini` per message, embeds unbounded `userQuery`, no fetch timeout.
- Fix: shared `consumeRateLimit` per IP + 2–4k char cap + `AbortSignal.timeout`.

### M2 — Open redirect after admin login
- Evidence: `src/app/admin/login/page.tsx:29` `redirectUrl = searchParams.redirect || '/admin'`, passed unvalidated to `router.push` at `:46` and `:81`. Middleware sets it from pathname, but attacker crafts `/admin/login?redirect=https://evil`.
- Fix: allow only same-origin paths starting with single `/`. See also [02](02-ADMIN-DEEP-DIVE.md).

### M3 — No security headers anywhere
- Evidence: `next.config.ts` has no `headers()`. `docs/DEPLOYMENT.md` nginx template (§4, `:209-256`) sets no HSTS, `X-Frame-Options`/CSP `frame-ancestors`, `X-Content-Type-Options`, `Referrer-Policy`. Admin is clickjackable; no HSTS despite HTTPS-only design.
- Fix: add `headers()` in `next.config.ts`; add `add_header` set in nginx template; verify with `curl -I`.

### M4 — PMS webhook validation/logging gaps
- Evidence: `src/app/api/webhooks/pms/[provider]/route.ts:38` logs full payload incl guest PII; `:138` returns `error.message` internals; `:45-83` no zod (roomId unchecked → FK errors, `toPoisha(NaN)`, negative units accepted, date defaults); `:68-83` upsert unconditionally sets CONFIRMED (resurrects cancelled/refunded); no rate limit. Auth (shared secret, constant-time, fail-closed) is good.
- Fix: zod schema, state-transition guard (never CONFIRM from CANCELLED/REFUNDED without explicit event), strip PII/details from logs and responses, add `consumeRateLimit`. See [05](05-FUNCTIONS-DATA-APIS.md).

### M5 — Contact/callback lead routes lack validation, per-process limits
- Evidence: `contact/route.ts:27-46`, `callback/route.ts:27-45` no type/length checks (objects accepted, unbounded strings → DB bloat), no email-format check; rate limits in-memory per-process (×N under PM2 cluster). Downstream email escaping correct (`escapeHtml` + subject newline-strip).
- Fix: zod schemas with max lengths + shared DB-backed `consumeRateLimit`.

### M6 — OWNER MFA not enforced globally
- Evidence: `requireMfa()` (`auth-helpers.ts:97-105`) only on sensitive entry points; `requirePermission()` path needs only `requireAuth()` (forced-2FA enrollment check). OWNER with 2FA never forced operates without MFA.
- Fix: enforce `requireMfa` in `requirePermission` for OWNER, or force 2FA for OWNER at invite.

### M7 — Generic webhook duplicates payment rows
- Evidence: `src/app/api/webhooks/payment/route.ts:57-66` creates Payment rows with no idempotency/dedupe; provider retries duplicate records; plus legacy `availableUnits` decrement alongside unit system.
- Fix: provider+transactionId unique handling like per-provider routes, or retire route if superseded. Confirm no live dashboard points here.

## Low

- L1: token-route limit per-process memory (`token-route.ts:13-23`) — acceptable given 256-bit single-use hashed tokens (`tokens.ts`); note only.
- L2: `prisma/seed-admin.ts:45` prints admin email/password to stdout → lands in deploy logs. Redact password.
- L3: `explore-the-area/page.tsx:36` raw `JSON.stringify` into script tag (static brand strings only, safe today); use `serializeJsonLd()` for consistency.
- L4: `storage/r2.ts:61-65` `getPresignedR2Url` falls back to constructed PUBLIC URL when R2 unconfigured — ensure receipt callers never hit this in prod.
- L5: `scanReceiptForMalware` (`file-security.ts:175-178`) documented stub returning clean; sharp re-encode is real defense — track TODO.
- L6: `/booking/confirmation/[id]` exposes full guest PII on UUID knowledge (`page.tsx:24-72`; NID masked — good). Unguessable IDs + noindex make acceptable; note no rate limit.
- L7: password policy = Better Auth length-only defaults (`accounts.ts:208-217`), no complexity/breach check.

## Verified strong (no action)

Middleware session validation (`src/middleware.ts`). Permission matrix fail-closed + middleware + `requirePermission` layering. Invite/reset tokens hashed/sha256, single-use, TTL, race-safe consume. Cron/auth header-only secrets with timing-safe compare, fail closed. Stripe/SSLCommerz signature verification + idempotent handlers. Blog guest pipeline (honeypot, signed time-gate, advisory-lock limit, Turnstile fail-closed, zod, disposable/duplicate/content screens). Image pipeline (magic bytes, sharp decode+re-encode, EXIF strip, pixel caps). Blog markdown `sanitize-html` allowlist (no img, scheme-restricted links). CSV formula-injection neutralisation (`finance/export` `cell()`). Email header-injection guards (subject newline strip, `BARE_ADDRESS`, label sanitize, validated replyTo). All SQL parameterized (only Unsafe uses are static test strings). `.env` gitignored with clean history. Nagad `.pem` are documented test fixtures. Secrets fail-fast in prod (`BETTER_AUTH_SECRET/URL`). `send-details` generic-reply + stored-address-only design.

## Dependencies

No known-risk libs flagged by inspection (Next 16.3.5, React 19, better-auth 1.7.5, Prisma 6.19.3, zod 3.23.8, sanitize-html 2.17.7, sharp 0.35.5). Not run here: `pnpm audit`. Add `pnpm audit` + Dependabot in CI before launch.

## Unresolved

- BanglaQR receipt object ACL in R2 (private vs public bucket) — `src/lib/payments/banglaqr/receipt-storage.ts` not inspected.
- Whether legacy generic `webhooks/payment` is registered on any live provider dashboard vs superseded by per-provider routes.
- Better Auth session cookie flags (Secure/HttpOnly/SameSite) rely on framework defaults — not explicitly configured in `src/lib/auth.ts`.

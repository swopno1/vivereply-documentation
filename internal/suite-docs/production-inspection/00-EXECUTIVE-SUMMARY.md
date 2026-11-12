# Travel-Scaffold Production Readiness Inspection — Executive Summary

Date: 2026-11-01
Scope: `travel-scaffold/` (Next.js 16 + React 19 + Prisma/Postgres + Better Auth)
Method: read-only inspection by 6 focused auditors (security, /admin, code quality, UI/UX, business/legal, functions/data). No code changed. No exploit executed. All findings cite opened file bodies.
Verdict: **NOT production-ready yet. Demo-grade with strong foundations, blocked by ~10 launch blockers.**

## Verdict in one paragraph

Do not deploy to paying properties yet. Money handling (poisha discipline), double-booking guard (RoomUnit exclusion constraint), permission matrix, and per-gateway audit depth are genuinely good. But demo artifacts ship in production paths (email banners, demo banner layout, mock PMS), secrets can bake into Docker layers, rate limits are bypassable, reconcile/expire crons are orphaned on Vercel, seed can wipe data, VAT/tax is absent, terms acceptance is absent, and guest self-service plus rate plans are missing. Fix the 10 blockers below, then the Highs, then launch as a limited pilot.

## Count by severity (this inspection)

- Blockers (must fix before any production booking): 10
- High: 12
- Medium: ~30
- Low: ~25
- Unresolved / needs follow-up: 15 (listed in each doc)

## The 10 launch blockers

| # | Blocker | Evidence | Doc |
|---|---------|----------|-----|
| B1 | `.env` baked into Docker image | `.dockerignore:1-12` omits `.env`; `Dockerfile:24` `COPY . .`; live Supabase pooler URL on disk | [01](01-SECURITY-RELIABILITY.md) |
| B2 | Demo payments can confirm real bookings free | `src/demo-payments/handlers.ts` approve path; `token.ts:13-15` dev-default secret; no `PAYMENT_MODE` deploy guard | [01](01-SECURITY-RELIABILITY.md) |
| B3 | Rate-limit bypass via first-XFF on 4 public routes | `api/bookings/route.ts:20-24`, `lookup:23-27`, `send-details:26-30`, `availability:24-28` | [01](01-SECURITY-RELIABILITY.md) |
| B4 | TEST/DEMO banner hardcoded in guest emails | `send-details/route.ts:99`, `lib/email/index.ts:49,94,128` | [01](01-SECURITY-RELIABILITY.md) |
| B5 | Seed wipes data unconditionally | `prisma/seed.ts:200-246` `deleteMany` + fabricated reviews, no `NODE_ENV` gate | [05](05-FUNCTIONS-DATA-APIS.md) |
| B6 | No terms/privacy acceptance at booking | `BookingStepper.tsx:324-443` zero checkbox/link | [06](06-BUSINESS-HOSPITALITY-LEGAL.md) |
| B7 | PMS webhook can resurrect cancelled bookings, logs PII | `webhooks/pms/[provider]/route.ts:40-127`, `:38`, `:138` | [05](05-FUNCTIONS-DATA-APIS.md) |
| B8 | Legacy generic payment webhook duplicates rows | `webhooks/payment/route.ts:8-114`, `:57-66` no idempotency | [05](05-FUNCTIONS-DATA-APIS.md) |
| B9 | Stripe dispute upsert FK-crash | `lib/payments/stripe/webhook.ts:199-216` `paymentId ''` | [05](05-FUNCTIONS-DATA-APIS.md) |
| B10 | Vercel cron gap orphans reconcile+expiry | `vercel.json` 1 cron vs 12 routes in `api/cron/*` | [03](03-CODE-QUALITY-ARCHITECTURE.md) |

## Top 20 prioritized actions (do in this order)

1. Add `.env*` to `.dockerignore`; rotate any secret ever built into an image.
2. Gate `seed.ts` on non-production; remove fabricated reviews from seed.
3. Hard-fail `PAYMENT_MODE=simulate` in production; require explicit secret; add to `check:env`.
4. Env-gate demo email banner; remove demo domain copy from prod emails.
5. Fix `clientIp()` on all 4 public routes (use `lib/blog/client-ip.ts` semantics).
6. Add mandatory terms/privacy checkbox; store version + timestamp on booking.
7. Fix PMS webhook: zod schema, state-transition guard, strip PII/logs, rate limit.
8. Retire or harden legacy `webhooks/payment` (idempotency by provider+txn id).
9. Fix Stripe dispute upsert (nullable payment link or find-first, no `''` FK).
10. Fix Vercel cron coverage (fan-out route or declare VPS as prod target).
11. Move migrations out of `build` into deploy pipeline.
12. Enforce `PAYMENT_MODE`, Stripe, R2, PMS vars in env checks.
13. Fix handoff auth (AUDITOR mutation via FRONT_DESK view).
14. Add security headers + nginx HSTS/frame-ancestors.
15. Add rate limit + input cap + timeout to `/api/chat`.
16. Migrate payments verification pages off legacy `requireRole(MANAGER)`.
17. Fix admin open redirect; add forgot-password; default `rememberMe=false`.
18. Remove demo banner from `(swiss)/layout`; remove fictional footer copy.
19. Fix booking param drop (widget passes, page ignores, stepper empties dates).
20. Write real privacy/terms/refund + consent-gated analytics before collecting PII.

## What is genuinely strong (keep)

Poisha money discipline with lint guard. RoomUnit exclusion constraint against double-booking. Idempotent booking transaction with unit retry. Exhaustive permission matrix with middleware + `requirePermission` layering and fail-closed `ModuleGate`. Hashed single-use TTL invite/reset tokens. Timing-safe cron/auth secrets. Stripe/SSLCommerz signature verify + idempotent handlers. Blog guest pipeline (honeypot, signed gate, advisory limit, Turnstile, zod). Sharp image re-encode + EXIF strip. CSV-injection and email-header guards. Parameterized SQL. Hosted-checkout PCI posture. Retention matrix doc. 122 test files on gateways.

## Document map

- [01 Security & Reliability](01-SECURITY-RELIABILITY.md)
- [02 /admin Deep Dive](02-ADMIN-DEEP-DIVE.md)
- [03 Code Quality & Architecture](03-CODE-QUALITY-ARCHITECTURE.md)
- [04 UI/UX & Usability](04-UI-UX-USABILITY.md)
- [05 Functions, Data & APIs](05-FUNCTIONS-DATA-APIS.md)
- [06 Business, Hospitality, Legal](06-BUSINESS-HOSPITALITY-LEGAL.md)
- [07 Go-Live Checklist](07-GO-LIVE-CHECKLIST.md)

Read-only review limits: no login/redirect exploit run, no Prisma error reproduction, no real-device a11y test, some admin detail bodies grep-level only. See unresolved lists per doc.

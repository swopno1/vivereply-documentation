# 05 — Functions, Data & APIs

Verdict: **Core booking guard is solid; webhook + seed + validation edges are not.** Fix webhooks and seed before any real money or OTA traffic.

## Blockers

### F-B1 — Legacy generic payment webhook (duplicates + unguarded transitions)
- Evidence: `src/app/api/webhooks/payment/route.ts:8-114`. Creates duplicate Payment rows (`:57-66`, no idempotency/dedupe), unguarded confirm/cancel, legacy counter decrement, provider taken from body.
- Risk: provider retries (Stripe/bKash all retry) duplicate payment records; double-confirm corrupts ledger/folio.
- Fix: retire if superseded by per-provider routes, else add provider+transactionId unique handling + state-transition guard like per-provider handlers. Confirm no live dashboard points here.

### F-B2 — PMS webhook bypasses inventory truth, resurrects bookings, leaks internals
- Evidence: `src/app/api/webhooks/pms/[provider]/route.ts:40-127`. Bypasses unit assignment/availability/date validation, unconditionally CONFIRMs (`:68-83`, can resurrect cancelled/refunded), logs full payload incl PII (`:38`), returns `error.message` (`:138`), no rate limit.
- Fix: zod schema (UUID roomId, positive poisha, valid date range), availability + unit assign, transition guard (never CONFIRM from CANCELLED/REFUNDED without explicit event), strip PII/details from logs/responses, `consumeRateLimit`.

### F-B3 — Seed wipes prod data + fabricates reviews
- Evidence: `prisma/seed.ts:200-246` unconditional `deleteMany` + demo bookings + fabricated Google reviews, no `NODE_ENV` gate.
- Fix: hard-gate on `NODE_ENV != production` (throw if prod); split demo seed from minimal prod seed; remove fabricated reviews from any seed that can run near prod. Note: `seed-test-users.ts:19-22` is correctly gated — follow that pattern.

### F-B4 — Stripe dispute upsert FK-crash
- Evidence: `src/lib/payments/stripe/webhook.ts:199-216` dispute upsert with `paymentId ''` FK-crashes on unmatched PI.
- Fix: nullable payment link or `find-first` + create without bogus FK; log unmatched PI for manual match; test unmatched-PI path.

## High / Medium functional gaps

### F-H1 — Booking API validation + guest-dedupe mismatch
- Evidence: `src/app/api/bookings/route.ts:26-199` no email/phone format validation; guest dedupe/create trim mismatch (lookup vs create normalize differently → duplicate guests).
- Fix: zod email/phone schemas (E.164-ish for BD + international), normalize (trim + lower email) identically on lookup and create; unique constraint + test.

### F-H2 — Missing rate limits
- `src/app/api/payments/stripe/quote/route.ts:11-39` no rate limit (price-quote scraping/abuse).
- `src/app/api/chat/route.ts:4-28` no rate limit or input cap (see [01](01-SECURITY-RELIABILITY.md) M1).
- Fix: `consumeRateLimit` per IP + quote caching; chat cap + timeout.

### F-M1 — Demo banner in prod email path
- `send-details/route.ts:99` hardcoded demo banner (see [01](01-SECURITY-RELIABILITY.md) H3). Same fix.

### F-M2 — UUID-only confirmation page exposes PII
- `src/app/booking/confirmation/[id]/page.tsx:24-64` UUID-only page exposes PII on ID knowledge. NID masked (good). Un guessable IDs + noindex make acceptable, but no rate limit.
- Fix: keep as-is only with noindex + short TTL link or code+phone gate for sensitive fields; add rate limit. Decide whether full PII belongs on a bearer-URL page.

## Strengths (verified)

- Double-booking guarded by advisory lock + exclusion constraint + retry (`src/lib/rooms/availability.ts:160-206`, `:29-36` LIVE statuses).
- Idempotent booking transaction with unit retry (`bookings/route.ts:150-199`).
- Demo routes gated on `PAYMENT_MODE=simulate` (`demo-payments/handlers.ts:24-26`, `:53-54` 404 gate) — but see H4 single-var weakness in [01](01-SECURITY-RELIABILITY.md).
- Test users correctly gated (`seed-test-users.ts:19-22`).
- Pending-expiry 24h + NO_SHOW status exist (`pending-expiry.ts:37`, `status.ts:11`) — but expiry cron orphaned on Vercel (see [03](03-CODE-QUALITY-ARCHITECTURE.md) CQ-H1) and expiry is silent by design (`:33`).

## Suggested function-level launch gate

1. Fix F-B1 through F-B4 + regression tests (retry storm, unmatched PI, PMS resurrect attempt, seed-in-prod refusal).
2. Add zod + normalization to booking + lead routes; add quote/chat limits.
3. Decide confirmation-PII policy; implement gate or accept risk in writing.
4. End-to-end smoke: book → pay → confirm → cancel/refund → reconcile → expire, on the declared prod deploy target (not Vercel if crons live on VPS).

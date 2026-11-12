# Gateway dedupe + refund unification plan (CQ-H3/M6)

Plan only — explicitly not launch-day work. The gateway code is correct
and deeply tested (393 tests); this plan pays down its duplication in
small, separately-shippable slices. No slice changes gateway behavior.

## Measured surface (2026-11-02)

- `bkash` 3151 + `nagad` 3689 + `sslcommerz` 3992 + `banglaqr` 3342 +
  `stripe` 974 non-test lines. Ten parallel files exist in 4–5 gateways:
  `rate-limiter`, `token`, `audit`, `config`, `settings`,
  `notifications`, `mask`, `log`, `errors`, `constants`.
  `shared/` today holds only `rate-limit`, `db-errors`, `hs256`.
- `Payment` carries 77 columns in 5 gateway groups (BanglaQR receipt/
  verification, bKash execute, Nagad challenge, SSLCommerz val_id,
  Stripe links) plus 4 refund relations.
- 4 refund models (`BkashRefund` 16 fields, `NagadRefund` 18,
  `SSLCommerzRefund` 19, `StripeRefund` 19) with the same core:
  payment link, amount, status lifecycle, provider reference, audit.

## Slice order (each slice: one gateway first, the rest follow)

1. **Shared rate-limit envelope.** Generic
   `enforceGatewayRateLimit(provider, check, { errorFactory, auditFn })`
   in `shared/` over the existing advisory-lock limiter. Migrate one
   gateway's `rate-limiter.ts` to a thin wrapper; delete the wrapper
   once all four agree. Lowest risk: limits and keys unchanged.
2. **Shared audit envelope.** One `recordGatewayAudit(provider, …)`
   with per-gateway event-name maps. Same rollout as slice 1.
3. **Shared token issuance.** The HMAC token shape (`hs256.ts` exists)
   is already shared; unify the issue/verify wrappers and TTL
   handling next.
4. **Unified `Refund` model.** New table with `provider` enum +
   shared lifecycle columns + `detail Json` (zod-validated per
   provider) for the divergent fields. Dual-write from the 4 refund
   flows for one release, backfill, then drop the 4 tables. The admin
   refund views move to the unified table in the same release they
   stop reading the old ones — never mixed reads.
5. **Per-gateway `detail Json`.** Move thenullable gateway column
   groups off `Payment` into `detail Json` (zod per provider at the
   read boundary, same pattern as CQ-M5). Keep indexed columns that
   queries filter on (`merchantInvoiceNumber`, `valId`,
   `transactionId`) as real columns; move the rest. This is last
   because it touches every gateway's hottest queries.

## Non-goals / guardrails

- No behavior change in any slice: same limits, same SQL semantics,
  same admin views. Each slice ships with the gateway suite green
  (393 + DB suites where a database exists).
- No big-bang rewrite, no new abstraction without two concrete
  adopters in the same PR.
- `PaymentAdapter` (`payments/types.ts`) stays aspirational until
  slice 5: implementing it for real is the epilogue, not the plan.

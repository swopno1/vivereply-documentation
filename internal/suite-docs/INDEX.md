# Docs index (CQ-M11)

Single map of `docs/`. Everything the repo documents lives here except
the root `README.md`. Historical phase logs live in `archive/`;
`wip/` (sales scratch, lead CSVs) is gitignored and never committed.

## Start here

- [production-inspection/00-EXECUTIVE-SUMMARY.md](production-inspection/00-EXECUTIVE-SUMMARY.md) — the 2026-11-01 inspection verdict + 10 launch blockers.
- [production-inspection/07-GO-LIVE-CHECKLIST.md](production-inspection/07-GO-LIVE-CHECKLIST.md) — phased hardening tracker (tick with DONE date + proof).
- [GO-LIVE-CHECKLIST.md](GO-LIVE-CHECKLIST.md) — per-client go-live steps (config/decisions, not code).
- [DEPLOYMENT.md](DEPLOYMENT.md) — primary target: BDIX VPS + Docker; PM2 alternative; Vercel demo-only.
- [project-description.md](project-description.md) / [project-phases.md](project-phases.md) — what this scaffold is.

## Run it

- [CLIENT-ONBOARDING.md](CLIENT-ONBOARDING.md) — new-client setup.
- [ops/](ops/) — cron jobs, housekeeping runs, money flow, payments setup.
- [release/](release/) — build/test/env verification records.
- [DATA-RETENTION.md](DATA-RETENTION.md) — retention windows + purge basis.
- [EMAIL.md](EMAIL.md) — email integration.
- [LEGACY-REMOVAL-SCHEDULE.md](LEGACY-REMOVAL-SCHEDULE.md) — phased removal of STAFF role, Float mirrors, legacy counter (R2–R5).

## Build on it

- [manual/](manual/) — staff training manual for the admin panel (moved from `documentation/` 2026-11-02, content unchanged).
- [rms/](rms/) — roles/permissions, folio, go-live, phase A1/A2 records.
- [PAYMENTS-*.md](PAYMENTS-BKASH.md) — per-gateway guides + security reviews + verifications (bkash, nagad, sslcommerz, banglaqr).
- [verification/](verification/) — per-gateway verification evidence.
- [blog/](blog/) — blog data model, moderation, guest submission, SEO wiring.
- [seo/](seo/) — keyword map, content guide, local checklist, performance budget, schema reference.
- [design-guide.md](design-guide.md) — UI conventions.
- [FEATURE-PRICING.md](FEATURE-PRICING.md) / [DEMO3-BOHEMIAN.md](DEMO3-BOHEMIAN.md) — packaging + demo notes.
- [perf/](perf/) — performance diagnosis + remediation log.
- [SITE-ROUTE-PLAN.md](SITE-ROUTE-PLAN.md) — `(swiss)` → `(site)` rename + blog consolidation plan (not yet executed).
- [GATEWAY-DEDUPE-REFUND-PLAN.md](GATEWAY-DEDUPE-REFUND-PLAN.md) — gateway dedupe + refund unification plan (not launch-day).

## Demo + showcase

- [VERCEL-DEMOS.md](VERCEL-DEMOS.md) — demo/preview deploys.
- [DEMO-SHOWCASE-VERIFICATION.md](DEMO-SHOWCASE-VERIFICATION.md) — showcase proof.
- [PRODUCTION-READINESS-REPORT.md](PRODUCTION-READINESS-REPORT.md) — readiness snapshot.

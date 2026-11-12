# 06 — Business, Hospitality, Market & Legal

Positioning verdict: sell as **direct-booking website + lightweight PMS for independent BD resorts**. Do NOT position as OTA replacement / channel manager until real sync exists. Base $2–3.5k + $150–300/mo retainers (`../FEATURE-PRICING.md`) is defensible given PMS depth; consider tiering PMS modules as upsells.

## What the product already gets right (verified)

- Physical `Room` + `RoomUnit` inventory with housekeeping status (`schema.prisma:128-189`) and DB exclusion constraint against double-booking (`availability.ts:29-36`).
- Booking lifecycle PENDING/CONFIRMED/CANCELLED/CHECKED_IN/COMPLETED (`schema.prisma:239-275`), 3-step flow with idempotency + live availability (`BookingStepper.tsx:100-155`), 24h unpaid-expiry (`pending-expiry.ts:37`) + NO_SHOW (`status.ts:11`).
- 5 BD rails (bKash/Nagad/SSLCommerz/Stripe/BanglaQR) with per-gateway refund ledgers (`schema.prisma:622-745,1862-1892`).
- Full back-office depth: folio, night audit, front desk, housekeeping, room service, inventory, purchasing, ledger/accounting, HR/payroll, cash shifts (60+ models).
- Solid PCI posture via hosted checkout (`PAYMENTS-SSLCOMMERZ.md:391`, no card data on server) and a real retention matrix (`DATA-RETENTION.md:5-23`).
- Footer links to privacy/terms/refund present (`BrandFooter.tsx:167-186`).

## Hospitality gaps (deal-breakers first)

### BZ-H1 — No VAT/SD tax engine (High)
- `FolioLineKind` has NO tax kind (`schema.prisma:983-989`); `MenuItem` tax-inclusive, VAT deferred to Phase F (`:1029`); `GO-LIVE-CHECKLIST.md:49` VAT/SD open owner decision, no VAT posted; confirmation renders no invoice/tax/BIN lines (grep verified). BD hotels must show VAT+SD.
- Fix: Phase-F tax posting + BIN on invoice + checkout tax breakdown. Block B2B sales until done.

### BZ-H2 — No seasonal/weekend/rate plans or promo codes (High)
- Single `pricePerNightPoisha`. Offers page static marketing with Enquire CTA (`offers/page.tsx`), not bookable rate plans.
- Fix: rate-plan table with date ranges + occupancy rules + promo codes; wire offers to booking.

### BZ-H3 — No guest self-service cancel/modify (High)
- Cancel is admin-only (`admin-actions.ts:877-999`); lookup is read-only (`lookup/route.ts:15-22`).
- Fix: code+phone verified guest portal with policy-tier auto-calc. Without this, front desk drowns in messages.

### BZ-H4 — Policy tiers unenforced (High)
- Refund amount is free staff input (`admin-actions.ts:868-875,944-958`); 48h/24h doc can diverge from behavior.
- Fix: compute eligible refund from check-in proximity; log override with reason + approver.

### BZ-M1 — No deposit/partial/pay-at-property (Medium)
- Stepper charges full total (`BookingStepper.tsx:76,458-461`).
- Fix: deposit % + folio balance-due + pay-at-property flag.

### BZ-M2 — Email-only notifications (Medium)
- Resend confirmation only (`email/index.ts:27-80`); no cancellation/refund/reminder emails (search verified); expiry silent (`pending-expiry.ts:33`). No SMS/WhatsApp.
- Fix: SSL Wireless/BulkSMS + WhatsApp Cloud templates for confirm/cancel/remind/expire.

### BZ-M3 — Channel manager is a MOCK (Medium, overbooking risk)
- `gyoroom-adapter.ts:20-38` simulated responses. No OTA sync → properties on Booking.com/Agoda will overbook.
- Fix: real CM (STAAH/SiteMinder) or minimum iCal export; disclose limitation in every sale until live.

### BZ-M4 — No multi-room/group booking; no child/extra-bed at booking (Medium)
- Single `roomId` prop; folio supports `EXTRA_BED` but booking does not offer occupancy options.
- Fix: cart + occupancy/extra-bed selector.

### BZ-M5 — Special-requests promised but absent (Medium)
- `../project-description.md:35` promises field; stepper has none.
- Fix: add textarea → booking notes → folio/handoff.

### BZ-L1 — No post-stay review solicitation (Low)
- Display cache only. Fix: post-checkout email/WhatsApp nudge (after consent + tax fixes).

## Legal gaps (fix before collecting real PII/money)

### LG-C1 — No terms/privacy acceptance at booking (Critical, blocker)
- Step 2 has zero checkboxes/links (`BookingStepper.tsx:324-443` fully inspected) → cancellation terms unenforceable in disputes.
- Fix: mandatory checkbox + links + store accepted version/timestamp on booking. Backfill policy versioning for legal docs.

### LG-H1 — Privacy policy thin template (High)
- `privacy.md` 22 lines lacks: retention periods, deletion-request process (internal v1 exists in `DATA-RETENTION.md:33-44` but not guest-facing), processor list (Resend/gateways/GA/Meta/Sentry), controller identity, consent withdrawal.
- Fix: rewrite with BD context; publish deletion-request path; list processors.

### LG-H2 — Cookie consent accept-only while trackers load unconditionally (High)
- `CookieConsent.tsx:50-53` accept-only, X hides without recording. `AnalyticsScripts.tsx:61-111` GA4+Meta Pixel load unconditionally, no consent gate.
- Fix: accept/reject + category toggles + gate scripts; record choice; respect DNT where claimed.

### LG-M1 — Terms thin template (Medium)
- `terms.md` 17 lines lacks: damage/liability, child/pet/smoking policy, force majeure, governing law (Bangladesh), dispute resolution. `refund-policy.md` 14 lines similarly thin.
- Fix: expand with counsel; version; link from booking + footer (footer already links — good).

### LG-M2 — NID/passport with no stated basis/retention (Medium)
- Collected in stepper (`L390-400`) with no basis/retention; admin masking unconfirmed.
- Fix: justify, state retention, mask in admin/exports for non-privileged roles (see [02](02-ADMIN-DEEP-DIVE.md)).

### LG-L1 — A11y + invoice format (Low)
- No skip link (`layout.tsx:93-113`), `lang` hardcoded `en` (`:86`), no WCAG audit (see [04](04-UI-UX-USABILITY.md)). No SAQ-A acknowledgement per deployment; confirmation lacks invoice lines.
- Fix: skip link, dynamic `lang`, stepper focus management; add SAQ-A to go-live pack; render tax invoice.

## Five deal-breakers to close first (sales order)

1. Guest self-cancel + enforced tiers. 2. SMS/WhatsApp notifications. 3. Deposits. 4. Seasonal rates. 5. VAT invoices.

## Unresolved

- Whether admin UI masks guest NID/passport (sensitive PII display) — not inspected.
- Stripe payment docs/PCI notes — only code+schema inspected, no `PAYMENTS-STRIPE.md` checked.
- WCAG audit existence — no audit file found via inspected paths; not exhaustively searched.
- BanglaQR dynamic-mode guest verification SLA timing — noted `escalatedAt` field only.

# 02 — /admin Deep Dive

Question: is `/admin` safe and usable for hotel/resort staff on day one?
Answer: **Guarded well, but not staff-ready.** Auth layering is good. One High privilege bug, several Medium workflow breaks, and Low ops gaps block smooth front-desk use.

## Auth architecture (verified good)

- `middleware.ts:24-39` session validation + `requirePermission` matrix guard (`auth-helpers.ts:112-118`) + 10-role matrix (`permissions.ts:81-222`).
- Every admin page checked calls a guard. Only `login`, `accept-invite`, `reset-password` are public by design.
- `ModuleGate.tsx:19-24` fail-closed before queries.
- Token hashing/TTL/single-use (`tokens.ts:39-71`).
- Cash-shift ownership check `not_yours` + manager note (`cash-shift-actions.ts:99-105`) + own-shift review block (`:157`).
- Night-audit approve + MFA + audit (`night-audit-actions.ts:23-24,45`).
- Export CSV-injection neutralization + audit (`finance/export/route.ts:22-27,91`; `hr/export/route.ts:83`).
- `window.confirm` on night-audit close/no-show, cash close, month close, deletes.
- UUID ids (`prisma` `uuid()`).

## High

### A-H1 — Read-only AUDITOR can mutate Concierge handoffs, zero audit rows

**Status 2026-11-01: FIXED.** Mutations now require `FRONT_DESK` `edit` and write `HANDOFF_ASSIGNED` / `HANDOFF_STATUS_CHANGED` / `HANDOFF_NOTE_ADDED` audit rows via `logAudit` (never throws, so audits can't break the mutation).
- Evidence: `assignHandoffAction` (`handoffs.ts:49`), `setHandoffStatusAction` (`:69`), `addHandoffNoteAction` (`:87`) require only FRONT_DESK **view**. AUDITOR holds FRONT_DESK view+export (`permissions.ts:204`). Result: read-only role mutates live ops state with no local audit trail.
- Fix: require FRONT_DESK `edit`/`manage` (or dedicated HANDOFF action) for all three mutations; add audit rows; add test asserting AUDITOR 403 on each.

## Medium

### A-M1 — Open redirect on login
- `login/page.tsx:29` `redirectUrl` from query, `router.push` at `:46` and `:81`, no same-origin check. Attacker link `/admin/login?redirect=https://evil` phishes post-credential.
- Fix: same-origin single-`/` allowlist. See [01](01-SECURITY-RELIABILITY.md) M2.

### A-M2 — Rooms dead-end for view-only roles
- `rooms/[id]/page.tsx:23` requires ROOMS edit, but nav + list need only ROOMS view (`permissions.ts:293`, `rooms/page.tsx:14`). `RoomsView.tsx:139` links every row to `[id]` → HOUSEKEEPING/AUDITOR get 403 on click.
- Fix: allow view on `[id]` with read-only mode, or hide links for view-only roles.

### A-M3 — Payments verification locked to legacy MANAGER
- `banglaqr-verification/page.tsx:14` and `stripe-disputes` use `requireRole(MANAGER)`; `passesLegacyRole` refuses all new roles (`permissions.ts:243-246`). ACCOUNTANT cannot verify payments. No payments entry in `NAV_RULES` (`:280-298`), reachable only via FinanceHome links.
- Fix: migrate to `requirePermission` with FINANCE/PAYMENTS actions; add nav entry; backfill ACCOUNTANT grants.

### A-M4 — Case-sensitive search
- `bookings/page.tsx:59-64` and `guests/page.tsx:24-28` lack `mode:insensitive` that `blog/page.tsx:49-52` has. Staff searching names get misses.
- Fix: add `mode:insensitive` to all staff search filters.

### A-M5 — Unvalidated params to Prisma → 500s
- `bookings/page.tsx:39-56` status/roomId/dates + `:128` `page` `parseInt` unclamped; `guests/page.tsx:86` same. Invalid input throws 500 instead of 400/empty.
- Fix: zod/whitelist status, validate UUIDs/dates, clamp `page`/`pageSize`, return 400 on bad input.

## Low — pagination, history caps, PII masking, ops polish

### Pagination / history
- Journals latest-100 only (`journals/page.tsx:22`). Purchasing finished `take 30` (`purchasing/page.tsx:19`). Inventory unbounded no search (`inventory/page.tsx:17`). Staff `take 2000` no search (`hr/staff/page.tsx:16`). Finance export silent 100k truncation (`finance/export/route.ts:20,83`).
- Fix: paginate + search everywhere; surface truncation warning in export filename/banner.

### PII masking (confirm intent vs bug)
- `hr/export/route.ts:75` payroll CSV exports full `l.payAccount` vs `:39` staff CSV `maskTail`. NID shown to all FRONT_DESK/BOOKING viewers (`GuestsView.tsx:189-191,300-303`; `guests/page.tsx:59`; `BookingDetailView.tsx:517-520`). Salaries visible to MANAGER/AUDITOR (`staff/page.tsx:16`, RunView salary lines).
- Fix: decide masking policy; at minimum mask NID/bank for non-privileged roles, mask salaries from AUDITOR unless required, unify CSV masking.

### Ops readiness nits
- No forgot-password link on login (`login/page.tsx` full body read).
- `rememberMe` defaults true (`:23`) on shared desk PCs — default false.
- `/admin/payments` index 404s (no `page.tsx`, only subpages) — add index or redirect.
- `AdminShell` badges never populated (`layout.tsx:22`).
- Blog preview button hidden from view-only roles though page allows BLOG view (`BlogListView.tsx:121-127` vs `preview/page.tsx:21`).
- PMS/Tax tabs are labeled placeholders (`PlaceholderTabs.tsx`) — label clearly or hide until live.

## Suggested /admin launch gate

1. Fix A-H1 + add 403 regression tests for AUDITOR on all mutations.
2. Fix A-M1 through A-M5.
3. Decide PII masking matrix; implement; audit exports.
4. Add forgot-password, `rememberMe=false`, payments index, badge counts or remove badges.
5. Run a front-desk walkthrough: check-in, handoff, night audit, refund, export — all as FRONT_DESK, MANAGER, ACCOUNTANT, AUDITOR — and record 403/500s.
6. Add audit rows for every mutation currently missing them (start with handoffs).

## Unresolved

- Detail bodies lightly covered (grep-level only, not line-cited): `finance manual/[id]`, petty-cash, payables bills/payments detail, suppliers, room-service menu/new, daily-sheet write path, folio-actions bodies, expense approve/receive flows, purchasing receive flow, `DisputesView`/`VerificationView` internals, `Setup2faView`, `SystemView` content, `HandoffBoard` client gating.
- Whether payroll-CSV full bank accounts and MANAGER-visible salaries are intended business decisions (flagged confirm-intent, not bugs).
- Runtime behavior unverified (read-only review): no login/redirect exploit executed, no Prisma error reproduction for bad params.

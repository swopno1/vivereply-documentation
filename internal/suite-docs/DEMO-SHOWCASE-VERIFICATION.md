# Demo showcase verification (model-written, historical)

Every claim below was checked against the code on 2026-11-01. File paths are
evidence; behaviours marked NOT IMPLEMENTED have no source and are listed as
roadmap, not capability.

## 1. Payments index (`/admin/payments`)

- Source: `src/app/admin/payments/page.tsx` + `PaymentsIndexView.tsx`.
- 5 hub cards: BanglaQR verification queue, bKash, Nagad, SSLCommerz, Stripe
  disputes. Each card links to its real route (`/admin/payments/<hub>`).
- Badge counts are live: the page queries pending counts per hub and renders
  them on the cards. An empty queue renders `0`, never a placeholder number.
- Empty states: each hub view renders an explicit zero-queue message when its
  list is empty (verified on BanglaQR verification + Stripe disputes views).

## 2. PII masking matrix (§9)

Implemented 2026-11-01. Primitives in `src/lib/privacy/mask.ts`:

- `MASKED = "•••"` for fully hidden values.
- `maskTail(value, 4)` shows the last 4 characters, `"•••"` for empty input.
- Pins: `src/app/admin/pii-masking.test.ts` (8/8 green),
  `src/lib/privacy/mask.test.ts` (7/7 green).

Matrix (enforced in code, not convention):

| Field | Full value visible to | Others see |
|---|---|---|
| Guest NID (booking detail) | `FRONT_DESK.edit` holders: OWNER, MANAGER, FRONT_DESK, STAFF | `maskTail(nid)` |
| Staff NID / bank account | `HR.edit` holders: OWNER, MANAGER, HR | `maskTail(...)` |
| Salary figures | `HR.edit` holders | `•••` |
| HR CSV export | same rule applied per row before serialising | same |
| Staff edit forms | full values, route already requires `HR.edit` | n/a (403 otherwise) |
| Phone / email in /admin | all staff roles (needed for desk work) | unmasked by design |

Role evidence: `src/lib/permissions.ts` — `FRONT_DESK_GRANTS` (line 59) shared
by FRONT_DESK (line 116) and STAFF (line 221); MANAGER edit at line 101; OWNER
`ALL` at line 84; AUDITOR view+export only (lines 202–212); HR.edit at line 195.

## 3. Rooms view-only path

- `/admin/rooms` (`RoomsView.tsx`) renders action buttons only when the
  session's `can()` props allow them; roles without edit see no links.
- `/admin/rooms/[id]` has no read-only mode by design: the page requires edit
  and non-editors get 403 rather than a broken half-page.
- Pinned by `src/app/admin/rooms/rooms-view-guards.test.ts`.

## 4. Search + list params

- Admin list search uses case-insensitive `contains` (`mode: "insensitive"`)
  on bookings and guests.
- `parsePageParam` / `parseDateFilter` (`src/lib/admin/list-params.ts`) fall
  back to safe defaults instead of throwing Prisma 500s on bad input.
- Pinned by `src/lib/admin/list-params.test.ts` +
  `src/app/admin/admin-search-params.test.ts` (9/9 green).

## 5. Login security + forgot-password UX

- `safeRedirectPath` (`src/lib/security/redirect.ts`): only single-leading-slash
  same-origin paths; everything else falls back to `/admin`. Pinned 10/10 with
  `src/lib/security/redirect.test.ts`.
- `rememberMe` defaults to off (shared desk PCs).
- Forgot password (`/admin/forgot-password` → `POST /api/account/forgot-password`):
  always returns `{ ok: true }`; the page shows the generic
  "Check your inbox — if an account uses that email, a reset link is on its
  way." whether or not the address exists (en + bn parity in
  `src/content/en.ts:252-257`, `src/content/bn.ts:254-257`).
- Rate limits: 5/hour per IP key in the route plus better-auth's 5/hour on
  `/request-password-reset` (`src/lib/auth.ts:83`).

## 6. Payments nav + i18n

- Nav key `payments` with Wallet icon in `AdminShell.tsx:59,93`; label from
  `t.adminShell.payments` → en "Payments" (`en.ts:225`), bn "পেমেন্ট"
  (`bn.ts:226`).

## 7. Booking stepper (guest path)

`src/components/travel/BookingStepper.tsx` — 3 steps, visible + sr-only labels
agree: 01 Dates & Stay, 02 Guest Details, 03 Payment. Terms checkbox is
mandatory (demo shows the exact prod flow).

## 8. Admin numeric inputs + amount caps

`src/components/admin/RoomForm.tsx` (real min/max, not a shared MoneyInput —
no such component exists):

- Price/night (taka): `min={1}`
- Max guests: `min={1} max={10}`
- Room size sqft: `min={50}`
- Initial units: `min={0} max={200} step={1}`

Server-side caps: `MAX_FOLIO_LINE_POISHA` = ৳10,00,000
(`src/lib/folio/constants.ts`); `MAX_EXPENSE_POISHA` = ৳1 crore
(`src/lib/expenses/constants.ts`).

## 9. Inventory ADJUST sign rule

No enum named `AdjustmentType` exists; the real type is `StockMovementKind`
(`prisma/schema.prisma:1150`): RECEIVE / ISSUE / WASTE / ADJUST.

- RECEIVE writes `+qty`; ISSUE/WASTE write `−qty`
  (`src/app/actions/inventory-actions.ts:177`).
- ADJUST carries the signed physical-count variance as-is
  (`qtyDeltaMilli: l.varianceMilli`, line 297), only for nonzero variances,
  with an `own_count` separation-of-duties rule (a non-OWNER cannot approve
  their own count).

## 10. Stripe minor-units conversion

`minorUnitsToPoisha` is used in `src/lib/payments/stripe/adapter.ts`,
`webhook.ts`, and `config.ts` (Stripe minor units → poisha at the boundary).

## 11. NOT IMPLEMENTED (roadmap, no source)

Checked repo-wide 2026-11-01 (code + docs, excluding build dirs):

- **Pensions / meal plans / board basis**: the word "pension" appears only in
  `src/lib/payments/sslcommerz/__tests__/vectors/sandbox-callbacks.json`
  (a sandbox fixture string). No module, route, or schema model exists.
- **FREE_MEAL / comp meals / house accounts**: zero matches. No complimentary-
  meal flow exists.
- Do not demo these as working features.

## 12. Follow-up edits suggested (none blocking)

1. Forgot-password email should state the reset-link TTL in the template body
   (token expiry is currently only enforced server-side by the auth pipeline).
2. Consider a shared numeric-input component if more money fields are added;
   today each form sets its own min/max (see §8).

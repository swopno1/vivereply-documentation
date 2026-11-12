# 10. Concierge ↔ Suite (client/demo1) alignment inspection

Date: 2026-11-02. Read-only inspection, no code changed.
Scope: can `vivereply-concierge` and travel-scaffold `client/demo1`
integrate properly — both directions, contract vs implementation.

Repos: `travel-scaffold` (Suite, this repo) and sibling
`vivereply-concierge` (Concierge). Contracts: Concierge
`docs/suite-api-spec.md` (v1, Concierge→Suite) and
`docs/bridge-integration.md` (Suite→Concierge staff bridge).

## Verdict

Staff direction (Suite → Concierge handoff board) is **aligned and
shippable** pending ops config. Guest direction (Concierge → Suite
booking) is **broken today**: every Concierge draft gets HTTP 400
because the Suite requires terms acceptance the Concierge never sends
(CA-1). Two medium issues ride with it (idempotency header/body
mismatch, shared-IP rate limits).

## Direction 1 — Concierge → Suite (guest booking flow)

| # | Severity | Finding | Evidence |
|---|---|---|---|
| CA-1 | Blocker | Suite POST /api/bookings requires `termsAccepted` + `termsVersion`, Concierge sends neither → 400 on every draft | Suite `src/app/api/bookings/route.ts:47-48` (both required); Concierge `lib/suite.ts:137-144` body has no terms; no "terms" anywhere in Concierge `lib/tools.ts`/`lib/suite.ts`; spec `suite-api-spec.md:39-44` also omits terms (stale) |
| CA-2 | Medium | Idempotency-Key sent as HTTP header, Suite reads it from JSON body → retries create duplicate holds | Concierge `lib/suite.ts:136` header vs Suite `route.ts:46,74` body field; Suite auto-generates a key per request when absent |
| CA-3 | Medium | Suite rate limits are per-IP (30 bookings/hr, 60 lookups/hr, 10 send-details/hr); all Concierge traffic shares one server IP → legit guests can eat 429s at load | Suite `route.ts:123`, `lookup/route.ts:38`, `send-details/route.ts:145`; Concierge handles 429 gracefully (`suite.ts:63`) but the guest still waits |
| CA-4 | Minor | Concierge cannot set guestCount/promoCode (adapter has no params); Suite defaults to 1 guest | Concierge `lib/suite.ts:103-109` vs Suite `route.ts:45,172` |
| CA-5 | Note | Auth asymmetry by design: Concierge→Suite is unauthenticated public endpoints; `SuiteBinding.secret` is never set by `defaultBinding` and the Suite ignores Authorization | Concierge `lib/suite.ts:35-37,51`; no shared secret exists to exempt Concierge traffic from CA-3 |

Verified working (no action): availability shape
(`/api/rooms/{id}/availability?checkIn&checkOut` → `{available, units?}`);
lookup dual date-shape handled (`checkInDate/Date` comment verified
2026-10-28, still true); send-details `{sent:true}` identical Ish
whether-or-not (no oracle); ping `{ok:true, suiteVersion:1}`;
404/409/429 mappings; unknown JSON keys stripped not rejected.

## Direction 2 — Suite → Concierge (staff handoff board)

| # | Severity | Finding | Evidence |
|---|---|---|---|
| — | OK | All four bridge calls match implemented endpoints and shapes | Suite `src/lib/chatbot/bridge.ts:75-103` vs Concierge `app/api/bridge/handoffs/route.ts:14`, `[id]/route.ts:47,60`, `[id]/notes/route.ts:11`; Bearer auth, property scoping, status literals all match `bridge-integration.md` |
| CA-6 | Ops | Needs live config on both sides before the board lights up | Suite: `CONCIERGE_URL` + `CONCIERGE_BRIDGE_KEY` (env wins, else Settings → Chatbot encrypted); Concierge: mint `cb.*` token in /settings per property; revoke is instant |

## Shared config and docs

| # | Severity | Finding | Evidence |
|---|---|---|---|
| CA-7 | Medium | Room mapping is manual per property with no health check: Concierge `RoomMapping.suiteRoomId` must equal Suite `Room.id` (UUID); Suite deletes/renames break quotes silently into "answered unexpectedly" | Concierge `prisma/schema.prisma:218`, `app/api/admin/room-mappings/seed/route.ts`; Suite has no mapping-aware endpoint |
| CA-8 | Minor | Suite cites `docs/suite-api-spec.md` (ping route docblock) but holds no copy — spec lives only in the Concierge repo; drift (CA-1) already happened once | Suite `src/app/api/concierge/ping/route.ts:3`; no such file under travel-scaffold/docs |

## Fix plan (proposal — needs owner decisions, then build)

1. **CA-1**: Decide how a chat agent accepts terms (explicit in-chat
   confirmation + log the transcript ref suggested), then Concierge sends
   `termsAccepted:true, termsVersion:"v1"` (`CURRENT_TERMS_VERSION`,
   Suite `src/lib/legal/version.ts:8`). Update the spec. Legal call —
   do not code around it.
2. **CA-2**: Concierge also puts the key in the JSON body (one-line,
   keeps header for spec compliance), or Suite additionally reads the
   header. Either side; body is the smaller diff.
3. **CA-3**: Decide: shared-secret header for Concierge traffic with a
   rate-limit bypass (both sides change), or accept 429s at load (no
   change, documented). Suggested: secret + bypass before pilot.
4. **CA-4**: Add optional guestCount/promoCode to the adapter when the
> **CA-4 design note (2026-11-02):** Concierge `createBooking` accepts an optional
> `extras?: { guestCount?: number; promoCode?: string }` param and forwards it
> through the adapter interface; guestCount is clamped to [1, room.maxGuests]
> client-side (the same capacity clamp the Suite stepper uses), and promoCode
> is passed through untouched for Suite-side rate-plan evaluation. Suite
> `POST /api/bookings` gains matching optional zod fields. Not implemented
> yet — wire after rate plans (BZ-H2) land on the Suite side.

   chat collects them; until then document "chat bookings default to
   1 guest".
5. **CA-6**: Run the bridge config checklist at deploy (mint token,
> **CA-6 ops checklist (2026-11-02)** — run at every deploy/pilot:
>
> 1. Suite env: `CONCIERGE_URL` + `CONCIERGE_BRIDGE_KEY` set (env wins over
>    Settings → Chatbot encrypted columns).
> 2. Concierge /settings: mint a `cb.*` token per property; store it in the
>    Suite side. Revocation is instant — no restart needed.
> 3. Verify: `GET /api/concierge/ping` returns 200 with a valid token, 401
>    with a wrong one.
> 4. Run "Verify mappings" in Concierge /settings → catalogue; zero Broken
>    badges before go-live (CA-7 probe).

   set Suite secrets, test list→assign→note→close).
6. **CA-7**: Add a mapping health probe (Concierge setup page pings
   availability per mapped room; red on 404) or document the manual
   re-seed step per Suite room change.
7. **CA-8**: Vendor the spec into travel-scaffold/docs (copy + version
> **CA-8 DONE (2026-11-02):** spec vendored at
> `travel-scaffold/docs/suite-api-spec-VENDORED.md` with a source-of-truth
> stamp. Re-vendor whenever the Concierge contract changes.

   stamp) or link it; add a checklist line "spec updated" to any
   Suite booking-endpoint change.

## Payment deep link (bot → Suite contract, DONE 2026-11-04)

`GET /booking/pay?booking=CODE` is the URL the Concierge bot sends guests
who ask to pay. The code pre-fills the form; the guest verifies with the
phone on the booking (same code+phone model as `/booking/manage` — codes
are enumerable, so the code alone unlocks nothing), then pays through the
stepper's gateway selector. Simulate and real modes both work because the
page reuses `PaymentMethodSelector` and the existing provider
token/create/callback routes — completions confirm the booking through the
unchanged production path. Verify endpoint: `POST /api/bookings/pay-lookup`
(code+phone → pay context, 404 on either wrong, IP+code rate limits).
The confirmation page links here when the booking is PENDING.

Suggested bot text: "Pay securely here: {suite}/booking/pay?booking={code}
— enter the phone number on your booking to continue."

## Validation for the build turn

- Concierge draft E2E against local Suite: availability → create →
  lookup → send-details → ping, asserting 200s and the idempotency
  replay returns the ORIGINAL booking code on retry.
- Bridge E2E: Suite chatbot-admin lists/assigns/notes/closes a real
  Concierge handoff with a minted key; revoke → 401 on next call.
- Negative: draft without terms still 400s (Suite guard intact);
  unknown room 404s; sold-out 409s with guest-safe wording.

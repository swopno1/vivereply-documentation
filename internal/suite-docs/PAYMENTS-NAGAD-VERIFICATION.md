# Nagad Hardening — Verification Report

| | |
|---|---|
| **Date** | 2026-09-30 |
| **Branch** | `hardening/nagad` — merged to `main` (confirmed via `docs/release/00-MAIN-VERIFICATION.md`, 2026-10-09) |
| **Commits** | `c0518d9` (Section 0 review) … this report; list in §7 |
| **Environments** | Automated tests: `resort_banglaqr_test` (a `*_test` Postgres DB) with an in-memory Nagad doing real RSA with committed TEST-ONLY keys. Manual walkthrough: production build (`next start`) against the same test DB, with `NAGAD_BASE_URL` pointed at a non-allow-listed host so that **no request could reach Nagad** (explained in §3) |
| **Related** | [PAYMENTS-NAGAD.md](PAYMENTS-NAGAD.md) · [security review](PAYMENTS-NAGAD-SECURITY-REVIEW.md) |

## Summary

| Check | Result |
|---|---|
| Nagad automated tests (DB-backed) | **255 / 255 passed** in 15 files (bKash has 157, BanglaQR 96) |
| bKash automated tests (regression; shares tables, admin actions and the refund route) | **157 / 157 passed** |
| BanglaQR automated tests (regression) | **96 / 96 passed** |
| Unit test run (`pnpm test`, no test DB) | **322 passed, 283 skipped** (the DB-backed tests are marked skipped) |
| `pnpm lint` (ESLint + admin guard checks + money check) | **Passed**, 0 warnings, 0 errors |
| `pnpm build` | **Passed.** One warning, which predates this work and is not Nagad code: the `middleware` file convention is deprecated |
| Manual walkthrough (§16.2) | 4 steps run live, fully or partly (2, 3, 5, 6); 2 run live against a Nagad that fails closed (7, and the fail-closed half of 8); 4 covered by automated tests only (1, 4, 9 in part, 10). **No step was run against Nagad itself**: no sandbox credentials (D10) |
| Security greps (§16.3) | Every match justified (§5) |

**What this does and doesn't prove.** Every security-relevant path is exercised through the real route handlers and Server Actions against a real Postgres. The Nagad on the other end is a fake that does real RSA the way Nagad's guide and the public SDKs describe. **Nothing has been exchanged with Nagad's servers.** Four things depend on Nagad behaving as documented:

- the initialize signature covering the decrypted payload (review H1);
- the `X-KM-IP-V4` rule (M1);
- the `merchantCallbackURL` field name (M2);
- the `purchase/cancel` refund shape (D7).

The first real sandbox payment is the test that settles them (§6).

**The most important findings.**

1. **The pre-hardening callback recorded every real successful payment as FAILED.** Nagad's success code is `00_0000_000`, and the old callback treated anything but `000` as failure, before calling verify. The same bug class as bKash's 403: the integration could not have completed a payment. The test `confirms a real success (status_code 00_0000_000, the code the old handler misread as failure) only after verify` covers it.
2. **The implementation itself surfaced one design bug, now fixed.** The Section 3 index "one live payment per booking" made a second captured payment unrecordable (a 500 instead of REVIEW_REQUIRED). It also blocked verifying a replaced window while a newer one was open. It was split into two indexes in Section 5 (migration `20260930120200`).

---

## 1. What changed, by review finding

| Finding | Status | Where |
|---|---|---|
| C1 success callback recorded as FAILED | ✅ Fixed | `callback.ts` never writes state; verify-only fulfilment |
| C2 generic webhook router open to Nagad bodies | ✅ Fixed | adapter refuses; `/api/webhooks/payment/nagad` removed; `admin-guards.test.ts` |
| C3 no state machine | ✅ Fixed | guarded `updateMany` claims and transitions (`settlement.ts`, `verify-payment.ts`) |
| C4 cancelled/paid-elsewhere bookings payable | ✅ Fixed | `payability.ts`; REVIEW_REQUIRED after capture (D6) |
| C5 no reconciliation | ✅ Fixed | `reconcile.ts`, `/api/cron/nagad-reconcile`, heartbeat alert |
| H1 signature over the wrong bytes | ✅ Fixed, ⚠️ unconfirmed against Nagad | `crypto.ts` `openNagadSealedPayload` |
| H2–H4 unvalidated decrypted data, 200-errors, loose verify | ✅ Fixed | `schemas.ts`, `client.ts`, `verify-payment.ts` |
| H5 raw booking UUID as credential | ✅ Fixed | booking tokens |
| H6 no DB idempotency | ✅ Fixed | partial unique indexes, claims |
| H7 refunds | ✅ Fixed, ⚠️ request shape unconfirmed | `refund.ts`, `NagadRefund` ledger, owner resolution |
| H8 error leaks | ✅ Fixed | `http.ts`, `NagadError` |
| H9 inverted test connection | ✅ Fixed | `connection-check.ts` |
| H10 key/env validation, sandbox default | ✅ Fixed | `keys.ts`, `config.ts` |
| H11 unredacted logs, mutable audit | ✅ Fixed | `PaymentAuditLog` only; masked summaries; PEM redaction |
| H12 rate limits | ✅ Fixed | `rate-limiter.ts` |
| M1 `X-KM-IP-V4` | ✅ Fixed, ⚠️ unconfirmed | `client.ts` |
| M2 `merchantCallbackURL` | ✅ Fixed, ⚠️ unconfirmed | `api.ts` |
| M3–M11 | ✅ Fixed | callback GET-only and strict; result page; base URL allow-list; per-attempt order IDs; amount snapshot; attempt window; admin guards; notifications; heartbeat |
| L1–L6 | ✅ Fixed | nagadLog; barrels removed; KeyObject cache; 160-bit challenge; `hourCycle: "h23"`; docs rewritten |

---

## 2. Automated tests (§16.1)

```
$ DATABASE_URL_TEST=postgresql://…/resort_banglaqr_test pnpm test:nagad:db
Datasource "db": PostgreSQL database "resort_banglaqr_test", schema "public" at "localhost:5432"
16 migrations found in prisma/migrations
No pending migrations to apply.
 RUN  v4.1.11 /Users/mdamirhossain/ViveScript-Solutions/projects/TravelWebTemplate
 Test Files  15 passed (15)
      Tests  255 passed (255)
   Duration  26.78s (transform 578ms, setup 0ms, import 2.61s, tests 22.65s, environment 1ms)

$ DATABASE_URL_TEST=… pnpm test:bkash:db
 Test Files  15 passed (15)
      Tests  157 passed (157)

$ DATABASE_URL_TEST=… pnpm test:banglaqr:db
 Test Files  11 passed (11)
      Tests  96 passed (96)

$ pnpm test
 Test Files  23 passed | 26 skipped (49)
      Tests  322 passed | 283 skipped (605)
```

The Nagad suite was also run twice back-to-back against the same database: 247/247 both times, before the last 8 tests were added. So reruns against persisted rate-limit counters and ledger rows stay green.

| File | Tests | Covers (brief section) |
|---|---|---|
| `crypto.test.ts` | 44 | §1 key loading, `\n` normalisation, PEM formats, size/type/swap/expiry refusals, no fallback key, env read in one file, PKCS#1 + RSA-SHA256 round trip, signature over plaintext (and rejection over ciphertext), wrong key, tampered body, malformed inputs, one generic error, `timingSafeEqual`, no `Math.random`, PEM log redaction, config fail-closed |
| `validation.test.ts` | 51 | §2 every input and response schema, including the real SDK callback and verify samples |
| `auth.test.ts` | 16 | §3 token issuance, raw bookingId refused, booking states, paid elsewhere, amount, both phases server-side with nothing sensitive in the response, `X-KM-IP-V4`, callback never fulfils from `status`, OWNER-only refunds, MANAGER status checks, OWNER-only test connection returning 3 keys, misconfigured keys never reported as success |
| `redirect.test.ts` | 14 | §4 strict parameters, GET only, replay and 8-way concurrency, cancelled stays cancelled, audit fields, 60/min limit, Host-header spoofing, Nagad timeout → check-again, paid superseded window |
| `concurrency.test.ts` | 16 | §5 concurrent initializes, DB uniqueness, D5 hold/abort/supersede/paid-old-window, one complete per reference, verify races, stale claims, VERIFY_PENDING blocks, refund races, additional flag, booking guards, replay after refund |
| `amounts.test.ts` | 15 | §6 owner cap, amount mismatch → review + NAGAD_AMOUNT_MISMATCH, total edited mid-payment, taka formats, refund ceiling, order/merchant/reference/trxID checks, `Success`+`000` rule, order ID format and uniqueness, phone never sent or stored, masking |
| `reconcile.test.ts` | 10 | §7 cron auth (header only), closed-browser confirmation, young attempts left alone, 2 h ABANDONED with booking PENDING, CANCELLED/FAILED, stale VERIFYING → VERIFY_PENDING → settled, superseded windows, stuck INITIALIZING, counts-only response, heartbeat alert once per 6 h |
| `audit.test.ts` | 8 | §8 every lifecycle event with §8.1 fields, signature failures per IP, verify/amount/refund failure events, closed event list, no secrets in any row, masked summary, no PaymentLog writes, append-only triggers |
| `rate-limiter.test.ts` | 7 | §9 every limit in the table, signature-failure pause, key prefix |
| `errors.test.ts` | 15 | §10 six brief messages verbatim in EN/BN, every code translated, no internals, fail closed without either key, no leaks, correlation IDs |
| `resilience.test.ts` | 18 | §11 Nagad down, no retry on initialize/complete, verify retry rules, VERIFY_PENDING parking, 30 s bounded timeout, lost refund → UNKNOWN, key rotation pickup, certificate expiry warning, Dhaka midnight/new year/TZ, real initialize at Dhaka midnight |
| `notifications.test.ts` | 10 | §12 guest confirmed/failed/expired, admin refund/unknown refund/reconciled/review/signature (1 per hour), email outage never breaks a payment |
| `refund.test.ts` | 18 | §13 gap fill: refund request shape, refusals, unverifiable refund answer, shared route refuses Nagad, D7 resolution, complete-phase failure paths |
| `admin-guards.test.ts` | 6 | §13 gap fill: C2 generic router, M9 admin action guards |
| `settings.test.ts` | 7 | D8 owner settings |

Brief §13.2 list → where it is tested:

| Required | Tests |
|---|---|
| Crypto: loading, PEM normalisation, round trip, verify accept/reject, timing-safe, no fallback | `crypto.test.ts` |
| Initialize: raw bookingId, expired booking, amount mismatch, duplicate, rate limits | `auth.test.ts`, `concurrency.test.ts`, `rate-limiter.test.ts` |
| Complete: unknown reference, wrong challenge, idempotent | `refund.test.ts` (phase 2 paths), `concurrency.test.ts` (§5.2), `crypto.test.ts` (challenge hash) |
| Callback: unknown ref, no fulfilment from failure status, replay and concurrency, rate limits | `auth.test.ts`, `redirect.test.ts` |
| Verify: amount/order mismatch, invalid signature, timeout | `amounts.test.ts`, `crypto.test.ts`, `errors.test.ts`, `resilience.test.ts` |
| Refund: OWNER-only, reason ≥ 10, over-refund, idempotent, audit | `auth.test.ts`, `amounts.test.ts`, `concurrency.test.ts`, `audit.test.ts`, `refund.test.ts` |
| Reconciliation: abandoned and paid | `reconcile.test.ts` |
| Audit: every event, no secrets | `audit.test.ts` |
| Errors in both languages | `errors.test.ts` |

---

## 3. Manual walkthrough (§16.2)

**Setup.** Production build started with `next start -p 3100`:

- `DATABASE_URL` pointed at `resort_banglaqr_test`.
- The walkthrough admin users (OWNER with TOTP 2FA, MANAGER, STAFF) came from the bKash run.
- Nagad was configured with the TEST-ONLY keys.
- `NAGAD_BASE_URL=https://blocked.invalid/api/dfs`, deliberately outside the allow-list, so that Nagad is "not configured" and **no request can leave the machine**.

The alternative, pointing at Nagad's real hosts with a made-up merchant ID, would have sent signed requests to a third party we have no agreement with. The server log confirms no request went out (step 8).

A seed script created two rows:

- a CONFIRMED booking `TST-780A050BF96E` with a hardened Nagad SUCCESS payment;
- a Nagad attempt stuck in INITIALIZING for 10 minutes.

| # | Step | Result |
|---|---|---|
| 1 | Complete a Nagad sandbox payment end to end | **NOT RUN.** No sandbox credentials (D10). The full flow runs in `auth.test.ts` against the fake Nagad with real RSA on both sides |
| 2 | Callback with a fabricated `payment_ref_id` → 400 | **PASS (live).** 400, `no-store`, correlation ID; audited `CALLBACK_REJECTED` / `UNKNOWN_PAYMENT_REF` |
| 3 | Same valid callback twice → idempotent | **PASS (live)**, on a payment already SUCCESS: both 302 to confirmation, **no verify call**; a tampered `order_id` → 400; `POST` → 405. The first-time verify + replay path is `redirect.test.ts` (5 replays, 1 verify; 8 concurrent, 1 confirmation) |
| 4 | Invalid signature on the verify path → rejected | **Automated only.** Nagad's verify response is unsigned (D1); the signed path is initialize and refund. `crypto.test.ts` (wrong key, signed over ciphertext, tampered body), `errors.test.ts`, `audit.test.ts` (502 SIGNATURE_INVALID, attempt closed, no phase 2, counted per IP) |
| 5 | STAFF attempts a refund → 403 | **PASS (live UI) + automated.** No refund or status control for STAFF (screenshot 05). The server-side 403 for the action is `auth.test.ts` (`refunds are OWNER-only…`), and `pnpm check:guards` confirms every exported action calls a guard |
| 6 | MANAGER attempts a refund → 403 | **PASS (live UI) + automated.** No refund control for MANAGER (screenshot 06). **Live:** MANAGER tried to cancel with "refund recorded: Nagad ৳4,500". The server refused ("This booking was paid by Nagad… an owner issues the refund with 'Refund via Nagad'…"); the booking stayed CONFIRMED and `ADMIN_STATUS_CHANGE_BLOCKED` (MANAGER, `cancelBookingWithRefundDecision`) was audited. The action 403 is `auth.test.ts` |
| 7 | OWNER partial refund → appears in Nagad and is logged | **Not run against Nagad.** Live against the fail-closed setup: OWNER (with 2FA) issued a ৳100 partial refund. It was recorded `REQUESTED` → `FAILED` (`unavailable:not_configured`), the guest-facing message was "Nagad is temporarily unavailable… Reference NG-…", and the payment stayed SUCCESS with nothing refunded (screenshot 07). The success path (Nagad receives an encrypted, signed `purchase/cancel`, the ledger completes, PARTIALLY_REFUNDED) is `refund.test.ts`, `concurrency.test.ts` and `amounts.test.ts` |
| 8 | Trigger the cron → abandoned payments handled | **PASS (live), partly.** No secret / query-string secret → 401; header → 200 with counts. The stuck INITIALIZING attempt was closed (FAILED, `INITIALIZE_INTERRUPTED`). The 50 checked leftover test rows were each left pending, **never guessed**, because Nagad was unreachable by design (`outcome: unavailable, reason: not_configured`, 0–5 ms, no outbound request). Abandonment after 2 h with Nagad answering is `reconcile.test.ts` |
| 9 | Network traffic: no RSA material, challenge or full phone | **PASS (live, admin page) + automated (guest flow).** The admin booking page's full HTML/RSC payload contains no payment reference, order ID, challenge hash, raw payload, `sensitiveData` or PEM text. The result page is 360 px-safe with `referrer: no-referrer` (screenshot 09a). The guest initialize response (`{ redirectUrl, reference }` only, no challenge/signature/PEM) is asserted in `auth.test.ts`; not observed live, since initialize can't succeed without Nagad |
| 10 | Asia/Dhaka date rollover (mocked clock) | **PASS (automated).** Six tests in `resilience.test.ts`, including a real initialize at 00:00:03 Dhaka sending `20260930000003` and the refund naming `20260930` |

### 3.1 Raw output (steps 2, 3, 8)

```
=== Step 2: callback with a fabricated payment_ref_id
$ curl -si 'http://localhost:3100/api/payments/nagad/callback?payment_ref_id=<fabricated>&status=Success&status_code=00_0000_000'
HTTP/1.1 400 Bad Request
cache-control: no-store, no-cache, must-revalidate
{"error":"This payment link isn't valid. If you were charged, please contact us with the reference below. Reference: NG-2026-09-30-b4749a.","code":"INVALID_CALLBACK","reference":"NG-2026-09-30-b4749a"}

=== Step 3: the same valid callback twice (payment already SUCCESS)
--- call 1
HTTP/1.1 302 Found
cache-control: no-store, no-cache, must-revalidate
location: https://localhost:3100/booking/confirmation/2235da1f-6aa7-4e07-9a14-9c1bb8483903
--- call 2
HTTP/1.1 302 Found
cache-control: no-store, no-cache, must-revalidate
location: https://localhost:3100/booking/confirmation/2235da1f-6aa7-4e07-9a14-9c1bb8483903
--- tampered order_id on the same reference
HTTP/1.1 400 Bad Request
{"error":"This payment link isn't valid. If you were charged, please contact us with the reference below. Reference: NG-2026-09-30-38ad03.","code":"INVALID_CALLBACK","reference":"NG-2026-09-30-38ad03"}

--- POST to the callback (GET only)
HTTP/1.1 405 Method Not Allowed
=== Step 8: reconciliation cron
--- no secret
HTTP/1.1 401 Unauthorized
{"error":"Unauthorized"}

--- secret in the query string
HTTP/1.1 401 Unauthorized
--- secret in the Authorization header
HTTP/1.1 200 OK
{"success":true,"checked":50,"settled":0,"confirmed":0,"abandoned":0,"stillPending":50,"closedInitializing":1,"reference":"NG-2026-09-30-3d2932"}
```

(The redirect origin is `https://localhost:3100` because `NAGAD_CALLBACK_URL` must be https in production and redirects use the configured origin, never the `Host` header.)

Audit rows and server log after the walkthrough:

```
audit rows for the seeded paid payment:
  CALLBACK_RECEIVED NG-2026-09-30-949b51 {"status":"Success","sourceIp":"::1","userAgent":"curl/8.7.1","paymentRef":"MjAy…MQ==","statusCode":"00_0000_000","paymentStatus":"SUCCESS"}
  CALLBACK_RECEIVED NG-2026-09-30-61af9e {"status":"Success","sourceIp":"::1","userAgent":"curl/8.7.1","paymentRef":"MjAy…MQ==","statusCode":"00_0000_000","paymentStatus":"SUCCESS"}
CALLBACK_REJECTED (walkthrough rows):
  NG-2026-09-30-b4749a {"reason":"UNKNOWN_PAYMENT_REF","paymentRef":"MjAy…ZWVm"}
  NG-2026-09-30-38ad03 {"reason":"ORDER_MISMATCH","paymentRef":"MjAy…MQ=="}
stuck INITIALIZING attempt after cron: {"status":"FAILED","failureReason":"INITIALIZE_INTERRUPTED"}

refund ledger: [{"amountPoisha":10000,"status":"FAILED","nagadErrorCode":"unavailable:not_configured","requestedByRole":"OWNER","reason":"Walkthrough: guest shortened the stay"}]
payment after refused refund: {"status":"SUCCESS","refundedAmountPoisha":null}
audit events on the payment: CALLBACK_RECEIVED, CALLBACK_RECEIVED, ADMIN_STATUS_CHANGE_BLOCKED(MANAGER), REFUND_INITIATED(OWNER), REFUND_FAILED(OWNER)
status-change blocks on the booking: [{"actorRole":"MANAGER","metadata":{"action":"cancelBookingWithRefundDecision"}}]

--- server log: Nagad API calls during the cron, by outcome
  45 "operation":"verify","outcome":"unavailable","durationMs":0,"reason":"not_configured"
   4 "operation":"verify","outcome":"unavailable","durationMs":1,"reason":"not_configured"
   1 "operation":"verify","outcome":"unavailable","durationMs":5,"reason":"not_configured"
$ grep -c "blocked.invalid\|mynagad" nagad-prod.log
0
```

Admin page payload (MANAGER, booking with a Nagad SUCCESS payment), evaluated in the browser:

```
{ "containsPaymentRef": false, "containsOrderId": false, "containsChallengeHash": false,
  "containsRawPayload": false, "containsBegin": false, "mentionsSensitiveData": false, "htmlBytes": 195731 }
```

Result page at 360 px:

```
{ "viewport": 360, "scrollWidth": 360, "overflowX": false, "smallTargets": [],
  "retryHref": "/api/payments/nagad/callback?payment_ref_id=MjAy…MQ%3D%3D&status=Success", "referrerPolicy": "no-referrer" }
```

Test connection (OWNER, 2FA) in the fail-closed setup showed "This payment method is not available. Reference: NG-2026-09-30-fc8b62." The OWNER-only settings card named the problem (`NAGAD_BASE_URL (not a known Nagad endpoint)`), never a value (screenshot 03). Guests are never shown this text.

Screenshots in `docs/verification/nagad/`:

| File | Shows |
|---|---|
| `03-test-connection-fails-closed.png` | Settings card: "Not Configured", the named problem, test connection refusing |
| `05-staff-no-refund-control.png` | STAFF view of a Nagad-paid booking: no refund or status control |
| `06-manager-no-refund-control.png` | MANAGER view: no refund control |
| `07-owner-refund-fails-closed-without-nagad.png` | OWNER refund attempt with Nagad unreachable: "Nagad is temporarily unavailable… Reference" |
| `09a-result-processing-360.png` | Guest result page ("Confirming your payment", check again) at 360 px |
| `09b-settings-form-360.png` | Nagad limits form at 360 px |

The MANAGER refund-as-note refusal was a browser `alert()`, so it has no screenshot. Its text and the audit row are recorded above.

---

## 4. Build and lint

```
$ pnpm lint
…eslint . (no output: 0 warnings, 0 errors)
✓ All admin, cron and webhook route handlers are guarded
✓ Every exported Server Action in src/app/actions/admin-actions.ts calls a guard
✓ Every exported Server Action in src/app/actions/banglaqr-actions.ts calls a guard
✓ Every exported Server Action in src/app/actions/bkash-actions.ts calls a guard
✓ Every exported Server Action in src/app/actions/nagad-actions.ts calls a guard
✓ Every exported Server Action in src/app/actions/blog/moderation.ts calls a guard
✓ Every exported Server Action in src/app/actions/blog/posts.ts calls a guard
✓ Every exported Server Action in src/app/actions/blog/settings.ts calls a guard
✓ Every exported Server Action in src/app/actions/blog/taxonomy.ts calls a guard
✓ No legacy Float money field names outside src/lib/money-legacy.ts
```

The first lint run failed the money check on one test line that wrote the legacy `totalAmount` column directly. It was fixed in `b020aae` and lint was re-run clean.

```
$ pnpm build
Applying migration `20260930120000_nagad_payment_fields`
Applying migration `20260930120100_nagad_refunds`
Applying migration `20260930120200_nagad_live_index_split`
All migrations have been successfully applied.
▲ Next.js 16.3.5 (Turbopack)
⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.
✓ Compiled successfully in 5.4s
  Running TypeScript ...
  Finished TypeScript in 11.3s ...
✓ Generating static pages using 7 workers (84/84) in 649ms
├ ƒ /api/admin/payments/nagad/test-connection
├ ƒ /api/cron/nagad-reconcile
├ ƒ /api/payments/nagad/callback
├ ƒ /api/payments/nagad/initialize
├ ƒ /api/payments/nagad/token
├ ƒ /payment/nagad/result
```

`pnpm build` runs `prisma migrate deploy` against the `.env` database (`resort_dev`). It applied the three Nagad migrations there. `resort_dev` had **no Nagad payment rows** (checked beforehand), so the legacy-row update touched nothing.

---

## 5. Security greps (§16.3)

```
$ grep -rn "NAGAD_MERCHANT_PRIVATE_KEY\|NAGAD_PG_PUBLIC_KEY\|NAGAD_PUBLIC_KEY\|NAGAD_PRIVATE_KEY" src/ | grep -v "process.env"
src/content/emails/nagad.ts:33:    "…check that NAGAD_PG_PUBLIC_KEY is Nagad's key for this environment…"   (owner email text naming the variable)
src/content/emails/nagad.ts:68:    (the same, Bangla)
src/lib/payments/nagad/errors.test.ts:81 · auth.test.ts:264 · resilience.test.ts:127,139 · crypto.test.ts:70–114   (tests)
src/lib/payments/nagad/__tests__/env.ts:13–14                               (test fixture: TEST-ONLY keys)
src/lib/payments/nagad/__tests__/keys/README.md:18                          (fixture README)
src/lib/payments/nagad/keys.ts:8,11,42                                      (doc comments)
src/lib/payments/nagad/keys.ts:21,96,109,132,136,139,140                    (the variable NAME in NagadKeyError, which reports which variable is bad, never its value)
```

Every match is a test, a fixture, a comment, or the variable's name used in an error or owner message. No value appears anywhere.

```
$ grep -rn "process.env.NAGAD_MERCHANT_PRIVATE_KEY\|process.env.NAGAD_PG_PUBLIC_KEY" src/
src/lib/payments/nagad/keys.ts:163:    .update(process.env.NAGAD_MERCHANT_PRIVATE_KEY ?? "")      (fingerprint for the parse cache)
src/lib/payments/nagad/keys.ts:165:    .update(process.env.NAGAD_PG_PUBLIC_KEY ?? "")
src/lib/payments/nagad/keys.ts:174:    result = parseNagadKeys(process.env.NAGAD_MERCHANT_PRIVATE_KEY, process.env.NAGAD_PG_PUBLIC_KEY);
```

`keys.ts` is the only reader (also enforced by a test that walks `src/`).

```
$ grep -rn "timingSafeEqual" src/lib/payments/nagad/
src/lib/payments/nagad/crypto.ts:1:    import { …, timingSafeEqual, … } from "crypto";
src/lib/payments/nagad/crypto.ts:144:  return provided.length === expected.length && timingSafeEqual(provided, expected);
src/lib/payments/nagad/crypto.test.ts:211:  (asserts the line above exists)
```

The challenge check uses it (`nagadChallengeMatches`). The other secret comparisons are:

- booking tokens: `shared/hs256.ts`, `timingSafeEqual` on the HMAC;
- the cron secret: `lib/cron-auth.ts`, `timingSafeEqual` on sha256 digests.

The callback has no secret to compare: Nagad sends none. Signatures are checked with `crypto.verify`, not by comparison.

```
$ grep -rn "RSA-OAEP\|RSA_PKCS1\|createVerify\|createSign" src/lib/payments/nagad/
src/lib/payments/nagad/crypto.ts:39:  publicEncrypt({ key: pgPublicKey, padding: constants.RSA_PKCS1_PADDING }, …)
src/lib/payments/nagad/crypto.ts:43:  sign("sha256", …, { key: merchantPrivateKey, padding: constants.RSA_PKCS1_PADDING })
src/lib/payments/nagad/crypto.ts:65:  verify("sha256", plaintext, { key: pgPublicKey, padding: constants.RSA_PKCS1_PADDING }, signature)
src/lib/payments/nagad/crypto.ts:111: privateDecrypt({ key: keys.merchantPrivateKey, padding: constants.RSA_PKCS1_PADDING }, ciphertext)
src/lib/payments/nagad/connection-check.ts:37,38   (self-check with OUR key pair only, D9)
src/lib/payments/nagad/__tests__/nagad-side.ts:15,18,24,25   (the fake Nagad's half, tests only)
```

PKCS#1 v1.5 everywhere, as Nagad requires; no OAEP. Signing uses `crypto.sign` / `crypto.verify` with explicit padding rather than `createSign` / `createVerify` (same algorithm, RSA-SHA256).

```
$ grep -rn "Math.random" src/lib/payments/nagad/ | grep -v "\.test\.ts"
(no output)
```

---

## 6. Limitations and things not verified

**Not verified against Nagad** (no sandbox credentials; D10). Each is implemented as the guide and SDKs describe and tested against the fake, and each is settled by the first sandbox payment:

1. **Initialize signature over the decrypted payload (H1).** If Nagad actually signs something else, every initialize fails with `SIGNATURE_INVALID` (fail closed, owner alerted). Capture the `NAGAD_SIGNATURE_INVALID` log line for Nagad support.
2. **`X-KM-IP-V4` (M1).** We send the guest's IPv4, otherwise `NAGAD_SERVER_IPV4`. Nagad may require a whitelisted IP instead.
3. **`merchantCallbackURL` (M2)** in the complete body, plus the `X-KM-Merchant-Callback` header.
4. **Base URLs (M5).** The sandbox paths come from the SDKs.
5. **Refund (D7).** `purchase/cancel` with `sensitiveDataCancelRequest`:
   - The shape of the decrypted response isn't public; a Success without a recognisable reference becomes UNKNOWN (owner resolves), never COMPLETED.
   - `originalRequestDate` is the Dhaka date of the attempt; one SDK sends today's date instead.
   - Nagad's refund window isn't published: **the owner must confirm it** (7 days assumed, editable).
6. **Verify status values.** Only `Success`/`000`, `Aborted`, `Cancelled` and `Failed` are known from public sources. Anything else is treated as "still open", so an unknown failure status leads to ABANDONED after 2 hours rather than an immediate FAILED. That is safe (never a false failure), but slower to tell the guest.
7. **Nagad's session lifetime** isn't published. The 15-minute hold (D5) is our choice.

**Not run manually:** step 1 (payment), step 4 (signature, beyond the automated tests), step 7 against Nagad, the guest side of step 9, and step 10 (automated only, as the brief allows).

**Deferred / known limits.**

- **REVIEW_REQUIRED has no in-app resolution action.** The owner confirms the booking with the normal status control, or refunds from the Nagad portal, as with bKash.
- **The stale-cron alert runs on admin page loads.** With no admin traffic, a stopped cron is noticed only when someone opens the settings page or a Nagad booking. BanglaQR and bKash have the same limit.
- **Legacy rows.** Pre-hardening `INITIATED` Nagad rows were retired as SUPERSEDED, and the old callback wrote FAILED for real successes. After deploy, the owner should reconcile every pre-deploy Nagad row against the Nagad merchant portal (PAYMENTS-NAGAD.md §9). `resort_dev` had none.
- **Two-person refund approval and password re-entry** are not in this phase (same trade-off as bKash).
- **Test keys are committed** (TEST-ONLY, README in the folder, a narrow `.gitignore` exception). A secret scanner on push may flag them. They protect nothing and were never registered with Nagad.
- **Shared Prisma client.** For part of the session a second git worktree shared `node_modules` with the main checkout. Nothing of it remains.

**Adjacent findings (documented, not fixed; carried from the review):**

| # | Location | Finding |
|---|---|---|
| A1 | `src/app/api/webhooks/payment/route.ts` | SSLCommerz bodies still reach the generic router's create-row / cancel-booking logic (depends on the SSLCommerz adapter) |
| A2 | `src/app/api/admin/payments/refund/route.ts` | The SSLCommerz branch keeps the H7 gaps (no ledger, ceiling or idempotency; raw errors) |
| A3 | `src/app/actions/admin-actions.ts` | `updateBooking` can still set any status on SSLCommerz payments |
| A4 | `src/lib/payments/availability.ts:65` | The availability error names missing env vars; Nagad routes no longer return it, but the SSLCommerz create route does |
| A5 | `PaymentLog` | Still mutable and unredacted for SSLCommerz |
| A6 | Confirmation page, booking creation | bKash A1/A6 (public PII by UUID, unthrottled booking creation, `Math.random` booking code) still open |
| A7 | `src/app/admin/settings/payments/PaymentSettingsClient.tsx` | *(found in the walkthrough)* The Nagad card's subtitle "RSA-SHA256, 2-phase initialization" and the generic "Missing environment variable: …" banner are shared UI; the banner shows the readiness problem text (variable name and problem code, no value) to OWNERs only. Acceptable, noted for the SSLCommerz phase |

---

## 7. Commits on `hardening/nagad`

```
c0518d9 docs(nagad): section 0 security review and gap analysis
ce72f59 fix(nagad): section 1 RSA key handling and cryptographic correctness
d6dcbf4 feat(nagad): section 2 strict input validation and Nagad response schemas
c4871cb feat(nagad): section 3 authentication, authorization and the hardened payment core
fc495ef test(nagad): section 4 redirect and callback security
708df96 fix(nagad): section 5 idempotency and race conditions
5d18c9d test(nagad): section 6 amount, order and payer validation
935d233 feat(nagad): section 7 reconciliation cron and heartbeat alerting
5aa37bc test(nagad): section 8 audit logging
9b39534 test(nagad): section 9 rate limiting
d3ba422 test(nagad): section 10 error handling
46f4804 feat(nagad): section 11 failure modes and resilience
ccb1d74 test(nagad): section 12 guest and admin notifications
1f50a7f test(nagad): section 13 automated suite, gap fill
f38d953 refactor(nagad): section 14 developer conventions
098bfdf feat(nagad): owner settings form for Nagad limits (decision D8)
d80135f docs(nagad): section 15 documentation for the hardened integration
b020aae test(nagad): use bookingTotalFields in the total-edit test (check:money)
(this report)
```

No bKash, BanglaQR or SSLCommerz module was changed. The shared files touched are listed below, each change limited to a Nagad branch or an import, with the bKash (157) and BanglaQR (96) suites re-run green:

- `availability.ts` and `payments/index.ts`: import paths;
- `admin-actions.ts`: Nagad guards;
- the shared refund route: returns 400 for Nagad;
- `PaymentSettingsClient.tsx`: `keySizeBits` in the message;
- the booking page and view: Nagad controls;
- the settings page: Nagad form and cron health check;
- `en.ts` / `bn.ts`: new Nagad blocks.

# SSLCommerz Hardening — Verification Report

| | |
|---|---|
| **Date** | 2026-09-30 |
| **Branch** | `hardening/sslcommerz` (from `main` @ `8567ccb`), 20 commits `78b8d17..d0a0870` plus this report — merged to `main` (confirmed via `docs/release/00-MAIN-VERIFICATION.md`, 2026-10-09) |
| **Scope** | Brief sections 0–18; decisions D1–D14 approved as recommended ([security review](PAYMENTS-SSLCOMMERZ-SECURITY-REVIEW.md)) |
| **Environments** | Automated tests: `resort_banglaqr_test` (a `*_test` Postgres DB) with an in-memory SSLCommerz, plus four genuine signed bodies from the real sandbox. Manual walkthrough: **the real SSLCommerz sandbox** (`sandbox.sslcommerz.com`, public demo store `testbox`), through `next dev -p 3100` against the same test DB (see §3 for why not `next start`) |

## Summary

| Area | Result |
|---|---|
| SSLCommerz tests (§18.1) | **334 / 334 pass** in 15 files; identical on repeated runs against the shared test DB |
| Other gateways (regression) | bKash **157 / 157**, Nagad **255 / 255**, BanglaQR **96 / 96** |
| `pnpm test` | **478 passed**, 461 skipped (DB-backed tests are skipped without a `*_test` DB), 0 failed |
| `pnpm lint` | Clean: ESLint 0 errors / 0 warnings, `check:guards` (including the new `sslcommerz-actions.ts`), `check:money` |
| `pnpm build` | Passes. One pre-existing warning (`middleware` → `proxy` deprecation), unrelated |
| Manual walkthrough (§18.2) | **13 of 14 steps run live against the real sandbox; all 13 pass.** Step 2's internet-banking and step 3's MFS payments completed end to end. The 14th brief item (a real **IPN delivered by SSLCommerz**) is **NOT VERIFIED**: the sandbox can't reach a local server, so steps 6–9 POSTed **genuine SSLCommerz-signed bodies captured from the browser** to our IPN route instead (D10) |
| Security greps (§18.3) | Every match justified (§5) |

**What changed, in one line per critical finding:**

| Finding | Before | After |
|---|---|---|
| C1 | One real `val_id` could confirm any booking, including refunded or cancelled ones | The Validator's `tran_id` and `val_id` must be this attempt's, plus amount, currency, a PENDING booking and unique IDs. Live step 4c: another booking's genuine paid `val_id`, re-signed with the password, was refused |
| C2 | The store password could leak into errors shown to MANAGERs, the DB and logs | No URL or body ever enters an error; logs and audit rows are scrubbed. Live: `qwerty` appears 0 times in the dev server log |
| C3 | Every genuine IPN was rejected (wrong hash) | The official algorithm, proven on the 4 committed sandbox vectors and accepted on every genuine body in the live runs (7 payments) |
| C4 | No reconciliation | A 5-minute cron. Live step 13: a paid session with no callback was confirmed |
| C5 | Cancelled, expired or paid bookings could be paid again; two clicks opened two sessions | Payability checks, one open attempt per booking (DB), per-attempt `tran_id` |
| C6 | A zero-parameter GET revealed a booking ID | Nothing is looked up without a hash-verified `tran_id`; no booking ID in redirects |

---

## 1. What changed, by review finding

| Finding | Where it's fixed | Evidence |
|---|---|---|
| C1 validation bound to the caller's `tran_id` | `validate-payment.ts` (binding checks, booking lock, `REVIEW_REQUIRED`) | `redirect.test.ts` "can't confirm another booking" and "cancelled booking is never re-confirmed"; walkthrough 4b, 4c |
| C2 password in error messages | `transport.ts`, `client.ts`, `log.ts`, `audit.ts` | `resilience.test.ts` §1.1 (HTTP 500 body containing the password: nothing in logs, results or errors); `errors.test.ts`; walkthrough log grep |
| C3 wrong IPN hash | `hash.ts` | `crypto.test.ts` (37 tests on genuine vectors); walkthrough steps 7–9 |
| C4 no reconciliation | `reconcile.ts`, `/api/cron/sslcommerz-reconcile` | `reconcile.test.ts`; walkthrough 13 |
| C5 double-payable bookings | `payability.ts`, `initiate-session.ts`, migration `20260930130000` | `auth.test.ts`, `concurrency.test.ts` |
| C6 arbitrary booking via fail/cancel | `callbacks.ts`, `redirect-route.ts` | `redirect.test.ts` "no tran_id at all" |
| H1 generic webhook router | `adapter.ts` refuses; the SSLCommerz webhook route is deleted | `admin-guards.test.ts` |
| H2 hash against an empty password | `hash.ts`, `config.ts` | `crypto.test.ts`, `validation.test.ts` |
| H3 no currency, risk or schema checks | `schemas.ts`, `validate-payment.ts` | `amounts.test.ts` |
| H4 success/IPN race | guarded claim + unique `val_id` / `bank_tran_id` | `ipn.test.ts` §4.5 (concurrent success + IPN), `concurrency.test.ts` |
| H5 success redirect unsigned-trusted | `callbacks.ts` | `redirect.test.ts`; walkthrough 4a |
| H6 fail/cancel changed state | `callbacks.ts` | `redirect.test.ts` §4.2–4.3 |
| H7 mismatch dropped silently | `REVIEW_REQUIRED` + status guards | `amounts.test.ts` |
| H8 refund "success" treated as refunded | `refund.ts` ledger + polling | `refund.test.ts`, `reconcile.test.ts`; walkthrough 12 |
| H9 sandbox default, any host | `config.ts` | `validation.test.ts`; walkthrough production-refusal check |
| H10 test connection passed with any password | `connection-check.ts` | `admin-guards.test.ts`; live sandbox probe (right vs wrong password) |
| H11 `tran_id` reuse | `settlement.ts`, §7.2 uniqueness check | `amounts.test.ts` |
| H12 MANAGER bypasses | `status-guard.ts` in `admin-actions.ts` | `admin-guards.test.ts`; walkthrough 11 |
| H13 raw `bookingId` | `token.ts`, `/token`, `/initiate` | `auth.test.ts` |
| M1–M11, L1–L6 | See the security review's gap list; each has a test in `validation`, `auth`, `ipn`, `redirect`, `resilience`, `audit`, `notifications` or `errors` | |

---

## 2. Automated tests (§18.1)

```
$ DATABASE_URL_TEST=postgresql://…/resort_banglaqr_test pnpm test:sslcommerz:db
 Test Files  15 passed (15)
      Tests  334 passed (334)
   Duration  14.77s

$ pnpm test:bkash:db       →  Test Files 15 passed (15)   Tests 157 passed (157)
$ pnpm test:nagad:db       →  Test Files 15 passed (15)   Tests 255 passed (255)
$ pnpm test:banglaqr:db    →  Test Files 11 passed (11)   Tests  96 passed (96)

$ pnpm test
 Test Files  28 passed | 36 skipped (64)
      Tests  478 passed | 461 skipped (939)
```

SSLCommerz tests per file (from `vitest --reporter=verbose`):

| File | Tests | Covers |
|---|---|---|
| `validation.test.ts` | 57 | Readiness fails closed (every variable, production refusals, allow-list), masking, log scrubbing, strict / passthrough / response schemas, body parsing |
| `errors.test.ts` | 51 | §12.1 table verbatim (en + bn), every code translated, status codes, no leaks |
| `crypto.test.ts` | 37 | Hash on 4 genuine sandbox bodies; old algorithm and the brief's sketch both fail; every fail-closed case; `timingSafeEqual` |
| `amounts.test.ts` | 27 | Amount / currency / total-changed / risk / tran_id / val_id cases, card-data absence, taka parsing |
| `auth.test.ts` | 26 | Token issuance, token tampering and expiry, strict initiate, what is sent and returned, rate limits |
| `refund.test.ts` | 24 | Roles, 2FA, rules, lifecycle (PENDING → COMPLETED), idempotency, UNKNOWN + resolution, trigger, audit |
| `ipn.test.ts` | 21 | Hash, idempotency, IPN vs success in both orders and concurrently, Validator timeout → 503 |
| `redirect.test.ts` | 19 | Success / fail / cancel, 303, C1 and C6 regressions, replay and concurrency |
| `resilience.test.ts` | 13 | SSLCommerz down, Validator failures, password never leaked |
| `concurrency.test.ts` | 13 | DB unique indexes, claims, D6 open attempts, superseded sessions |
| `admin-guards.test.ts` | 13 | Test connection (roles, output, credential rejection), H12 guards, generic router |
| `reconcile.test.ts` | 10 | Lost callback confirmed, abandonment, failed sessions, unreachable, refunds, cron auth |
| `notifications.test.ts` | 9 | Guest and owner emails, throttling, outage safety |
| `settings.test.ts` | 8 | D8 settings: OWNER only, validation, audit |
| `audit.test.ts` | 6 | Event fields, append-only trigger, scrubber, no secrets in any row |

(The section 15 commit message gave slightly different per-file counts; the numbers above are from the test runner. The total, 334, is the same.)

Comparison: bKash 157, Nagad 255, BanglaQR 96. Every cryptographic and trust decision has at least one test showing it fails closed.

---

## 3. Manual walkthrough (§18.2)

**Setup.** `next dev -p 3100` with:
- `DATABASE_URL` pointed at `resort_banglaqr_test`;
- `SSL_BASE_URL=https://sandbox.sslcommerz.com`, the public demo store `testbox` / `qwerty`;
- `NEXT_PUBLIC_APP_URL=http://localhost:3100`, so the browser returns come back to the local server;
- fresh random `SSLCOMMERZ_TOKEN_SECRET` and `CRON_SECRET`;
- the admin users (OWNER with TOTP 2FA, MANAGER, STAFF) from the bKash run.

**Why `next dev`, not `next start`.** In production mode the hardened config refuses exactly this setup (the check was run against the same environment):

```
$ NODE_ENV=production … getSSLCommerzReadiness()
{ "configured": false, "missing": [
  "SSL_CALLBACK_SUCCESS (must be https in production)", … (fail, cancel, ipn likewise),
  "SSL_BASE_URL (sandbox in production; set SSL_ALLOW_SANDBOX=true for staging)",
  "SSL_STORE_ID (the public demo store is refused in production)" ] }
```

That refusal is itself decision D9. The production build was separately verified by `pnpm build` (§4).

| # | Step | Result | Evidence |
|---|---|---|---|
| 1 | Sandbox **card** payment end to end | **PASS (live).** Guest UI booking RES-569748 (৳6,500) → Pay with SSLCommerz → sandbox checkout → VISA `4111…`, OTP, Success → **303 to the confirmation page**, booking CONFIRMED, payment SUCCESS, one `VALIDATOR_CALLED` / `FULFILLMENT_COMPLETED` | `01-card-payment-confirmed.png`, §3.1 |
| 2 | Sandbox **internet banking** payment | **PASS (live).** City Touch net banking → confirmation page; booking CONFIRMED, `card_type=CITYBANKIB-City Bank`, risk 0 | `02-netbanking-confirmed.png` |
| 3 | Sandbox **MFS** payment (bKash inside SSLCommerz) | **PASS (live).** Mobile Banking → bKash → confirmation page; booking CONFIRMED | `03-mfs-bkash-confirmed.png` |
| 4 | Success redirect with a fabricated `val_id` | **PASS (live), three variants.** 4a: a fabricated `val_id` and another booking's `tran_id`, signature not re-computed → 303 "confirming…", **no Validator call**. 4b: the same, **correctly re-signed with the store password** → the **real Validator** said `INVALID_TRANSACTION` → 303 "couldn't verify". 4c (review C1): **another booking's genuine, paid `val_id`**, re-signed for this booking → the Validator's `tran_id` didn't match → refused. The target booking stayed PENDING throughout | §3.2, `04-fabricated-valid-rejected-360.png` |
| 5 | Success redirect twice with a valid `val_id` | **PASS (live).** Two replays of the genuine signed body → both 303 to confirmation; the booking has **1** Validator call and **1** fulfilment | §3.2, §3.3 |
| 6 | IPN with an invalid hash → 400 | **PASS (live).** `verify_sign` zeroed → `400 INVALID` (text/plain); amount 6500 → 1 with the original signature → `400 INVALID`; `verify_sign` removed → `400 INVALID` | §3.2 |
| 7 | Same IPN twice → one fulfilment | **PASS (live, with a genuine signed body).** First `200 OK`, repeat `200 OK duplicate`; 1 fulfilment | §3.2, §3.3 |
| 8 | IPN then success redirect → one fulfilment | **PASS (live, genuine body).** The browser's success POST was held back (Playwright); IPN `200 OK` (actor BANK) confirmed; the success redirect then 303 to confirmation **without** a second Validator call | §3.2, §3.3 |
| 9 | Success redirect then IPN → one fulfilment | **PASS (live, genuine body).** The browser delivered the success; the IPN answered `200 OK duplicate` | §3.2, §3.3 |
| 10 | STAFF attempts a refund → 403 | **PASS (live UI) + automated.** No refund or status control for STAFF; the server-side 403 for the action is `refund.test.ts` | `10-staff-no-refund-360.png` |
| 11 | MANAGER attempts a refund → 403 | **PASS (live UI) + automated.** No refund control. **Live bypass attempt:** MANAGER cancelled the paid booking with "refund ৳6,500 via SSLCommerz" recorded; the server refused ("This booking was paid by SSLCommerz… an owner issues the refund with 'Refund via SSLCommerz'"). The booking stayed CONFIRMED, and `ADMIN_STATUS_CHANGE_BLOCKED` (MANAGER, `cancelBookingWithRefundDecision`) was audited. The action 403 is `refund.test.ts` | `11-manager-no-refund-360.png`, §3.4 |
| 12 | OWNER partial refund → in the SSLCommerz sandbox, logged | **PASS (live).** OWNER signed in with real TOTP 2FA; dialog at 360 px: Partial, ৳1,000.00, reason, amount retyped → "SSLCommerz accepted the refund…". Ledger PENDING with SSLCommerz's `refund_ref_id` `6abd1aa2d448f`; **SSLCommerz's own refund-status API returns it** (`status: processing`, `initiated_on` set). Payment stays SUCCESS until the bank completes it. Audit `REFUND_INITIATED` / `REFUND_PENDING` (OWNER), IDs masked | `12a-owner-refund-dialog-360.png`, `12b-owner-refund-pending-360.png`, §3.4 |
| 13 | Trigger the cron → abandoned payments handled | **PASS (live).** No secret → 401; query-string secret → 401; header → 200 with counts only. A **paid session whose redirect was held back and never delivered** was confirmed by the cron (actor SYSTEM, one fulfilment); a session unpaid for 3 h went **ABANDONED** (`NEVER_PAID`), booking still PENDING | §3.5 |
| 14 | Browser traffic: no `store_passwd`, session key or card data | **PASS (live).** Guest `/token` → `["bookingToken","expiresAt"]`, `/initiate` → `["gatewayUrl","reference"]`, both `no-store`, gateway host `sandbox.sslcommerz.com`. Across those bodies and the admin booking page's full HTML/RSC (323 KB): the password, `store_passwd`, `val_id`, `card_no`, masked card digits (`XXXXXX`, `******`), `sessionkey`, `token_key`, the actual session key and `tran_id` — **all absent**. Only the card **type** ("VISA-Dutch Bangla") is shown. The dev server log contains the password 0 times | §3.6 |

Test connection was also run live as OWNER: `{"success":true,"environment":"sandbox","storeIdMasked":"test****ox"}`. The section 1 live probe showed the same call reporting `CREDENTIALS_REJECTED` with a wrong password; the pre-hardening check passed with any password.

### 3.1 Database state after the walkthrough payments

```
card          booking=CONFIRMED payment=SUCCESS    validatorCalls=1 fulfilments=1 events=BOOKING_TOKEN_ISSUED/GUEST,SESSION_INITIATED/GUEST,SUCCESS_REDIRECT_RECEIVED/GUEST,VALIDATOR_CALLED/GUEST,VALIDATOR_SUCCEEDED/GUEST,FULFILLMENT_COMPLETED/GUEST
netbank       booking=CONFIRMED payment=SUCCESS    validatorCalls=1 fulfilments=1 events=…same…
mfs           booking=CONFIRMED payment=SUCCESS    validatorCalls=1 fulfilments=1 events=…same…
ipnFirst      booking=CONFIRMED payment=SUCCESS    validatorCalls=1 fulfilments=1 events=BOOKING_TOKEN_ISSUED/GUEST,SESSION_INITIATED/GUEST,IPN_RECEIVED/BANK,VALIDATOR_CALLED/BANK,VALIDATOR_SUCCEEDED/BANK,FULFILLMENT_COMPLETED/BANK,SUCCESS_REDIRECT_RECEIVED/GUEST,IPN_RECEIVED/BANK
successFirst  booking=CONFIRMED payment=SUCCESS    validatorCalls=1 fulfilments=1 events=BOOKING_TOKEN_ISSUED/GUEST,SESSION_INITIATED/GUEST,SUCCESS_REDIRECT_RECEIVED/GUEST,VALIDATOR_CALLED/GUEST,VALIDATOR_SUCCEEDED/GUEST,FULFILLMENT_COMPLETED/GUEST,IPN_RECEIVED/BANK,SUCCESS_REDIRECT_RECEIVED/GUEST,SUCCESS_REDIRECT_RECEIVED/GUEST
abandon       booking=PENDING   payment=INITIATED  validatorCalls=2 fulfilments=0 events=…,SUCCESS_REDIRECT_RECEIVED/GUEST,VALIDATOR_CALLED/GUEST,VALIDATOR_FAILED/GUEST,SUCCESS_REDIRECT_RECEIVED/GUEST,VALIDATOR_CALLED/GUEST,VALIDATOR_FAILED/GUEST
```

### 3.2 Raw output: steps 4–9 (curl against `http://localhost:3100`, genuine bodies captured from the sandbox checkout)

```
=== Step 8: IPN first (redirect never delivered), then the success redirect
POST /ipn (genuine body)            → 200 |  content-type: text/plain; charset=utf-8 | body: OK
POST /success (same body)           → 303 | http://localhost:3100/booking/confirmation/adf6da25-…

=== Step 7: the same IPN again
POST /ipn (repeat)                  → 200 |  content-type: text/plain; charset=utf-8 | body: OK duplicate

=== Step 9: success redirect first (delivered by the browser), then the IPN
POST /ipn (same body)               → 200 |  content-type: text/plain; charset=utf-8 | body: OK duplicate

=== Step 5: the success redirect twice more
POST /success (replay 1)            → 303 | http://localhost:3100/booking/confirmation/6232af79-…
POST /success (replay 2)            → 303 | http://localhost:3100/booking/confirmation/6232af79-…

=== Step 6: IPN with an invalid hash
POST /ipn (verify_sign zeroed)      → 400 |  content-type: text/plain; charset=utf-8 | body: INVALID
POST /ipn (amount 6500 → 1, reused sign) → 400 |  content-type: text/plain; charset=utf-8 | body: INVALID
POST /ipn (verify_sign removed)     → 400 |  content-type: text/plain; charset=utf-8 | body: INVALID

=== Step 4a: success redirect with a fabricated val_id and another booking's tran_id, signature not matching
HTTP/1.1 303 See Other
cache-control: no-store, no-cache, must-revalidate
location: http://localhost:3100/payment/sslcommerz/result?state=processing&ref=SC-2026-09-30-c613a8
=== Step 4b: the same, correctly re-signed (as someone holding the store password could) → the Validator decides
HTTP/1.1 303 See Other
location: http://localhost:3100/payment/sslcommerz/result?state=invalid&ref=SC-2026-09-30-a171fa&code=VALIDATION_FAILED&room=0213a3e3-…
=== Step 4c (review C1): another booking's genuine paid val_id, re-signed for this booking's tran_id
HTTP/1.1 303 See Other
location: http://localhost:3100/payment/sslcommerz/result?state=invalid&ref=SC-2026-09-30-d0d762&code=VALIDATION_FAILED&room=0213a3e3-…
```

### 3.3 Genuine signed body (step 8, abridged; the sandbox's own dummy card)

```
tran_id=RES-W986DDD-AFD6&val_id=260930201357cRc2jaukBMjcjsY&amount=6500.00&card_type=VISA-Dutch+Bangla&…
&bank_tran_id=260930201357QcO4ycWkzOYUxyc&status=VALID&currency=BDT&store_id=testbox
&verify_sign=73532e7ff6c286205fb8a53ab8d6ddd8&verify_key=amount%2Cbank_tran_id%2C…%2Cvalue_d
&verify_sign_sha2=54db13d3…&value_a=398b7f82-748d-43c0-b3ba-a0f579571ce3&…&risk_level=0&risk_title=Safe
```

`tran_id` is our per-attempt ID (`{bookingCode}-{4 hex}`); `value_a` is our payment row ID, echoed back under the signature.

### 3.4 Raw output: steps 11–12

```
# Step 11 (after the MANAGER's refused cancel-with-refund)
booking CONFIRMED payments [ 'SSLCOMMERZ:SUCCESS' ]
[{"actorRole":"MANAGER","metadata":{"action":"cancelBookingWithRefundDecision"},"createdAt":"2026-09-30T14:19:14.969Z"}]

# Step 12 (after the OWNER's ৳1,000 partial refund)
{"status":"PENDING","amountPoisha":100000,"refundRefId":"6abd1aa2d448f","referenceNo":"RF2125D937A136","requestedByRole":"OWNER","reason":"Walkthrough: guest shortened the stay by one service"}
payment SUCCESS refunded null
[{"event":"REFUND_INITIATED","actorRole":"OWNER","metadata":{"amount":100000,"reason":"Walkthrough: guest shortened the stay by one service","refundId":"564d2ca2-…","paymentId":"28a9dc0c-…","additional":false,"bankTranId":"2609…I9Qq","adminUserId":"RaDWLTgY…"}},
 {"event":"REFUND_PENDING","actorRole":"OWNER","metadata":{"refundId":"564d2ca2-…","refundRefId":"6abd…448f"}}]
=== SSLCommerz sandbox refund-status API for refund_ref_id 6abd1aa2d448f
{"APIConnect":"DONE","bank_tran_id":"260930201008EGh9u6yerotI9Qq","tran_id":"RES-569748-76B4","initiated_on":"2026-09-30 20:20:18","refunded_on":"0000-00-00 00:00:00","status":"processing","refund_ref_id":"6abd1aa2d448f"}
```

### 3.5 Raw output: step 13

```
=== Step 13: reconciliation cron
no secret              → 401
secret in query string → 401
secret in header       → {"success":true,"checked":50,"settled":2,"confirmed":1,"abandoned":1,"stillPending":48,"closedInitializing":0,"refundsChecked":0,"refundsCompleted":0,"reference":"SC-2026-09-30-07ac0f"}
lostCallback  booking=CONFIRMED payment=SUCCESS    reason=- validatorCalls=1 fulfilments=1 events=BOOKING_TOKEN_ISSUED/GUEST,SESSION_INITIATED/GUEST,VALIDATOR_CALLED/SYSTEM,VALIDATOR_SUCCEEDED/SYSTEM,FULFILLMENT_COMPLETED/SYSTEM
abandon       booking=PENDING   payment=ABANDONED  reason=NEVER_PAID validatorCalls=3 fulfilments=0 events=…,VALIDATOR_CALLED/SYSTEM,PAYMENT_ABANDONED/SYSTEM
```

The walkthrough attempts' creation times were moved back (11 minutes, 3 hours) so the cron would pick them up without waiting. The 48 "still pending" rows are older test-suite leftovers in the shared test DB whose session keys came from the fake SSLCommerz; the real sandbox didn't recognise them and they were left as they were. **Never guessed.**

### 3.6 Raw output: step 14

```json
{"token":{"status":200,"keys":["bookingToken","expiresAt"],"cacheControl":"no-store, no-cache, must-revalidate",
  "scan":{"password":false,"storePasswdField":false,"valIdField":false,"cardNo":false,"masked":false,"maskedStar":false,"sessionKeyField":false,"tokenKey":false}},
 "initiate":{"status":200,"keys":["gatewayUrl","reference"],"cacheControl":"no-store, no-cache, must-revalidate","scan":{…all false…},"gatewayHost":"sandbox.sslcommerz.com"},
 "adminPage":{"bytes":323487,"scan":{…all false…},"rawWebhookPayload":false,"cardType":true}}
{"sessionKeyUpper":false,"sessionKeyLower":false,"tranId":false}
grep in the dev server log:  qwerty 0 · the session key 0 · the val_id 0 · store_passwd 0
```

---

## 4. Build and lint

```
$ pnpm lint
$ eslint . && pnpm check:guards && pnpm check:money
✓ All admin, cron and webhook route handlers are guarded
✓ Every exported Server Action in src/app/actions/admin-actions.ts calls a guard
… banglaqr-actions.ts, bkash-actions.ts, nagad-actions.ts, sslcommerz-actions.ts, blog/*.ts …
✓ No legacy Float money field names outside src/lib/money-legacy.ts
(exit 0)

$ pnpm build
Applying migration `20260930130000_sslcommerz_payment_fields`
Applying migration `20260930130100_sslcommerz_refunds`
All migrations have been successfully applied.
▲ Next.js 16.3.5 (Turbopack)
⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.   ← pre-existing, unrelated
✓ Compiled successfully in 5.5s
  Finished TypeScript in 13.3s ...
✓ Generating static pages using 7 workers (86/86) in 2.9s
├ ƒ /api/admin/payments/sslcommerz/test-connection
├ ƒ /api/cron/sslcommerz-reconcile
├ ƒ /api/payments/sslcommerz/{cancel,fail,initiate,ipn,success,token}
├ ƒ /payment/sslcommerz/result
(exit 0)
```

`pnpm build` runs `prisma migrate deploy` on the database in `.env`, so it applied both SSLCommerz migrations to `resort_dev`, which had **no SSLCommerz rows** (checked before the review). Both migrations are additive; the one `UPDATE` touches only SSLCommerz `INITIATED` rows.

Mobile (§4 of the project rules): the new guest result page and the admin refund dialog, pending-refund note and payment card were checked at **360 px** with no horizontal scroll (`scrollWidth 360 = clientWidth 360`); touch targets use `min-h-11`.

---

## 5. Security greps (§18.3)

```
$ grep -rn "SSL_STORE_PASSWORD\|store_passwd" src/ | grep -v "process.env"
```

| Match | Justification |
|---|---|
| `client.ts:56` `store_passwd: config.storePassword` | **The single place the password enters a request** (decision D2) |
| `config.ts:14,137` | Doc comment; readiness message naming the variable, never its value |
| `hash.ts:6,17,18,33,57,103` | Doc comment; the hash's `store_passwd=md5(password)` entry (SSLCommerz's algorithm); refusing a `verify_key` that lists `store_passwd` |
| `log.ts:12,25`, `audit.ts:83` | The scrubbers that remove `store_passwd=…` from log lines and audit values |
| `content/emails/sslcommerz.ts:34,69` | The owner alert names the variable to check (`SSL_STORE_PASSWORD`), no value |
| `*.test.ts`, `__tests__/env.ts`, `__tests__/fake-sslcommerz.ts` | Test fixtures and assertions that the password does **not** appear |

```
$ grep -rn "timingSafeEqual" src/lib/payments/sslcommerz/
src/lib/payments/sslcommerz/hash.ts:1:import { createHash, timingSafeEqual } from "crypto";
src/lib/payments/sslcommerz/hash.ts:75:  return timingSafeEqual(a, b);          ← verify_sign and verify_sign_sha2 comparison
src/lib/payments/sslcommerz/crypto.test.ts:…                             ← spy proving it is called
```

The booking token is also compared with `timingSafeEqual`, in the shared `shared/hs256.ts`.

```
$ grep -rn "card_no\|cvv\|card_expiry" src/
```

| Match | Justification |
|---|---|
| `audit.ts:78` | The audit scrubber's **forbidden-key list** (drops those keys if a caller ever passes them) |
| `__tests__/vectors/sandbox-callbacks.json` | Genuine sandbox callbacks (SSLCommerz's dummy cards), committed as hash vectors; the signed field list includes `card_no` |
| `__tests__/fake-sslcommerz.ts`, `*.test.ts` | The fake returns a masked card number so tests can prove it is **not** stored or parsed |

No production code parses, stores or logs a card number: the Validator schema doesn't parse `card_no` at all.

```
$ grep -rn "md5\|createHash" src/lib/payments/sslcommerz/
```

| Match | Justification |
|---|---|
| `hash.ts` | MD5 as SSLCommerz specifies (and SHA-256 for `verify_sign_sha2`); rationale in the file header and in `PAYMENTS-SSLCOMMERZ.md` §5 |
| `mask.ts:35,40` | sha256 for the session-key hash and the rejected-body fingerprint (audit correlation only) |
| `crypto.test.ts`, `__tests__/fake-sslcommerz.ts` | Independent implementations used to prove the algorithm; SHA-256 used to prove MD5 isn't "upgraded" |

---

## 6. Limitations and things not verified

1. **IPN delivery by SSLCommerz: NOT VERIFIED.** SSLCommerz can't reach a local server. The IPN route was exercised with **genuine SSLCommerz-signed bodies** captured from the browser (the IPN has the same fields and signature as the success POST, per the official SDKs), but never with a request originating from SSLCommerz. Unknowns:
   - its retry schedule;
   - whether it expects a particular response body;
   - its source IPs;
   - whether the store's panel IPN URL overrides the per-session `ipn_url`.

   Needs a team sandbox store and a public HTTPS URL.
2. **Production (`securepay.sslcommerz.com`) not exercised.** Everything live ran on the sandbox. Production-only behaviour is unverified:
   - amount limits (the sandbox enforces neither ৳10 nor ৳500,000);
   - risk scoring;
   - refund completion times;
   - any field differences between sandbox and production Validator answers (the schema fails closed on a missing field).
3. **A completed refund was not observed.** Sandbox refunds stayed `processing` for the whole session. The `refunded` status and `refunded_on` handling come from the SDKs and API shape; the completion path is tested against the fake only.
4. **`verify_sign_sha2`** is undocumented. Its formula was reproduced offline on one committed vector, and our check passed on every genuine body in the live runs (all carried it). If SSLCommerz changes it, genuine notifications would be refused with `SHA2_MISMATCH` (fail closed, owner alerted); MD5 alone would still pass.
5. **Refund window** (7 days) and whether SSLCommerz allows a further refund **after** one completes are assumptions; confirm with the merchant agreement. The code allows another only after the first completes, and only with "additional" ticked.
6. **The walkthrough ran on `next dev`**, because production mode (correctly) refuses the sandbox host and the demo store. The production build compiled and passed type checking.
7. **Test cards other than VISA 4111… were not run** (Mastercard, Amex, local cards). The sandbox chose the risk flag itself: the same card came back risk 1 and risk 0 on different payments.
8. **Pre-deploy data.** Old SSLCommerz rows are not re-checked automatically. The migration retires old INITIATED rows (`LEGACY_SESSION_RETIRED`); the owner must compare pre-deploy rows with the SSLCommerz panel. Old `PaymentLog` rows may hold the store password (review C2); **check production**, and rotate the password if any do.
9. **The session key appears (lower-cased) inside SSLCommerz's own checkout URL** that the guest must visit (`/EasyCheckOut/testcde<sessionkey>`). That is SSLCommerz's design; our API responses and pages never carry it separately.
10. **Walkthrough artefacts** in `resort_banglaqr_test`: 7 bookings (`RES-569748`, `RES-W…`) with sandbox sessions, one pending sandbox refund, and audit rows. The sandbox credentials (public) and walkthrough secrets lived only in the scratchpad, never in the repo.

## 7. Adjacent findings (documented, not fixed in this phase)

The seven from the security review (A1–A7) still apply. Three more turned up during the walkthrough:

| # | Location | Finding |
|---|---|---|
| A8 | `src/components/travel/PaymentMethodSelector.tsx` | With SSLCommerz as the only enabled gateway, the payment step still says "You will be redirected to **Nagad** to complete your payment securely", and shows the bKash and Nagad badges. Shared UI copy, not SSLCommerz logic |
| A9 | `src/components/admin/BookingActionButtons.tsx` (cancel dialog) | Tells staff to use "Initiate Refund" on the payment. That button no longer exists for any gateway (bKash, Nagad and SSLCommerz each have "Refund via …"). The server-side guard is what protects; the text is stale |
| A10 | `src/app/admin/bookings/[id]/BookingDetailView.tsx` | Shows every gateway's full transaction ID ("Transaction ID (TrxID)") to all admin roles, including STAFF. For SSLCommerz that is the bank transaction ID, which staff need to look up the payment in the merchant panel. Masking it in the UI would be a product decision across all gateways |

## 8. Commits on `hardening/sslcommerz`

```
d0a0870 docs(sslcommerz): section 17 documentation for the hardened integration
c083888 refactor(sslcommerz): section 16 developer conventions
f89622b fix(sslcommerz): IPN asks for a retry only when SSLCommerz couldn't be reached
846bfdc test(sslcommerz): section 15 automated test suite
33820a8 feat(sslcommerz): owner settings form for SSLCommerz limits (decision D8)
ea5d4cc feat(sslcommerz): section 14 notifications
1e075c6 feat(sslcommerz): section 13 failure modes and resilience
e600bb5 test(sslcommerz): section 12 error handling
30974b7 feat(sslcommerz): section 11 rate limiting
c061191 feat(sslcommerz): section 10 audit logging
e0c6ea6 feat(sslcommerz): section 9 reconciliation cron
e9c2e1a feat(sslcommerz): section 8 refund flow
3dd2bb1 feat(sslcommerz): section 7 amount and transaction validation
a286afa feat(sslcommerz): section 6 idempotency and admin status guards
c003834 feat(sslcommerz): section 4 callback security
091f15f feat(sslcommerz): section 5 callback hash verification      ← before section 4: the callbacks depend on it
de21270 feat(sslcommerz): section 3 session initiation
1c79e7d feat(sslcommerz): section 2 input and callback body validation
de34939 feat(sslcommerz): section 1 credential handling
78b8d17 docs(sslcommerz): section 0 security review and gap analysis
```

Not merged, not pushed. Merging waits for the owner's review of this report.

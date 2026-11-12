# bKash Hardening — Verification Report

| | |
|---|---|
| **Date** | 2026-09-30 |
| **Branch** | `hardening/bkash` — merged to `main` (confirmed via `docs/release/00-MAIN-VERIFICATION.md`, 2026-10-09) |
| **Commits** | `611db47` (Section 0 review) … this report |
| **Environments** | Automated tests: `resort_banglaqr_test` (a `*_test` Postgres DB) with an in-memory bKash. Manual walkthrough: production build (`pnpm build && pnpm start`) against the same test DB and the **real bKash sandbox** (`tokenized.sandbox.bka.sh`, bKash's publicly published sandbox merchant; decision D10) |
| **Related** | [PAYMENTS-BKASH.md](PAYMENTS-BKASH.md) · [security review](PAYMENTS-BKASH-SECURITY-REVIEW.md) |

## Summary

| Check | Result |
|---|---|
| bKash automated tests (DB-backed) | **157 / 157 passed** |
| BanglaQR automated tests (regression; shares the audit and payment tables) | **96 / 96 passed** |
| Unit test run (`pnpm test`, no test DB) | **211 passed, 139 skipped** (the DB-backed tests are marked skipped) |
| `pnpm lint` | **Passed, 0 warnings, 0 errors** |
| `pnpm build` | **Passed.** One warning, which predates this work and is not bKash code: the `middleware` file convention is deprecated (see Limitations) |
| Manual walkthrough (§16.2) | 8 of 10 steps run as written. Step 3 was run with a real bKash callback URL, but not the successful one (see below). Step 5 was **not run manually**: no real SNS source is available locally. Both are fully covered by automated tests |
| Security greps (§16.3) | Every match justified (below) |

**The most important finding from verification.** Against the real bKash sandbox, the pre-hardening execute call (`/execute/{paymentID}`) and query call (`GET /payment/status?paymentID=`) both return **HTTP 403**. The integration as it stood could not complete a bKash payment. After hardening, a real sandbox payment was taken end to end (manual step 1), and a real partial refund was issued and confirmed on bKash's side (step 8).

---

## 1. bKash API behaviour observed in the sandbox (2026-09-29)

These observations shaped the implementation. Tokens are redacted; wallet numbers are bKash's public sandbox test wallets.

```
grant   HTTP 200 {'statusCode':'0000','token_type':'Bearer','id_token':'<877 chars>','refresh_token':'<1772 chars>','expires_in':3600}

create  HTTP 200 {"paymentID":"TR0011xzqNkI81790700350218", "bkashURL":"https://sandbox.payment.bkash.com/?paymentId=…",
                  "successCallbackURL":"…/callback?paymentID=TR0011…0218&status=success&signature=DPvMz5DgI6",
                  "failureCallbackURL":"…&status=failure&signature=DPvMz5DgI6",
                  "cancelledCallbackURL":"…&status=cancel&signature=DPvMz5DgI6",
                  "amount":"10.00","transactionStatus":"Initiated","merchantInvoiceNumber":"PROBE-1061","statusCode":"0000"}
        → the same signature is on all three callback URLs: we store its hash and require it on the callback

execute (body, before the guest authorised)   HTTP 200 {"statusCode":"2056","statusMessage":"Invalid Payment State"}
execute (path parameter = old code)           HTTP 403 {"message":"Authorization header requires 'Credential' parameter. …"}
query   (POST body)                           HTTP 200 {…,"merchantInvoice":"PROBE-1061","transactionStatus":"Initiated",…}   ← "merchantInvoice", not "…Number"
query   (GET query string = old code)         HTTP 403 {"message":"Authorization header requires 'Credential' parameter. …"}
bad token                                     HTTP 401 {"message":"Unauthorized"}

browser callback after PIN (sandbox)   GET …/cb?paymentID=TR0011v9BXie61790700438268&status=success&signature=iaIdgB7zom&apiVersion=1.2.0-beta/
execute #1   {"trxID":"DIT20PI6O4","transactionStatus":"Completed","amount":"25.50","merchantInvoiceNumber":"PROBE-15788299",
              "customerMsisdn":"01929918378","statusCode":"0000",…}
execute #2   {"statusCode":"2062","statusMessage":"The payment has already been completed"}

v1 refund 5.00      {"refundTrxID":"DIT80PI7BW","transactionStatus":"Completed","amount":"5.00","statusCode":"0000"}
v1 refund status    returns only that one refund
v2 refund 2.00      {"refundTrxId":"DIT00PI7BY","refundTransactionStatus":"Completed","refundAmount":"2.00",…}
v2 refund status    lists both refunds; the 2.00 appeared a few seconds after the refund call (eventual consistency)
v2 over-refund      HTTP 400 {"internalCode":"refund_amount_exceed_payment_amount","externalCode":"2072",…}
```

Consequences:

- Execute and query send `paymentID` in the body.
- `apiVersion` (with its trailing slash) is accepted on the callback, and the callback `signature` is bound to the value bKash issued.
- The Query Payment invoice field is normalised.
- 2062/2117 are resolved through Query Payment.
- Refunds use v2. This is a change to D9, recorded in the security review.
- An UNKNOWN refund is not declared failed until it has been missing from bKash's refund list for 15 minutes.

---

## 2. Automated tests (§16.1)

Command:

```
DATABASE_URL_TEST=postgresql://…/resort_banglaqr_test pnpm test:bkash:db
```

```
 Test Files  15 passed (15)
      Tests  157 passed (157)
   Duration  8.56s
```

### Required items → tests

Each file below is in `src/lib/payments/bkash/`.

| Brief item | Test (file › name) | Result |
|---|---|---|
| Webhook signature verification rejects invalid signatures: empty, malformed, wrong length, right length but wrong value | `crypto.test.ts` › §8.1: "rejects an empty signature", "rejects an malformed (not base64)", "rejects an wrong length", "rejects a signature of the right length from another key", plus tampered body, wrong topic, and untrusted cert URL. *These run against the AWS SNS signature, per D1; bKash sends no HMAC* | ✅ |
| Token cache: concurrent refresh calls bKash once | `token-cache.test.ts` › "10 simultaneous requests with no cached token cause exactly one grant call" | ✅ |
| Token not leaked in any log or error response | `token-cache.test.ts` › "is never written to a log line or an audit row, on success or failure"; `errors.test.ts` › "token endpoint down … never uses a stale token or leaks bKash's error" | ✅ |
| Callback rejects an unknown paymentID | `redirect.test.ts` › "rejects a fabricated paymentID with 400 and audits it with the source IP" | ✅ |
| Callback does NOT fulfil when status=failure | `auth.test.ts` › "never fulfils from the status parameter"; "a forged failure callback cannot mark a paid booking unpaid" | ✅ |
| Callback is idempotent on repeated invocation | `redirect.test.ts` › "replaying a success callback after payment redirects to confirmation without re-executing"; `concurrency.test.ts` › "two simultaneous success callbacks execute once and fulfil once" | ✅ |
| Execute rejects an amount mismatch | `amounts.test.ts` › "execute reporting a different amount parks the payment for review; the booking is not confirmed" | ✅ |
| Execute rejects a merchantInvoiceNumber mismatch | `amounts.test.ts` › "execute reporting another invoice number is a high-severity review, not a confirmation" | ✅ |
| Webhook signature verified with timingSafeEqual | SNS signatures are RSA-verified (`crypto.createVerify`); the secret-bearing comparisons (`TopicArn`, callback signature) use `timingSafeEqual`. `crypto.test.ts` › "rejects a genuine SNS message from another topic"; "matches only the signature bKash issued, in constant time". Grep in §5 | ✅ (adapted, D1) |
| Webhook idempotent on repeated delivery | `webhook.test.ts` › "is idempotent: the same notification delivered twice fulfils once" | ✅ |
| Refund requires OWNER | `auth.test.ts` › "refunds are OWNER-only: STAFF and MANAGER get 403 and the attempt is audited" | ✅ |
| Refund requires a reason of at least 10 characters | `auth.test.ts` › "an OWNER refund needs a reason of at least 10 characters and the exact amount retyped"; `validation.test.ts` › §2.4 | ✅ |
| Rate limits trigger at the correct thresholds | `rate-limiter.test.ts` (6 tests: create per booking and per IP, webhook, refund, test-connection, token and callback) | ✅ |
| Booking token expiry enforced | `crypto.test.ts` › "enforces expiry" | ✅ |
| Reconciliation cron fulfils abandoned payments | `resilience.test.ts` › "fulfils a payment the guest completed but whose callback/execute never came back"; "closes sessions the guest never authorised as ABANDONED …" | ✅ |

### Full list (157)

<details>
<summary>Expand</summary>

```
auth.test.ts (13)
  §1.1 issues a token only for the matching booking ID + code pair
  §1.1 refuses a raw bookingId in the body (strict schema), and a missing or forged token
  §1.1 refuses bookings that are cancelled, confirmed, or past the payment window
  §1.1 refuses a second payment once the booking has a successful bKash payment
  §1.1 rejects an amount that differs from the booking total
  §1.1 sends the guest phone from the booking record as payerReference
  §1.2 never fulfils from the status parameter: failure/cancel leave the payment and booking untouched
  §1.2 a forged failure callback cannot mark a paid booking unpaid
  §1.2 confirms only after execute succeeds, then redirects to the confirmation page with 302
  §1.2 status=success without guest authorisation does not confirm
  §1.5 refunds are OWNER-only: STAFF and MANAGER get 403 and the attempt is audited
  §1.5 an OWNER refund needs a reason of at least 10 characters and the exact amount retyped
  §1.6 test-connection is OWNER-only and returns only success, environment and tokenExpiresIn
validation.test.ts (38): §2.1 create payload (10), §2.2 callback (7), §2.3 webhook (3), §2.4 refund (8), responses (4), amount/payer helpers (6)
token-cache.test.ts (12): §3.2 (2), §3.3 (4), §3.4 (3), §3.1/§3.5 (3)
redirect.test.ts (9): fabricated ID, wrong signature, malformed/polluted params, replay after payment, failure page,
  attempt TTL, superseded session, 302 + no-store, unique paymentID
amounts.test.ts (7): execute amount mismatch → review, total edited → refused before execute, create echo mismatch,
  refund ceiling, per-attempt invoice, invoice mismatch → review, phone never unmasked
concurrency.test.ts (11): double callback, callback mid-execute, callback vs reconciliation, execute timeout blocks
  second session, concurrent creates, DB one-live index, refund double click, additional-refund flag, refund trigger,
  cancelled booking never charged, admin action guards
refund.test.ts (6): refund window, non-refundable states / trxID mismatch, audited partial refund, declined → FAILED,
  lost response → UNKNOWN → reconciled, missing from list → FAILED after 15 min
crypto.test.ts (15): SNS signature (9), booking tokens (4), callback signature (1), randomness (1)
webhook.test.ts (10): bad signature 400 + audit, malformed/oversized, generic router refuses bKash, lost execute →
  confirmed via Query, duplicate delivery, webhook after callback, amount mismatch flagged, closed session flagged,
  foreign invoice ignored, subscription confirmation only via AWS SNS
rate-limiter.test.ts (6), audit.test.ts (3), errors.test.ts (7), resilience.test.ts (9), notifications.test.ts (9), settings.test.ts (2)
```

</details>

### Regression: BanglaQR

```
 Test Files  11 passed (11)
      Tests  96 passed (96)
```

Nagad and SSLCommerz have **no automated tests** in the repository, so there was no suite to run for them. Their code paths were not modified. Shared files touched for bKash, each only in its bKash branch:

| File | Change |
|---|---|
| `admin-actions.ts` | bKash guards |
| `api/admin/payments/refund/route.ts` | The bKash branch now returns 400 |
| `lib/payments/index.ts` | Barrel export removed |
| `availability.ts` | Readiness import path |
| `types.ts` | Unused bKash interfaces removed |
| `PaymentSettingsClient.tsx`, `SettingsClientView.tsx` | Test-connection message fallback |
| `BookingDetailView.tsx` | bKash controls; the Nagad/SSLCommerz refund button is unchanged |
| `admin/settings/payments/page.tsx` | Form added |

A renaming pass briefly touched two BanglaQR files and one SSLCommerz file; this was caught and reverted before the Section 14 commit, and the BanglaQR suite passes.

---

## 3. Manual walkthrough (§16.2)

The production build ran against the test DB with the sandbox credentials. `BKASH_ALLOW_SANDBOX_IN_PRODUCTION=true` was set, the documented staging flag; without it, readiness correctly refuses a sandbox URL in production. Screenshots are in `docs/verification/bkash/`.

| # | Step | Result | Evidence |
|---|---|---|---|
| 1 | Complete a sandbox bKash payment end to end | ✅ Guest booked RES-223065 (৳12,500) at 360 px, clicked **Pay with bKash** and was redirected to bKash's sandbox. bKash showed invoice `RES-223065-BA1C` with the wallet prefilled from the booking. The guest entered OTP and PIN and was redirected to `/booking/confirmation/…`. DB: booking **CONFIRMED**, payment **SUCCESS**, trxID stored, `rawWebhookPayload` masked (`{"trxId":"DI****NJ",…}`). Audit trail: `BOOKING_TOKEN_ISSUED → PAYMENT_CREATED → CALLBACK_RECEIVED → EXECUTE_CALLED → EXECUTE_SUCCEEDED → FULFILLMENT_COMPLETED` | `01-checkout-360.png`, `02-bkash-sandbox-360.png`, `03-confirmation-360.png` |
| 2 | Hit the callback with a fabricated paymentID | ✅ `HTTP/1.1 400`, `cache-control: no-store, no-cache, must-revalidate`, body `{"code":"INVALID_CALLBACK","reference":"BK-2026-09-30-449f7a",…}`. Audit: `CALLBACK_REJECTED`, `ipAddress 203.0.113.50`, `reason UNKNOWN_PAYMENT_ID` | §3.1 below |
| 3 | Hit the callback twice with a valid paymentID; only one fulfilment | ⚠️ **Partly as written.** The successful step-1 callback URL couldn't be replayed: its signature exists only in the guest's browser history, and we store just its hash. Instead, a **real bKash-issued callback URL** captured from the sandbox (paymentID + signature, originally `status=failure`) was replayed twice as `status=success`. Attempt 1: one execute; bKash `2056`; Query says `Initiated`; payment FAILED; guest not charged. Attempt 2: **no bKash call**, same result page. Replaying the step-1 paymentID with a guessed signature gives **400**; that payment stays SUCCESS. The duplicate-*success* case is covered by automated tests (§2) | §3.1 |
| 4 | Webhook with an invalid signature | ✅ `HTTP/1.1 400 {"code":"WEBHOOK_REJECTED",…}`. Audit `WEBHOOK_REJECTED`, `signatureValid:false`, body hash only. A cert URL off AWS also gives 400. Note: for a pinned AWS host, the server did request the named `.pem` from AWS, got a 404, and refused (`CERT_UNAVAILABLE`) | §3.1 |
| 5 | Same webhook twice; one fulfilment | ❌ **Not run manually.** A genuine SNS message needs bKash to publish to an SNS topic subscribed to a public URL. Locally, the only valid signatures are our own test key's, and the server (correctly) accepts certificates only from `sns.*.amazonaws.com`. Covered by `webhook.test.ts` › "is idempotent …" with real RSA signatures | — |
| 6 | STAFF attempts a refund; 403 | ✅ STAFF sees no refund button. Replaying the OWNER's captured Server Action request (`Next-Action: 4075d3c6…`) from the STAFF session returns **HTTP 403**. Audit `ADMIN_ACTION_DENIED`, `actorRole STAFF`, `requiredRole OWNER`. No refund row created | `09-staff-booking-360.png` |
| 7 | MANAGER attempts a refund; 403 | ✅ Same as step 6: **HTTP 403**, audited as `MANAGER` | `09-manager-booking-360.png` |
| 8 | OWNER issues a refund; it appears in bKash sandbox and is logged | ✅ OWNER enabled real TOTP 2FA via `/admin/setup-2fa`, then opened the refund dialog at 360 px: Partial, ৳500.00, reason, amount retyped. Result: "Refund completed. bKash refund ID DIU20PI81A." **bKash v2 refund status:** `{"originalTrxId":"DIU30PI8NJ","refundTransactions":[{"refundTrxId":"DIU20PI81A","refundTransactionStatus":"Completed","refundAmount":"500.00"}]}`. DB: payment **PARTIALLY_REFUNDED**, `refundedAmountPoisha 50000`, BkashRefund COMPLETED (OWNER). Audit `REFUND_INITIATED` / `REFUND_SUCCEEDED` with masked trxIDs | `06-admin-bkash-payment-360.png`, `07-refund-dialog-360.png`, `08-refund-done-360.png` |
| 9 | Trigger the reconciliation cron; abandoned payments handled | ✅ No secret → 401; `?secret=` in the URL → 401. With `Authorization: Bearer`: a real sandbox session the guest never authorised, backdated to 45 min, became **ABANDONED** via Query Payment (`bkashStatus: Initiated`). Audit `PAYMENT_ABANDONED` (SYSTEM); booking left **PENDING**; `CronHeartbeat` updated. The first run also closed 52 stale **test-fixture** sessions from automated test runs; the sandbox didn't recognise their fake paymentIDs, so they were closed with no charge | §3.1 |
| 10 | Browser network: no id_token, app_secret or full phone | ✅ In the browser, a guest's `/api/payments/bkash/token` response has only `["bookingToken","expiresAt"]` and `/create` has only `["bkashURL","reference"]`, both with `no-store`. Across those bodies and the checkout HTML: `id_token` **false**, app secret **false**, app key **false**, API password **false**, guest phone **false**. The guest's own phone does travel in their own `/api/bookings` request (they typed it), and the pre-existing confirmation page displays it (adjacent finding A1) | §3.1 |

Also checked at 360 px with no horizontal overflow (`scrollWidth === clientWidth`): the result page in processing, failed and review states, and the owner settings form (`10-result-*-360.png`, `11-settings-360.png`). `05-result-failed-desktop.png` shows the failure page after a real sandbox `status=failure` callback.

**Sandbox behaviour worth knowing.** After the first successful payment, the sandbox refused the PIN on the next four attempts (`pin/validate` → HTTP 400, then `status=failure`). That happened across three test wallets and two amounts. Our system handled every one correctly: no execute, payment untouched, guest shown "Payment not completed … You were not charged". We stopped retrying rather than keep sending requests to bKash's public sandbox. Reopening the step-1 `bkashURL` afterwards made bKash itself answer "Invalid page access request". That is extra protection against old-URL replay, alongside our own 30-minute attempt limit.

### 3.1 Raw output (manual steps 2, 3, 4, 9)

```
### Step 2: fabricated paymentID
HTTP/1.1 400 Bad Request
cache-control: no-store, no-cache, must-revalidate
{"error":"This payment link isn't valid. If you were charged, please contact us with the reference below. Reference: BK-2026-09-30-449f7a.","code":"INVALID_CALLBACK","reference":"BK-2026-09-30-449f7a"}

### Step 3: replay a real bKash callback URL (captured from the sandbox, originally status=failure) as status=success, twice
attempt 1 -> HTTP 302 Location: http://localhost:3000/payment/bkash/result?state=failed&ref=BK-2026-09-30-872f40&code=PAYMENT_FAILED
attempt 2 -> HTTP 302 Location: http://localhost:3000/payment/bkash/result?state=failed&ref=BK-2026-09-30-18ccba&code=PAYMENT_FAILED
### Step 3b: same real paymentID with a forged signature
HTTP 400
### Step 3c: the successful step-1 payment, replayed without its signature
HTTP 400

audit BK-2026-09-30-872f40: CALLBACK_RECEIVED → EXECUTE_CALLED → EXECUTE_OUTCOME_UNKNOWN {"outcome":"rejected","bkashCode":"2056"} → EXECUTE_FAILED {"source":"query","bkashStatus":"Initiated"}
audit BK-2026-09-30-18ccba: CALLBACK_RECEIVED {"paymentStatus":"FAILED"}      ← no execute, no query
log:   bkash.api.call operation=execute outcome=rejected bkashCode=2056 (872f40 only); operation=query outcome=ok (872f40 only)
step-1 payment: {"status":"SUCCESS"}

### Step 4: webhook with an invalid signature
HTTP/1.1 400 Bad Request
{"error":"Webhook rejected. Reference: BK-2026-09-30-5c9860.","code":"WEBHOOK_REJECTED","reference":"BK-2026-09-30-5c9860"}
audit: WEBHOOK_REJECTED {"reason":"CERT_UNAVAILABLE","bodyHash":"39630cc8…","signatureValid":false} ip 203.0.113.60
### Step 4b: webhook signed with a certificate hosted off AWS
HTTP 400

### Step 9: cron
no secret → HTTP 401 · ?secret= → HTTP 401
{"success":true,"checked":50,"settled":50,…}   {"success":true,"checked":3,"settled":3,…}   then {"checked":0,…}
target payment: {"status":"ABANDONED","failureReason":"BKASH_INITIATED"}
audit: [{"event":"PAYMENT_ABANDONED","actorType":"SYSTEM","metadata":{"source":"query","trigger":"reconcile","bkashStatus":"Initiated"}}]
booking: {"status":"PENDING"}   heartbeat: {"name":"bkash-reconcile","lastError":null,…}

### Step 10: browser, checkout page → /token → /create
{"tokenResponse":{"status":200,"cacheControl":"no-store, no-cache, must-revalidate","keys":["bookingToken","expiresAt"]},
 "createResponse":{"status":200,"cacheControl":"no-store, no-cache, must-revalidate","keys":["bkashURL","reference"],"bkashUrlHost":"sandbox.payment.bkash.com"},
 "leaks":{"id_token":false,"appSecret":false,"appKey":false,"password":false,"phoneInBkashApiResponses":false,"phoneInCheckoutHtml":false}}
```

---

## 4. Build and lint (§16.4)

```
$ pnpm lint
✓ All admin, cron and webhook route handlers are guarded
✓ Every exported Server Action in src/app/actions/bkash-actions.ts calls a guard
✓ No legacy Float money field names outside src/lib/money-legacy.ts
(exit 0; 0 warnings, 0 errors)

$ pnpm build
Applying migration `20260930100000_bkash_payment_fields` … `20260930100400_bkash_idempotency`
⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.
✓ Compiled successfully in 6.9s
✓ Generating static pages using 7 workers (82/82)
├ ƒ /api/admin/payments/bkash/test-connection
├ ƒ /api/cron/bkash-reconcile
├ ƒ /api/payments/bkash/callback
├ ƒ /api/payments/bkash/create
├ ƒ /api/payments/bkash/token
├ ƒ /api/webhooks/payment/bkash
├ ƒ /payment/bkash/result
(exit 0)
```

The one build warning comes from `src/middleware.ts`, the shared admin session guard, which predates this work. It is not changed here because it guards every admin route. It is noted below.

---

## 5. Security greps (§16.3)

```
$ grep -rn "BKASH_WEBHOOK_SECRET\|BKASH_APP_SECRET\|BKASH_PASSWORD" src/ | grep -v "process.env"
src/lib/payments/bkash/errors.test.ts:108:    vi.stubEnv("BKASH_APP_SECRET", "");           ← test: proves a missing secret disables bKash
src/lib/payments/bkash/__tests__/env.ts:10:  BKASH_APP_SECRET: "test-app-secret",            ← test fixture for the in-memory bKash
src/lib/payments/bkash/__tests__/env.ts:12:  BKASH_PASSWORD: "test-password",                ← test fixture
```

No production match. `BKASH_WEBHOOK_SECRET` no longer appears anywhere (D1).

```
$ grep -rn "timingSafeEqual" src/lib/payments/bkash/
src/lib/payments/bkash/settlement.ts:64:  return provided.length === expected.length && timingSafeEqual(provided, expected);   ← callback signature hash
src/lib/payments/bkash/webhook-verifier.ts:78:  return timingSafeEqual(ha, hb);                                                  ← SNS TopicArn
```

The booking-token HMAC comparison (also `timingSafeEqual`) lives in the shared `src/lib/payments/shared/hs256.ts:35`.

```
$ grep -rn "id_token\|idToken" src/ | grep -v "token-manager.ts"
src/lib/payments/bkash/schemas.ts:60:  id_token: z.string().min(20),                     ← Zod shape of bKash's grant response (validated, then only token-manager.ts reads it)
src/lib/payments/bkash/__tests__/fake-bkash.ts:95:  … id_token: token …                         ← the in-memory bKash's grant response
```

---

## 6. Limitations and things not verified

Stated plainly so the owner can decide what matters before merging.

1. **No real bKash webhook has been received.**
   - The SNS verifier follows AWS's published algorithm and is tested with real RSA signatures, but bKash has not yet published to our endpoint.
   - The webhook message schema is `.strict()` over the fields bKash documents. If production messages carry an undocumented field, they will be refused with 400 and SNS will retry. Payments still settle through the callback and the reconciliation cron.
   - **Watch the first production webhooks** (`WEBHOOK_REJECTED` with `MESSAGE_SCHEMA`).
2. **One full successful sandbox payment in the walkthrough**, plus one during the API probe; the sandbox then refused PINs (§3). The execute-timeout, lost-response and double-success-callback cases can't be forced in the sandbox; they are covered by automated tests against the fake bKash.
3. **Refund window default of 7 days is an assumption.** bKash's docs state that a limit exists but not its value. Confirm it with the merchant agreement and set it in owner settings.
4. **Emails were exercised in mock mode only** (no `RESEND_API_KEY`); templates are tested for escaping and both languages.
5. **REVIEW_REQUIRED has no in-app resolve action.** An OWNER confirms the booking with the normal status control, or refunds from the bKash merchant portal. The in-app refund dialog accepts only SUCCESS and PARTIALLY_REFUNDED payments.
6. **Legacy sessions are retired at deploy.** Any bKash payment still `INITIATED` when the migration runs becomes `SUPERSEDED`. A guest mid-checkout at that moment starts again; nobody is charged, because bKash only captures on our execute call.
7. **`pnpm build` runs `prisma migrate deploy` against the `.env` database.** In this session that applied the bKash migrations to `resort_dev`, which had no bKash rows, so nothing was retired.
8. **Build warning (pre-existing):** Next.js 16 deprecates `middleware.ts` in favour of `proxy.ts`. It is shared admin auth code, left alone per the brief's scope rule.
9. **Nagad and SSLCommerz have no automated tests** to re-run (§2).
10. **Inventory is unchanged.** The bKash execute path still does not decrement `Room.availableUnits`, as before. This is the known cross-gateway inventory issue (BanglaQR review A4).
11. **Per-IP limits depend on the proxy setting `X-Real-IP`** (see DEPLOYMENT.md). Each PM2 worker holds its own grant token, which bKash allows.
12. **Two-person refund approval and password re-entry are not in v1** (D9). OWNER + 2FA, the retyped amount, rate limits, the append-only ledger and the owner email are the controls.
13. **Test-DB artefacts.** Walkthrough users `bkash-{owner,manager,staff}@walkthrough.test` remain in `resort_banglaqr_test`; the OWNER now has TOTP enabled. The sandbox credentials and walkthrough secrets lived only in the scratchpad, never in the repo.
14. **Adjacent findings** A1–A8 in the security review are documented, not fixed. The most relevant to bKash:
    - **A1:** the confirmation page shows full guest PII by booking UUID.
    - **A8:** the generic admin actions return a 403 as an error object rather than an HTTP 403.

---

## 7. Commits on `hardening/bkash`

```
611db47 docs(bkash): section 0 security review and gap analysis
7c580d4 feat(bkash): section 1 authentication, authorization and the hardened payment core
4f23b74 test(bkash): section 2 strict input validation and response schemas
7ad60e3 fix(bkash): section 3 token cache security
6259978 fix(bkash): section 4 redirect flow security
c58599d test(bkash): section 5 amount, invoice and payer-reference validation
e37e825 fix(bkash): section 6 idempotency and race conditions
491fd6b feat(bkash): section 7 refund flow and owner refund dialog
7e04b10 test(bkash): section 8 cryptographic correctness
1cab8a0 test(bkash): section 9 rate limiting
d2db394 test(bkash): section 10 audit logging
a554fdd test(bkash): section 11 error handling
717a994 feat(bkash): section 12 failure modes and reconciliation cron
6d4e15c test(bkash): section 13 guest and admin notifications
88745a4 refactor(bkash): section 14 developer conventions
682b862 feat(bkash): owner settings form for bKash limits (decision D8)
c990f49 docs(bkash): section 15 documentation for the hardened integration
e39e612 test(bkash): refund action enforces reason length and typed amount
```

Section 1 carries most of the implementation, because authentication, the execute state machine and the webhook verifier couldn't be separated cleanly. Sections 2–14 add each section's remaining behaviour and its tests. Each commit message says which.

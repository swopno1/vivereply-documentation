# BanglaQR Hardening: Verification Report

| | |
|---|---|
| **Date** | 2026-09-29 |
| **Branch** | `hardening/banglaqr` — merged to `main` (confirmed via `docs/release/00-MAIN-VERIFICATION.md`, 2026-10-09) |
| **Environment** | macOS, Node 24, Postgres 16 (local), Next.js 16.3.5 dev and production builds |
| **Databases** | Automated and manual tests ran against `resort_banglaqr_test`, an isolated database. The dev database `resort_dev` received only the schema migrations and one trigger self-test row (see Limitations). |

This report replaces the previous verification report. That report claimed 17/17 passing and cited a webhook-idempotency test that did not exist. Everything below was produced in this session and is pasted from command output. Anything not run is marked **NOT RUN**, with the reason.

## Summary

| Area | Result |
|---|---|
| DB-backed BanglaQR test suites (`pnpm test:banglaqr:db`) | **96 / 96 passed** (11 files) |
| Full unit suite (`pnpm test`, no test DB) | **140 passed**, 53 skipped (the DB suites are reported as skipped when no test DB is configured), 0 failed |
| `pnpm lint` (ESLint + guard checks + money check) | **Passed, 0 warnings** |
| `pnpm build` | **Passed** (compiled, type-checked, 80 static pages) |
| Manual walkthrough (browser + raw HTTP) | 10 of 10 steps run; results below. One UI bug found and fixed (Confirm label clipped) |
| Security greps (§15.3) | Pass |
| R2 bucket permission inspection | **NOT RUN**: the Cloudflare connectors in this session are not authorised, and no receipts bucket exists yet (owner decision D6) |

---

## 15.1 Automated tests

Commands:

```bash
DATABASE_URL_TEST=postgresql://…/resort_banglaqr_test pnpm test:banglaqr:db
# verbose listing below: same command with vitest --reporter=verbose
pnpm test
```

### Required cases → test that proves it

| Requirement | Test(s) | Result |
|---|---|---|
| HMAC rejects invalid signatures: empty, malformed, wrong length, correct length but wrong value | `crypto.test.ts` › *rejects empty, null and undefined*, *rejects malformed…*, *rejects the wrong length…*, *rejects the correct length but wrong value*, *fails closed when the secret is unset or too short* | ✅ |
| Rate limits trigger at the correct threshold | `rate-limiter.test.ts` › *allows exactly `limit` requests, then 429s…*, *atomic under concurrency: 20 parallel … admit exactly 5*; `routes.test.ts` › *the 61st request in a minute … 429* | ✅ |
| Upload rejects wrong magic bytes | `file-security.test.ts` › *rejects a text file renamed to .jpg*, *PNG whose declared type or extension says JPEG*; `routes.test.ts` › *.txt renamed .jpg … 415* | ✅ |
| Upload rejects oversized files | `file-security.test.ts` › *rejects oversized files before decoding*; `routes.test.ts` › *10 MB upload … 413 before the body is parsed* | ✅ |
| Upload rejects duplicate hashes | `validation.test.ts` › *the same receipt image can't be used on another booking*; `routes.test.ts` › *same receipt submitted again … 409* | ✅ |
| Duplicate transaction IDs rejected | `validation.test.ts` › *a transaction ID can't be reused on another booking, even after the first was rejected* | ✅ |
| Concurrent confirmations: only one succeeds | `concurrency.test.ts` › *concurrent admin confirmations: exactly one succeeds…*, *confirm racing reject* | ✅ |
| Webhook idempotency: same webhook twice = one fulfilment | `concurrency.test.ts` › *the same webhook twice fulfils once*, *5 parallel deliveries fulfil once*; `routes.test.ts` › *webhook: valid signature confirms, replay is a 200 no-op…* | ✅ |
| Amount mismatch returns the correct error | `validation.test.ts` › *amount mismatch returns AMOUNT_MISMATCH naming the booking total*, *webhook amount mismatch: rejected…* | ✅ |
| Booking token expiry | `crypto.test.ts` › *rejects an expired token* (fake clock: valid at 29:59, rejected at 30:00) | ✅ |
| Role enforcement: STAFF cannot confirm, MANAGER can | `roles.test.ts` › *STAFF cannot confirm: 403, payment untouched, attempt audited*, *MANAGER can confirm* | ✅ |

### Raw output: DB-backed suites (verbose)

```text
 ✓ src/lib/payments/banglaqr/routes.test.ts > BanglaQR HTTP routes > happy path: token, then multipart receipt, returns only a reference
 ✓ src/lib/payments/banglaqr/routes.test.ts > BanglaQR HTTP routes > no token: 401 with code and reference, nothing stored
 ✓ src/lib/payments/banglaqr/routes.test.ts > BanglaQR HTTP routes > a .txt renamed .jpg is rejected with 415 INVALID_FILE_TYPE
 ✓ src/lib/payments/banglaqr/routes.test.ts > BanglaQR HTTP routes > a 10 MB upload is rejected with 413 before the body is parsed
 ✓ src/lib/payments/banglaqr/routes.test.ts > BanglaQR HTTP routes > the same receipt submitted again is rejected with 409
 ✓ src/lib/payments/banglaqr/routes.test.ts > BanglaQR HTTP routes > unknown form fields (e.g. a smuggled bookingId) are rejected
 ✓ src/lib/payments/banglaqr/routes.test.ts > BanglaQR HTTP routes > storage outage: friendly 503 with Retry-After, no internals, booking still PENDING, failure audited
 ✓ src/lib/payments/banglaqr/routes.test.ts > BanglaQR HTTP routes > webhook: valid signature confirms, replay is a 200 no-op, bad signature is 400 + audited
 ✓ src/lib/payments/banglaqr/routes.test.ts > BanglaQR HTTP routes > the generic payment webhook router refuses BanglaQR even with a valid signature (review H1)
 ✓ src/lib/payments/banglaqr/routes.test.ts > BanglaQR HTTP routes > webhook rate limit: the 61st request in a minute from one IP gets 429 with Retry-After
 ✓ src/lib/payments/banglaqr/routes.test.ts > database outage maps to 503 + Retry-After: 30 without Prisma details
 ✓ src/lib/payments/banglaqr/routes.test.ts > unexpected errors map to a generic 500 without the message or stack
 ✓ src/lib/payments/banglaqr/routes.test.ts > guest-facing messages exist in English and Bangla for every error code
 ✓ src/lib/payments/banglaqr/concurrency.test.ts > BanglaQR idempotency and race conditions > concurrent admin confirmations: exactly one succeeds, the room unit is held once
 ✓ src/lib/payments/banglaqr/concurrency.test.ts > BanglaQR idempotency and race conditions > confirm racing reject: exactly one decision wins
 ✓ src/lib/payments/banglaqr/concurrency.test.ts > BanglaQR idempotency and race conditions > concurrent receipt uploads for one booking: exactly one is accepted
 ✓ src/lib/payments/banglaqr/concurrency.test.ts > BanglaQR idempotency and race conditions > a receipt can't be resubmitted after confirmation to revert the booking (review C2)
 ✓ src/lib/payments/banglaqr/concurrency.test.ts > BanglaQR idempotency and race conditions > webhook idempotency: the same webhook twice fulfils once
 ✓ src/lib/payments/banglaqr/concurrency.test.ts > BanglaQR idempotency and race conditions > webhook idempotency under concurrency: 5 parallel deliveries fulfil once
 ✓ src/lib/payments/banglaqr/concurrency.test.ts > BanglaQR idempotency and race conditions > webhook for a new transaction on an already-confirmed booking changes nothing
 ✓ src/lib/payments/banglaqr/concurrency.test.ts > BanglaQR idempotency and race conditions > auto-release expires only unpaid attempts past the window, and is idempotent
 ✓ src/lib/payments/banglaqr/concurrency.test.ts > BanglaQR idempotency and race conditions > release loses cleanly to a confirmation that got there first
 ✓ src/lib/payments/banglaqr/validation.test.ts > transaction ID handling > normalises case, whitespace and hyphens before any comparison
 ✓ src/lib/payments/banglaqr/validation.test.ts > transaction ID handling > classifies known provider formats and flags the rest
 ✓ src/lib/payments/banglaqr/validation.test.ts > transaction ID handling > masks all but the first and last two characters
 ✓ src/lib/payments/banglaqr/validation.test.ts > request schemas > rejects unknown fields everywhere (.strict)
 ✓ src/lib/payments/banglaqr/validation.test.ts > request schemas > parses taka to integer poisha without floating point
 ✓ src/lib/payments/banglaqr/validation.test.ts > request schemas > requires a transaction ID of 6-64 letters/digits after normalisation
 ✓ src/lib/payments/banglaqr/validation.test.ts > request schemas > rejects a paidAt in the future
 ✓ src/lib/payments/banglaqr/validation.test.ts > amount and transaction validation (DB) > amount mismatch returns AMOUNT_MISMATCH naming the booking total
 ✓ src/lib/payments/banglaqr/validation.test.ts > amount and transaction validation (DB) > the owner amount cap blocks token issuance and submission
 ✓ src/lib/payments/banglaqr/validation.test.ts > amount and transaction validation (DB) > the same receipt image can't be used on another booking
 ✓ src/lib/payments/banglaqr/validation.test.ts > amount and transaction validation (DB) > a transaction ID can't be reused on another booking, even after the first was rejected
 ✓ src/lib/payments/banglaqr/validation.test.ts > amount and transaction validation (DB) > webhook amount mismatch: rejected, nothing fulfilled, both values audited
 ✓ src/lib/payments/banglaqr/validation.test.ts > amount and transaction validation (DB) > the transaction ID stored for a static receipt is normalised and classified
 ✓ src/lib/payments/banglaqr/notifications.test.ts > BanglaQR notifications > receipt submitted: guest confirmation of receipt and an admin alert
 ✓ src/lib/payments/banglaqr/notifications.test.ts > BanglaQR notifications > no admin address configured: admin alerts are skipped, guest mail still goes
 ✓ src/lib/payments/banglaqr/notifications.test.ts > BanglaQR notifications > re-upload: the emailed link carries a single-use token that works exactly once
 ✓ src/lib/payments/banglaqr/notifications.test.ts > BanglaQR notifications > rejection emails the guest the reason
 ✓ src/lib/payments/banglaqr/notifications.test.ts > BanglaQR notifications > verification SLA: overdue receipts are escalated once, never twice
 ✓ src/lib/payments/banglaqr/notifications.test.ts > BanglaQR notifications > bad webhook signatures alert the owner, throttled to one email per 10 minutes
 ✓ src/lib/payments/banglaqr/notifications.test.ts > BanglaQR notifications > a bank SUCCESS for a booking that can no longer take it alerts the owner (money may have arrived)
 ✓ src/lib/payments/banglaqr/notifications.test.ts > email templates > HTML-escapes admin-typed reasons and puts the re-upload token only in the URL fragment
 ✓ src/lib/payments/banglaqr/retention.test.ts > BanglaQR receipt retention and access > purges images 90 days after check-out and keeps the payment record
 ✓ src/lib/payments/banglaqr/retention.test.ts > BanglaQR receipt retention and access > never purges a receipt still awaiting verification
 ✓ src/lib/payments/banglaqr/retention.test.ts > BanglaQR receipt retention and access > owner deletion removes the image, keeps the record, and requires a decided payment
 ✓ src/lib/payments/banglaqr/retention.test.ts > BanglaQR receipt retention and access > each signed receipt URL is audited with the requesting admin
 ✓ src/lib/payments/banglaqr/resilience.test.ts > acquiring bank calls: timeout, retry, validation > times out a hanging bank and retries exactly once
 ✓ src/lib/payments/banglaqr/resilience.test.ts > acquiring bank calls: timeout, retry, validation > recovers when the retry succeeds
 ✓ src/lib/payments/banglaqr/resilience.test.ts > acquiring bank calls: timeout, retry, validation > does not retry a request the bank rejected (4xx-style error)
 ✓ src/lib/payments/banglaqr/resilience.test.ts > acquiring bank calls: timeout, retry, validation > rejects a malformed bank response (missing QR image) instead of showing it
 ✓ src/lib/payments/banglaqr/resilience.test.ts > failure modes (DB) > dynamic QR failure falls back to static and the guest can still upload a receipt
 ✓ src/lib/payments/banglaqr/resilience.test.ts > failure modes (DB) > an owner can confirm a late-paid, already expired booking without a receipt; it is audited as an override
 ✓ src/lib/payments/banglaqr/resilience.test.ts > failure modes (DB) > a normal confirmation is still refused for a booking with no receipt
 ✓ src/lib/payments/banglaqr/resilience.test.ts > failure modes (DB) > cron heartbeat: stale until a successful run; the stale alert is claimed once under concurrency
 ✓ src/lib/payments/banglaqr/file-security.test.ts > validateMagicBytes > recognises JPEG, PNG and WebP by content
 ✓ src/lib/payments/banglaqr/file-security.test.ts > validateMagicBytes > rejects text, GIF, PDF and truncated headers
 ✓ src/lib/payments/banglaqr/file-security.test.ts > inspectReceiptImage > accepts a valid receipt and hashes the original bytes
 ✓ src/lib/payments/banglaqr/file-security.test.ts > inspectReceiptImage > accepts .jpeg and image/jpg aliases for JPEG
 ✓ src/lib/payments/banglaqr/file-security.test.ts > inspectReceiptImage > rejects a text file renamed to .jpg
 ✓ src/lib/payments/banglaqr/file-security.test.ts > inspectReceiptImage > rejects a PNG whose declared type or extension says JPEG
 ✓ src/lib/payments/banglaqr/file-security.test.ts > inspectReceiptImage > rejects oversized files before decoding
 ✓ src/lib/payments/banglaqr/file-security.test.ts > inspectReceiptImage > rejects images below 200x200 and above 4000x4000
 ✓ src/lib/payments/banglaqr/file-security.test.ts > inspectReceiptImage > rejects a decompression bomb (tiny file, huge canvas)
 ✓ src/lib/payments/banglaqr/file-security.test.ts > inspectReceiptImage > rejects a truncated image that only has a valid header
 ✓ src/lib/payments/banglaqr/file-security.test.ts > inspectReceiptImage > strips EXIF metadata from the stored image
 ✓ src/lib/payments/banglaqr/file-security.test.ts > inspectReceiptImage > drops data appended after the image (polyglot payloads)
 ✓ src/lib/payments/banglaqr/file-security.test.ts > scanReceiptForMalware (stub) > rejects empty input and passes everything else until a scanner is integrated
 ✓ src/lib/payments/banglaqr/audit.test.ts > BanglaQR audit trail > is append-only at the database level (UPDATE, DELETE, TRUNCATE all refused)
 ✓ src/lib/payments/banglaqr/audit.test.ts > BanglaQR audit trail > records the full static flow with required fields and nothing secret
 ✓ src/lib/payments/banglaqr/audit.test.ts > BanglaQR audit trail > an invalid webhook signature is audited with source IP and body hash, never the signature
 ✓ src/lib/payments/banglaqr/roles.test.ts > BanglaQR role enforcement > STAFF cannot confirm: 403, payment untouched, attempt audited
 ✓ src/lib/payments/banglaqr/roles.test.ts > BanglaQR role enforcement > MANAGER can confirm
 ✓ src/lib/payments/banglaqr/roles.test.ts > BanglaQR role enforcement > anonymous callers are redirected to login
 ✓ src/lib/payments/banglaqr/roles.test.ts > BanglaQR role enforcement > settings are OWNER-only, and an OWNER without 2FA is sent to set it up
 ✓ src/lib/payments/banglaqr/roles.test.ts > BanglaQR role enforcement > invalid input to an action returns a coded failure with a reference, not an exception
 ✓ src/lib/payments/banglaqr/rate-limiter.test.ts > BanglaQR rate limiter (Postgres-backed) > allows exactly `limit` requests, then 429s with a Retry-After inside the window
 ✓ src/lib/payments/banglaqr/rate-limiter.test.ts > BanglaQR rate limiter (Postgres-backed) > keys are independent (one booking's limit does not affect another)
 ✓ src/lib/payments/banglaqr/rate-limiter.test.ts > BanglaQR rate limiter (Postgres-backed) > is atomic under concurrency: 20 parallel requests against a limit of 5 admit exactly 5
 ✓ src/lib/payments/banglaqr/rate-limiter.test.ts > BanglaQR rate limiter (Postgres-backed) > writes a RATE_LIMIT_HIT audit row with IP and user agent
 ✓ src/lib/payments/banglaqr/crypto.test.ts > webhook HMAC verification > accepts the correct signature (case-insensitive hex, surrounding whitespace)
 ✓ src/lib/payments/banglaqr/crypto.test.ts > webhook HMAC verification > rejects empty, null and undefined signatures
 ✓ src/lib/payments/banglaqr/crypto.test.ts > webhook HMAC verification > rejects malformed signatures without comparing
 ✓ src/lib/payments/banglaqr/crypto.test.ts > webhook HMAC verification > rejects the wrong length (truncated or extended)
 ✓ src/lib/payments/banglaqr/crypto.test.ts > webhook HMAC verification > rejects the correct length but wrong value
 ✓ src/lib/payments/banglaqr/crypto.test.ts > webhook HMAC verification > fails closed when the secret is unset or too short
 ✓ src/lib/payments/banglaqr/crypto.test.ts > booking payment tokens > round-trips booking ID, purpose and expiry
 ✓ src/lib/payments/banglaqr/crypto.test.ts > booking payment tokens > rejects an expired token
 ✓ src/lib/payments/banglaqr/crypto.test.ts > booking payment tokens > rejects a token used for the wrong purpose
 ✓ src/lib/payments/banglaqr/crypto.test.ts > booking payment tokens > rejects a tampered payload (booking swapped) and a forged signature
 ✓ src/lib/payments/banglaqr/crypto.test.ts > booking payment tokens > rejects garbage, empty and oversized tokens
 ✓ src/lib/payments/banglaqr/crypto.test.ts > booking payment tokens > has no fallback secret: unset or short secret throws METHOD_UNAVAILABLE
 ✓ src/lib/payments/banglaqr/crypto.test.ts > booking payment tokens > a token signed under one secret is rejected after the secret changes
 ✓ src/lib/payments/banglaqr/crypto.test.ts > cron authorization (shared helper stays backward compatible) > accepts the bearer header and, by default, the query secret
 ✓ src/lib/payments/banglaqr/crypto.test.ts > cron authorization (shared helper stays backward compatible) > header-only mode refuses the query secret
 ✓ src/lib/payments/banglaqr/crypto.test.ts > cron authorization (shared helper stays backward compatible) > rejects wrong secrets and fails closed without CRON_SECRET
 Test Files  11 passed (11)
      Tests  96 passed (96)
   Duration  6.68s (transform 670ms, setup 0ms, import 1.74s, tests 4.02s, environment 1ms)
```

### Raw output: `pnpm test` (no test database configured)

```text
 Test Files  13 passed | 6 skipped (19)
      Tests  140 passed | 53 skipped (193)
   Duration  1.91s (transform 3.03s, setup 0ms, import 7.05s, tests 1.70s, environment 2ms)
```

The 53 skipped tests are the DB-backed BanglaQR suites. They are marked skipped, not passed, when `DATABASE_URL` doesn't name a `*_test` database, so the summary count shows they didn't run. (The explanatory console warning in `__tests__/db.ts` is not shown by Vitest's default reporter.) One skip predates this work.

**Other gateways.** The brief asks for bKash, Nagad and SSLCommerz tests to be run after any shared-helper change. The repo contains **no test files for those gateways**. Shared code touched in this phase:

- `cron-auth.ts`: backward-compatible, covered by `crypto.test.ts`.
- `availability.ts`: the BanglaQR line only.
- The BanglaQR registry adapter.
- `admin-actions.ts`: BanglaQR actions moved out; the `updateBookingStatus` guard applies only to bookings with BanglaQR payments.

All of these are covered by the full suite above, which passes.

---

## 15.2 Manual tests

The app ran on `localhost:3000` (dev server, then a production build) against the test database, with:

- test-only secrets
- `BANGLAQR_ACQUIRING_BANK=sandbox`
- no `RESEND_API_KEY`, so emails are logged as mock sends
- no receipts bucket, so receipts went to the git-ignored `.data/` fallback

A browser (Playwright/Chromium) was driven at **360 px** width for guest screens. Screenshots are in [`docs/verification/banglaqr/`](verification/banglaqr/).

| # | Step | Result | Evidence |
|---|---|---|---|
| 1 | Submit a valid receipt from the booking stepper; admin queue updates | ✅ Booking `RES-749560` → `PENDING_MANUAL_VERIFICATION`, payment `PENDING_VERIFICATION`, claimed ৳25,000, TrxID format BKASH. Queue shows it with a badge. Stored image has **no EXIF** (the uploaded one did). | `01-guest-panel-360px.png`, `02-receipt-submitted-confirmation-360px.png`, `06-manager-queue.png`, DB output A |
| 2 | Submit the same receipt again | ✅ HTTP 409 `RECEIPT_ALREADY_SUBMITTED` | curl output B |
| 3 | `.txt` renamed to `.jpg` | ✅ HTTP 415, guest sees "Please upload a JPEG, PNG, or WebP image." plus a reference; audited as `RECEIPT_SUBMISSION_REJECTED` | `03-txt-renamed-jpg-rejected.png`, DB output A |
| 4 | 10 MB file | ✅ Browser pre-check shows "Your receipt is too large. Maximum size is 5 MB." (no upload made). Sent directly to the server, it gets HTTP **413** `FILE_TOO_LARGE` before parsing. | `04-10mb-rejected.png`, curl output B |
| 5 | STAFF attempts to confirm → 403 | ⚠️ **Partial.** STAFF doesn't see the queue in navigation; opening it renders **"403 - Access Denied"** with no queue data in the HTML. The Server Action refuses with a real 403 and writes an `ADMIN_ACTION_DENIED` audit row (`roles.test.ts`). **But the page's HTTP status is 200**, in both dev and production builds, because the admin section streams (Adjacent Finding A6, app-wide). | `05-staff-forbidden-403.png`, curl output E |
| 6 | MANAGER confirms → booking confirmed and email sent | ✅ `CONFIRMED` / `SUCCESS`, note recorded; `ADMIN_RECEIPT_URL_ISSUED` and `ADMIN_CONFIRMED` audit rows; mock confirmation email logged. The receipt opened through a signed link: tampered or expired signature → 404. | `07-receipt-signed-url-viewer.png`, `08-manager-confirmed.png`, DB output C |
| 7 | Trigger the cron manually → expired bookings released | ✅ `?secret=` refused (401). Header run: released 1 (an unpaid booking 90 min old) and emailed the guest. A **paid booking backdated 10 h stayed in `PENDING_MANUAL_VERIFICATION`** (D1). Second run released 0. Heartbeat recorded. | curl/DB output D |
| 8 | Webhook with a valid signature → booking confirmed | ✅ HTTP 200 `applied:true`; booking `CONFIRMED`; room units 5 → 4 | curl output F |
| 9 | Same webhook again → no double fulfilment | ✅ HTTP 200 `duplicate:true`; still 1 SUCCESS payment and units 4 | curl output F |
| 10 | Invalid signature → 400 + audit entry | ✅ HTTP 400; `WEBHOOK_SIGNATURE_INVALID` with reason and body SHA-256 (the signature itself is not stored). Missing signature: same. The signed body sent to the generic `/api/webhooks/payment` router is refused (400). | curl output F |

Extra checks during the walkthrough:

- **Mobile.** The admin queue at 360 px has no horizontal overflow (`scrollWidth` 345 ≤ viewport 360), and every button is at least 44 px tall (`09-manager-queue-360px.png`).
- **Bug found and fixed.** The desktop queue clipped the "Confirm payment" label because the buttons shared one row. The button now has a minimum width and the row wraps (fixed in this commit; `06-manager-queue.png` shows the fix).

### Raw evidence

**A. After the guest walkthrough (DB and audit trail, test DB):**
```text
{"booking":"RES-749560","status":"PENDING_MANUAL_VERIFICATION","payment":{"status":"PENDING_VERIFICATION","claimed":2500000,"trx":"9J2831KL90","format":"BKASH","key":"receipts/30737fb0-59b0-446f-8b2c-33eeb6b8e22c/21887214994871c31683eca67a1aca2a67480269610dffecabe98c44d2eedd01.png","hash":"218872149948"}}
uploaded exif present: true | stored exif present: false
PAYMENT_TOKEN_ISSUED {"tokenId":"715ea067d219ada2d8149aaff0b192b9","expiresAt":"2026-09-29T15:32:27.702Z"}
PAYMENT_TOKEN_ISSUED {"tokenId":"a9eaf1ad2fd49b81a18f1060fc10ced6","expiresAt":"2026-09-29T15:32:27.712Z"}
RECEIPT_SUBMISSION_REJECTED {"code":"INVALID_FILE_TYPE","reason":"Magic bytes are not JPEG, PNG or WebP","fileHash":null,"transactionId":"9J******90"}
RECEIPT_SUBMITTED {"width":420,"height":720,"purpose":"pay","fileHash":"21887214994871c31683eca67a1aca2a67480269610dffecabe98c44d2eedd01","transactionId":"9J******90","amountPaidPoisha":2500000,"transactionIdFormat":"BKASH"}
{"ts":"2026-09-29T15:03:29.205Z","level":"info","component":"banglaqr","event":"email_mock","correlationId":null,"to":"guest@banglaqr.test","subject":"We received your payment receipt (RES-749560) | আপনার পেমেন্ট রিসিট পেয়েছি (RES-749560)"}
```
Two tokens were issued because React Strict Mode runs effects twice in development. Issuance is idempotent (same attempt row).

**B. Raw HTTP: duplicate, oversize, no token:**
```text
## Same receipt again:
{"error":"We already have a receipt for this booking. Our team is reviewing it. Reference: BR-2026-09-29-5a3978.","code":"RECEIPT_ALREADY_SUBMITTED","reference":"BR-2026-09-29-5a3978"}
HTTP 409
## 10 MB upload:
{"error":"Your receipt is too large. Maximum size is 5 MB. Reference: BR-2026-09-29-5cfd63.","code":"FILE_TOO_LARGE","reference":"BR-2026-09-29-5cfd63"}
HTTP 413
## No token:
{"error":"Your payment session has expired. Please reload the page and try again. Reference: BR-2026-09-29-bbbcf6.","code":"UNAUTHORIZED","reference":"BR-2026-09-29-bbbcf6"}
HTTP 401
```

**C. After MANAGER confirmation:**
```text
{"status":"CONFIRMED","payment":"SUCCESS","verifiedBy":"pLDBsQ0T…","note":"Matched settlement statement line (verification walkthrough)"}
ADMIN_RECEIPT_URL_ISSUED MANAGER {"ttlSeconds":300}
ADMIN_CONFIRMED MANAGER {"note":"Matched settlement statement line (verification walkthrough)","adminRole":"MANAGER","newStatus":"CONFIRMED","amountPoisha":2500000,"transactionId":"9J******90","previousStatus":"PENDING_MANUAL_VERIFICATION","transactionIdFormat":"BKASH"}
queue views audited: 2
[Mock Resend Email] Sent confirmation email to guest@banglaqr.test for booking RES-749560
```
Signed receipt link checks, from the MANAGER's browser session:
```json
{ "valid": 200, "tamperedSignature": 404, "expiredLink": 404, "contentType": "image/png", "cacheControl": "private, no-store" }
```

**D. Cron:**
```text
## Query-string secret (refused):
{"error":"Unauthorized"}
HTTP 401
## Header, run 1:
{"success":true,"released":1,"escalated":0,"failed":0,"reference":"BR-2026-09-29-a5e59e"}
HTTP 200
## Header, run 2 (idempotent):
{"success":true,"released":0,"escalated":0,"failed":0,"reference":"BR-2026-09-29-01dadb"}
HTTP 200
unpaid, 90 min old => EXPIRED / EXPIRED
receipt submitted, 10 h old => PENDING_MANUAL_VERIFICATION / PENDING_VERIFICATION
AUTO_RELEASED rows: 1
VERIFICATION_ESCALATED rows for paid: 0
heartbeat lastSuccessAt set: true
{"ts":"2026-09-29T15:06:46.623Z","level":"info","component":"banglaqr","event":"email_mock","correlationId":null,"to":"guest-867f3b3f6657@example.com","subject":"Your payment window expired (TST-867F3B3F6657) | আপনার পেমেন্টের সময় শেষ (TST-867F3B3F6657)"}
```
The paid booking was not escalated because the SLA is measured from **receipt submission**, which was recent. Only the booking creation time was backdated. Escalation itself is covered by `notifications.test.ts`.

**E. STAFF access in the production build (`pnpm build && pnpm start`):**
```text
sign-in 200
STAFF GET /admin/payments/banglaqr-verification (production): HTTP 200
   1 403 - Access Denied
anonymous GET queue: HTTP 307 -> http://localhost:3000/admin/login?redirect=%2Fadmin%2Fpayments%2Fbanglaqr-verification
```

**F. Webhooks (HMAC computed with `openssl dgst -sha256 -hmac`):**
```text
## valid signature:
{"received":true,"applied":true,"reference":"BR-2026-09-29-9d107b"}
HTTP 200
## same webhook again:
{"received":true,"duplicate":true,"reference":"BR-2026-09-29-70b918"}
HTTP 200
## invalid signature:
{"error":"Webhook rejected","reference":"BR-2026-09-29-5c1acc"}
HTTP 400
## missing signature:
{"error":"Webhook rejected","reference":"BR-2026-09-29-8a7fd2"}
HTTP 400
## same signed body via generic router with provider=BANGLAQR:
{"error":"Invalid payload or verification failed"}
HTTP 400
booking CONFIRMED | SUCCESS payments: 1 | room units 5 -> 4
WEBHOOK_PROCESSED ::1 {"transactionId":"WA********01","newBookingStatus":"CONFIRMED","newPaymentStatus":"SUCCESS"}
WEBHOOK_DUPLICATE ::1 {"reference":"BQR-FEA5579C531C8371","transactionId":"WA********01"}
WEBHOOK_SIGNATURE_INVALID ::1 {"bank":"sandbox","reason":"mismatch","bodyBytes":105,"bodySha256":"233c5ae0cbdb07fea1a9690b83979fd4dfb62e67bebbdf4629e8c0c5ee7c5416"}
WEBHOOK_SIGNATURE_INVALID ::1 {"bank":"sandbox","reason":"missing","bodyBytes":105,"bodySha256":"233c5ae0cbdb07fea1a9690b83979fd4dfb62e67bebbdf4629e8c0c5ee7c5416"}
```

---

## 15.3 Security verification

**`grep -rn "BANGLAQR_WEBHOOK_SECRET" src/`**: production code reads only `process.env`. There are no fallbacks; the remaining hits are tests and an error-message string.
```text
src/lib/payments/banglaqr/routes.test.ts:162:    const sig = createHmac("sha256", process.env.BANGLAQR_WEBHOOK_SECRET as string).update(rawBody).digest("hex");
src/lib/payments/banglaqr/routes.test.ts:187:    const sig = createHmac("sha256", process.env.BANGLAQR_WEBHOOK_SECRET as string).update(rawBody).digest("hex");
src/lib/payments/banglaqr/config.ts:37:  const webhookSecret = process.env.BANGLAQR_WEBHOOK_SECRET;
src/lib/payments/banglaqr/config.ts:41:      : { configured: false, missing: [`BANGLAQR_WEBHOOK_SECRET (min ${BANGLAQR_MIN_SECRET_LENGTH} chars)`] };
src/lib/payments/banglaqr/crypto.test.ts:16:  vi.stubEnv("BANGLAQR_WEBHOOK_SECRET", WEBHOOK_SECRET);
src/lib/payments/banglaqr/crypto.test.ts:56:    vi.stubEnv("BANGLAQR_WEBHOOK_SECRET", "");
src/lib/payments/banglaqr/crypto.test.ts:58:    vi.stubEnv("BANGLAQR_WEBHOOK_SECRET", "short");
src/lib/payments/banglaqr/webhook-verifier.ts:23:  const secret = process.env.BANGLAQR_WEBHOOK_SECRET;
src/lib/payments/banglaqr/__tests__/harness.ts:67:  const signature = createHmac("sha256", process.env.BANGLAQR_WEBHOOK_SECRET as string).update(rawBody).digest("hex");
```

**`grep -rn "timingSafeEqual" src/lib/payments/banglaqr/`**: every secret comparison (webhook HMAC, booking token, dev receipt-URL signature) uses it after a length check:
```text
src/lib/payments/banglaqr/token.ts:1:import { createHmac, randomBytes, timingSafeEqual } from "crypto";
src/lib/payments/banglaqr/token.ts:102:  // Length is checked first because timingSafeEqual throws on unequal lengths;
src/lib/payments/banglaqr/token.ts:104:  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;
src/lib/payments/banglaqr/receipt-storage.ts:1:import { createHmac, timingSafeEqual } from "crypto";
src/lib/payments/banglaqr/receipt-storage.ts:65:  return provided.length === expected.length && timingSafeEqual(provided, expected);
src/lib/payments/banglaqr/webhook-verifier.ts:1:import { createHmac, timingSafeEqual } from "crypto";
src/lib/payments/banglaqr/webhook-verifier.ts:15: * - Comparison uses crypto.timingSafeEqual on the decoded bytes. `===` or
src/lib/payments/banglaqr/webhook-verifier.ts:19: *   comparison (timingSafeEqual throws on unequal lengths, and the expected
src/lib/payments/banglaqr/webhook-verifier.ts:34:  return timingSafeEqual(provided, expected) ? "valid" : "mismatch";
```

**Network tab during receipt submission** (Playwright request log for `/api/payments/banglaqr/*`):
```text
40. [POST] /api/payments/banglaqr/token => [200]
41. [POST] /api/payments/banglaqr/token => [200]
44. [POST] /api/payments/banglaqr/submit-receipt => [415]
45. [POST] /api/payments/banglaqr/submit-receipt => [200]
```

**Response bodies:**

- **Token:** `{"token":"eyJ…","expiresAt":"…","mode":"static"}`.
- **Successful submit:** `{"success":true,"reference":"BR-2026-09-29-bb0ba1"}`.
- **Absent from both:** payment IDs, receipt URLs or keys, amounts, stack traces and secrets.

**What the browser does hold:** the short-lived booking token. It is the guest's own bearer credential, so this is by design: it is sent only in the `x-banglaqr-token` header, never in a URL, and expires within 30 minutes or at the end of the payment window. Its payload contains the booking UUID, which is already in the booking URL.

**R2 bucket permissions: NOT RUN.** No receipts bucket exists yet (D6), and the Cloudflare MCP connectors are not authorised in this session. When the bucket is created, check that:

1. no public `r2.dev` URL or custom domain is attached;
2. the API token is scoped to that bucket only;
3. an unsigned GET of a receipt key returns 403.

---

## 15.4 Build and lint

**`pnpm lint`** (exit 0; ESLint printed nothing, so zero warnings):
```text
$ eslint . && pnpm check:guards && pnpm check:money
$ bash scripts/check-admin-api-guards.sh && bash scripts/check-admin-actions-guards.sh && bash scripts/check-admin-actions-guards.sh src/app/actions/banglaqr-actions.ts && for f in src/app/actions/blog/*.ts; do bash scripts/check-admin-actions-guards.sh "$f" || exit 1; done
✓ All admin, cron and webhook route handlers are guarded
✓ Every exported Server Action in src/app/actions/admin-actions.ts calls a guard
✓ Every exported Server Action in src/app/actions/banglaqr-actions.ts calls a guard
✓ Every exported Server Action in src/app/actions/blog/moderation.ts calls a guard
✓ Every exported Server Action in src/app/actions/blog/posts.ts calls a guard
✓ Every exported Server Action in src/app/actions/blog/settings.ts calls a guard
✓ Every exported Server Action in src/app/actions/blog/taxonomy.ts calls a guard
$ bash scripts/check-no-float-money.sh
✓ No legacy Float money field names outside src/lib/money-legacy.ts
```

**`pnpm build`** (exit 0; excerpt; no warnings in the log):
```text
✓ Compiled successfully in 6.5s
  Running TypeScript ...
  Finished TypeScript in 15.3s ...
  Collecting page data using 7 workers ...
  Generating static pages using 7 workers (0/80) ...
  Generating static pages using 7 workers (20/80) 
  Generating static pages using 7 workers (40/80) 
  Generating static pages using 7 workers (60/80) 
✓ Generating static pages using 7 workers (80/80) in 1092ms
```

---

## Limitations (honest list)

1. **Dynamic QR is not integrated with any real bank.** Readiness keeps it disabled (D2). The webhook path is verified end to end only against the local sandbox adapter. Real bank payload shapes, signature headers and QR rendering must be implemented and re-verified when a bank spec is available.
2. **Receipt bucket permissions unverified** (15.3). The production code fails closed if the bucket isn't configured, but whether the bucket is actually private must be checked in Cloudflare.
3. **Malware scanning is a stub.** The mitigation is that stored bytes are a `sharp` re-encode; a real scanner (ClamAV, Cloudflare, or a third party) is still a TODO.
4. **Emails were verified in mock mode only.** Templates, recipients and triggers are tested; actual Resend delivery was not exercised.
5. **403 status for underprivileged page views is 200** because of app-wide streaming (Adjacent Finding A6). The UI and Server Actions deny correctly.
6. **The stale-cron alert depends on admin traffic.** A stopped cron can't report itself; the check runs when an admin opens the queue.
7. **Duplicate-receipt detection is exact-bytes.** A cropped or re-encoded copy of the same screenshot is not detected automatically. The transaction-ID uniqueness rules and the admin's statement check are the controls there.
8. **Transaction-ID provider patterns are heuristics**, not published formats. An unrecognised ID is accepted with a warning badge, not rejected.
9. **The client IP relies on the reverse proxy** setting `X-Real-IP` (documented in `DEPLOYMENT.md`). Without it, all guests share one per-IP bucket.
10. **The legacy receipt migration script was only dry-run** (0 legacy receipts in the dev DB). Run it against client databases before relying on the public bucket being clean.
11. **An undeletable row in the dev DB.** While verifying the audit trigger during Section 1, one `TRIGGER_SELFTEST` row was written to `resort_dev.PaymentAuditLog`. By design, the trigger prevents deleting it for 2 years. It is harmless, but it will appear in dev audit queries.
12. **Pre-existing `AuditLog` rows** written by the old BanglaQR code stay in `AuditLog`; all new BanglaQR events go to `PaymentAuditLog`.
13. **Room inventory** still uses the template-wide unit counter, which is not date-aware (Adjacent Finding A4). BanglaQR now decrements it safely, but the model itself is unchanged.

## Commits on `hardening/banglaqr`

```text
6f20d83 docs(banglaqr): section 14 documentation for the hardened integration
d394e1f refactor(banglaqr): section 13 developer conventions
30b93a2 feat(banglaqr): section 12 guest and admin notifications
edd068d feat(banglaqr): section 11 failure modes and resilience
225dbc5 test(banglaqr): section 10 error handling end to end
7a9acd6 feat(banglaqr): section 9 PII protection and data retention
be97bb3 feat(banglaqr): section 8 audit logging
07966b6 feat(banglaqr): section 7 amount and transaction validation in the admin queue
708b140 fix(banglaqr): section 6 idempotency and race conditions
566c9ae feat(banglaqr): section 5 database-backed rate limiting
4a0def1 fix(banglaqr): section 4 cryptographic correctness
1940a7c test(banglaqr): section 3 file upload security
0b29171 feat(banglaqr): section 2 input validation and owner amount cap
fcd065b feat(banglaqr): section 1 authentication and authorization
f51aef7 docs(banglaqr): security review and gap analysis from code audit
(this report)  docs(banglaqr): section 15 verification report with raw evidence
```

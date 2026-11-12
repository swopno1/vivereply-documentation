# SSLCommerz Security Review — Discovery & Gap Analysis

| | |
|---|---|
| **Date** | 2026-09-30 |
| **Branch** | `hardening/sslcommerz` (from `main` @ `8567ccb`, which includes the hardened BanglaQR, bKash and Nagad work) |
| **Scope** | Every SSLCommerz route, library module and adapter; the guest button and the admin refund UI; and the shared code SSLCommerz depends on: the generic webhook router, the shared refund route, `updateBooking`, `cancelBookingWithRefundDecision`, availability and the confirmation page |
| **Method** | A line-by-line read of the code, not the docs. Every claim about SSLCommerz's behaviour was checked against the **live public sandbox** (`sandbox.sslcommerz.com`, demo store `testbox`) on 2026-09-30, and against the official PHP and Python SDKs. Raw responses are in [0.8](#08-live-sandbox-probe) |
| **Status** | **Approved 2026-09-30** (D1–D14 as recommended). Implemented in Sections 1–16 on `hardening/sslcommerz`; see the [verification report](PAYMENTS-SSLCOMMERZ-VERIFICATION.md) and [PAYMENTS-SSLCOMMERZ.md](PAYMENTS-SSLCOMMERZ.md) |

## Summary

The SSLCommerz integration is **not production-safe**. Its IPN path has also **never been able to accept a genuine notification**.

There are six Critical findings.

1. **One real payment can confirm any number of bookings, including refunded or cancelled ones.**
   - `validatePayment()` looks up the booking by the `tran_id` **the caller supplies**. It never checks that the Validator's `tran_id` matches it (`validate-payment.ts:51`).
   - Idempotency is scoped to one booking (`:114`), and the booking's status is never checked (`:145`).
   - So a guest who has paid once can POST their own `val_id` to `/api/payments/sslcommerz/success`, along with the `tran_id` of any other booking with the same total. That booking becomes `CONFIRMED`.
   - The sandbox shows a `val_id` still validates (`VALIDATED`) after a refund, so the same POST also re-confirms a booking whose payment was refunded and cancelled.
2. **The store password leaks into error messages that reach MANAGERs, the database and the server logs.**
   - `sslcommerzFetch` throws `SSLCommerz API call to ${endpoint} failed with status …` (`client.ts:95`). For the Validator and refund calls, `endpoint` contains `store_passwd=…` (`validate-payment.ts:43`, `refund.ts:72`, `test-connection/route.ts:33`).
   - That message is returned as JSON by `test-connection` (MANAGER) and the refund route. It is written to `PaymentLog.responsePayload`, and printed by `console.error` in the success route.
   - A non-2xx answer from SSLCommerz is enough to trigger it. We received HTTP 500 from its query API during this review.
3. **The IPN hash check is wrong, so every genuine IPN is rejected.**
   - SSLCommerz sorts `store_passwd` **into** the key list. Our code appends it **last** (`ipn-verifier.ts:39-56`).
   - All 4 genuinely signed messages captured from the sandbox fail our check, and pass the official algorithm (see [0.4](#04-hash-verification-review)).
   - The result: the IPN answers 401 to SSLCommerz every time, and the only path to fulfilment is the guest's browser.
   - **The brief's §5.1 sketch is also wrong.** It joins values without keys and drops empty ones, and it fails on all 4 as well.
4. **A payment whose browser redirect never arrives is never fulfilled, and there is no reconciliation.**
   - With the IPN dead (C3) and no cron, a guest who pays and closes the tab stays `PENDING` forever.
   - This happened during the probe. A sandbox bKash (MFS) payment reached `VALID` at SSLCommerz, but its success redirect never reached us.
5. **Cancelled, expired and already-paid bookings can be paid again, and one booking can be charged twice.**
   - `initiateSession` refuses only `CONFIRMED`, `CHECKED_IN` and `COMPLETED`, and only looks at SSLCommerz payments (`initiate-session.ts:35-48`).
   - `tran_id` is the booking code (`:64`), and the sandbox **accepts a new session with the `tran_id` of a transaction that is already paid**.
   - The check-then-create has no database guard, so two concurrent clicks open two sessions.
6. **Anyone can reveal a real booking's ID, which unlocks its guest's personal details, with one unauthenticated GET.**
   - `GET /api/payments/sslcommerz/fail` (or `/cancel`) with no parameters runs `prisma.booking.findFirst({ where: undefined })`, which returns the first booking in the table (`fail/route.ts:30`, `cancel/route.ts:28`).
   - It flips that booking's open SSLCommerz payment to `FAILED`, then redirects to `/book/{roomId}?bookingId={id}`.
   - That ID opens `/booking/confirmation/{id}`, which shows the guest's name, phone and email with no check (adjacent finding A6, still open).

Three more findings change the design the brief assumes. See [Decisions](#decisions-needed-before-section-1).

- **The store password must travel in a URL for two of the four APIs.** The Validator accepts POST, and we'll use POST. The transaction-query and refund APIs answer POST with an HTTP 500 SOAP fault and work only with GET. So §1.1's "never in a URL query string" can't be met for them. Server-to-server only, and never logged, is what's achievable (D2).
- **`verify_sign` proves the content, not the sender.** Every success, fail and cancel redirect carries a valid `verify_sign`, and each one passes **through the guest's browser**. A hash-valid body therefore proves only that nobody changed it. It doesn't prove it came from SSLCommerz, or that this is the first time we've seen it. Replay protection has to come from `val_id` uniqueness and the state machine (D1, D4).
- **SSLCommerz reports risky payments as `VALID`.** A sandbox payment marked "Success with risk" arrives as `status=VALID, risk_level=1, risk_title="Not Safe"`, and the current code confirms it (D5).

Totals: **6 Critical, 13 High, 11 Medium, 6 Low** (36 gaps). There are also 7 adjacent findings in shared or other-gateway code.

Legend for all tables: ✅ Mitigated · ⚠️ Partial · ❌ Unmitigated

---

## 0.1 Endpoint Inventory

```
$ find src/app/api -type d -name "*sslcommerz*"
src/app/api/payments/sslcommerz            (create, success, fail, cancel, ipn)
src/app/api/admin/payments/sslcommerz      (test-connection)
src/app/api/webhooks/payment/sslcommerz

$ find src/app/api -path "*sslcommerz*" -name "route.ts"
src/app/api/webhooks/payment/sslcommerz/route.ts
src/app/api/admin/payments/sslcommerz/test-connection/route.ts
src/app/api/payments/sslcommerz/{cancel,success,ipn,fail,create}/route.ts

$ find src/lib/payments/sslcommerz -type f  (+ the barrel one level up)
adapter.ts (78)  client.ts (100)  index.ts (6)  initiate-session.ts (150)
ipn-verifier.ts (74)  refund.ts (146)  validate-payment.ts (191)  ../sslcommerz.ts (1)   = 746 lines
```

The brief's names map as follows:
- `/initiate` is `/create` today.
- There is **no** `/api/admin/payments/sslcommerz/refund`. SSLCommerz refunds go through the shared `POST /api/admin/payments/refund`.

### E1. `POST /api/payments/sslcommerz/create`

| Property | Current state |
|---|---|
| Purpose | Opens a hosted-checkout session for a booking |
| Auth | **None.** It takes a raw `bookingId` from the JSON body, with no token binding it to the guest who made the booking |
| Rate limit | Counts `PaymentLog` `SESSION_INITIATED` rows per booking (5 per hour). Failed attempts aren't counted, and there's no per-IP limit. The count and the insert race |
| Validation | Manual: `if (!bookingId)`. No schema; any JSON shape is accepted |
| Output | `{ success, sessionkey, gatewayPageURL }`. **The session key reaches the browser.** Errors return `err.message` verbatim: SSLCommerz's `failedreason` (e.g. "Store Credential Error Or Store is De-active"), the missing env var names from `assertPaymentProviderAvailable`, and the internal endpoint path from `sslcommerzFetch` |
| Errors | Always HTTP 500, including "booking not found" and "already paid" |
| Idempotent | No. A check-then-create with no DB constraint; two concurrent calls open two sessions (C5) |

### E2. `GET|POST /api/payments/sslcommerz/success`

| Property | Current state |
|---|---|
| Purpose | Browser return after payment (SSLCommerz form-POSTs the signed result here) |
| Auth | None, and no hash check, although SSLCommerz signs this body (0.8, capture #2) |
| Rate limit | None |
| Validation | None. Reads `val_id`, `tran_id` and `bank_tran_id` from the body or the query string; also accepts JSON and GET |
| Trust | Calls the Validator (good), but binds the result to the **caller's** `tran_id` (C1). If `tran_id` is missing, it looks up the booking by `payments.some.paymentId = val_id` |
| Output | A 307 redirect. **307 makes the browser re-POST the signed body**, including `card_no`, `card_issuer` and `verify_sign`, to `/booking/confirmation/{id}` (M8) |
| Errors | `console.error(err)` prints the error, whose message contains `store_passwd` (C2) |
| Idempotent | Only on the same booking and the same `bank_tran_id`. Not across bookings, and not under concurrency (H4) |

### E3. `GET|POST /api/payments/sslcommerz/fail` and E4. `/cancel`

| Property | Current state |
|---|---|
| Purpose | Browser return after a failed or cancelled payment |
| Auth / hash | None. Both bodies are signed by SSLCommerz (captures #4 and #6), but nothing checks them |
| Rate limit | None |
| Validation | None. `tran_id` from the body or the query string. **With no `tran_id`, it acts on the first booking in the table** (C6) |
| State change | **Sets the open SSLCommerz payment to `FAILED` or `CANCELLED` on the redirect's word** (H6). Anyone who knows a booking code can do it with one GET |
| Output | A 307 redirect to `/book/{roomId}?bookingId={id}`, which exposes the booking's internal ID |
| Logging | Writes the **whole unverified body** to `PaymentLog` |
| Idempotent | Yes, in effect: a second call finds no `INITIATED` row |

### E5. `GET|POST /api/payments/sslcommerz/ipn`

| Property | Current state |
|---|---|
| Purpose | Server-to-server notification; the reliable path |
| Auth | Hash check, but **wrong** (C3), not constant-time, and computed against `""` when `SSL_STORE_PASSWORD` is unset (H2) |
| Order of checks | Looks the booking up **before** checking the hash. That gives a 404/401 oracle on booking codes (M5) |
| Rate limit | None |
| Validation | Presence of `val_id` and `tran_id` only. Also accepts JSON and GET |
| Output | JSON. On a Validator error it returns `{ error: errorMsg }` with HTTP 500, and the message can contain `store_passwd` (C2) |
| Idempotent | `isValIdAlreadyProcessed` runs a `LIKE '%val_id%'` scan over `PaymentLog`. It isn't unique, isn't atomic, and misses a success recorded under another event name |

### E6. `POST /api/webhooks/payment/sslcommerz` and `POST /api/webhooks/payment` (generic router)

The SSLCommerz route re-exports the generic router. With `{"provider":"SSLCOMMERZ", …}`, `SSLCommerzAdapter.verifyWebhook` runs the (broken) hash check, then `validatePayment`. Then the router:
- inserts **another** `SUCCESS` payment row;
- decrements `room.availableUnits`;
- sends another confirmation email on every call.

A non-success cancels the booking. Today only the C3 hash bug blocks it. **Once the hash is fixed, a guest can replay their own signed success body** (which passed through their browser) to this route indefinitely (H1). SSLCommerz never calls this route; its IPN goes to `/api/payments/sslcommerz/ipn`.

### E7. `POST /api/admin/payments/sslcommerz/test-connection`

| Property | Current state |
|---|---|
| Auth | `requireRole("MANAGER")`, inside `try` (the brief requires OWNER) |
| Rate limit | None |
| Probe | Calls the Validator with `val_id=handshake_test`. It "detects" bad credentials by looking for `"store"` in `res.error`, but **SSLCommerz never puts that there**. Wrong credentials return `status: INVALID_TRANSACTION, APIConnect: "FAILED"` (0.8 E and F). **The test reports success with any password** (H10) |
| Output | The **full `storeId`**. On failure, the error message, which can contain `store_passwd` (C2) |

### E8. `POST /api/admin/payments/refund` (shared)

| Property | Current state |
|---|---|
| Auth | `requireRole("OWNER")`, inside `try`; no MFA |
| Validation | `paymentId` presence. `amountPoisha` through `AmountSchema`. `reason` optional, defaulting to "Admin initiated refund" |
| Flow | Calls `refundSSLCommerz` (C2 leak path). No idempotency key, no ledger, and no ceiling beyond ৳500,000 |
| Output | Raw `err.message` |

### E9. Internal functions and server actions that touch SSLCommerz

| Function | Finding |
|---|---|
| `validatePayment` (`validate-payment.ts:35`) | The only fulfilment path. C1, H3 (no currency/store/risk checks), H4 (race), M7 (stores the raw Validator body, including `card_no`, `card_ref_id` and `token_key`) |
| `refundPayment` (`refund.ts:24`) | H8: treats "initiated" as refunded, marks a partial refund `REFUNDED`, cancels the booking, and measures the 7-day window from `updatedAt` |
| `updateBooking` (`admin-actions.ts:414`, MANAGER) | Guards bKash and Nagad payments, but lets a MANAGER set **any** status on an SSLCommerz payment (H12) |
| `cancelBookingWithRefundDecision` (`admin-actions.ts:588`, MANAGER) | For a booking with an SSLCommerz `SUCCESS` payment, "refund: yes" writes "Refund recorded" and calls no gateway (H12) |
| `BookingDetailView.tsx:849` | OWNER refund UI: full refund only, no amount retype, no MFA |

---

## 0.2 Credential Handling Review

| Question | Finding |
|---|---|
| Where are `SSL_STORE_ID` and `SSL_STORE_PASSWORD` read? | `process.env` only, in `getSSLCommerzConfig()` (`client.ts:16-17`) and `getSSLCommerzReadiness()` (`:43-44`). Never from a file or the DB ✅ |
| Is the password logged, returned or exposed? | **Yes, indirectly** (C2). `sslcommerzFetch` puts the whole endpoint, including `store_passwd`, into its thrown error (`client.ts:95`). That error reaches `test-connection` JSON (MANAGER), the refund route JSON, `PaymentLog.responsePayload` (`REFUND_ERROR`, `IPN_VALIDATION_ERROR`, `SESSION_INIT_ERROR`), the IPN HTTP response, and `console.error` in `success/route.ts:82`. The init path masks it correctly (`initiate-session.ts:84-85`) |
| Is it in a URL? | **Yes, in three places**: Validator (`validate-payment.ts:43`), refund (`refund.ts:72`) and test-connection (`:33`). All are server-to-server GETs, so it never appears in browser history or `Referer`. It **does** appear in any outbound proxy or egress log. The sandbox confirms the Validator accepts POST, so one of the three can move to a body. The refund and transaction-query APIs are GET-only (D2) |
| Does the code pass `store_passwd` as a query parameter? | Yes (above). It isn't passed to the browser anywhere |
| Does test-connection mask the store ID? | **No.** It returns the full `storeId` (`test-connection/route.ts:49`) |
| Fallback credentials? | None ✅. `assertSSLCommerzConfigured()` refuses an empty ID or password on init and refund. **But** `verifyIPNSignature` and `validatePayment` don't call it (H2) |
| Environment | `SSL_BASE_URL` defaults to **sandbox**, and is any URL at all (H9). `SSL_IS_SANDBOX` is independent of the URL, so test-connection can say "Production" while calling the sandbox. Production with sandbox `testbox` credentials would accept test cards (`4111…`) and confirm real bookings |

`grep` evidence (brief §1.1):
```
$ grep -rn "SSL_STORE_PASSWORD\|store_passwd\|store_password\|storePassword" src/ | grep -v "process.env"
test-connection/route.ts:30   comment
test-connection/route.ts:33   store_passwd=${encodeURIComponent(config.storePassword)}   ← in URL, and in thrown errors (C2)
ipn-verifier.ts:48-49         md5(storePassword) for the hash
initiate-session.ts:61        form body (correct: POST body)
initiate-session.ts:85        mask for logging (correct)
refund.ts:72                  store_passwd=… in URL (C2)
validate-payment.ts:43        store_passwd=… in URL (C2)
client.ts:6,32                config field
```

---

## 0.3 Callback Flow Review

| Callback | Current behaviour | Verdict |
|---|---|---|
| `success_url` | Calls the Validator before fulfilling (good). But: it binds to the caller's `tran_id` (C1); doesn't check the booking's state (C1); has no hash check even though the body is signed (H5); no currency, store or risk check (H3); no concurrency claim (H4); redirects with 307 (M8) | ❌ An attacker can confirm bookings with one real `val_id` |
| `fail_url` | Trusts the redirect and writes `FAILED`. **Acts on an arbitrary booking when `tran_id` is missing** (C6) | ❌ |
| `cancel_url` | Same as fail, writing `CANCELLED` | ❌ |
| `ipn_url` | Hash check (wrong, C3), then a duplicate scan, then `validatePayment` (same C1/H3/H4 gaps). Returns JSON | ❌ Never succeeds for a genuine IPN. If the hash were right, it would share C1 |

**What SSLCommerz actually sends** (sandbox, captured 2026-09-30):
- **Encoding.** All three browser returns are `POST application/x-www-form-urlencoded`, not GET.
- **Signing.** All three are **signed** with `verify_sign` and `verify_key`.
- **Signed success fields.** The success `verify_key` covers 27 fields, including `amount`, `currency`, `status`, `store_id`, `tran_id`, `val_id`, `risk_level` and `bank_tran_id`.
- **Fail and cancel bodies.** These have no `val_id`, and their `verify_key` doesn't cover `store_amount`, `risk_*` or `val_id`.
- **The IPN.** It has the same shape as the success POST (per the SDKs and the docs). The public sandbox can't deliver it to `localhost`, so it was **not observed** (D10).

---

## 0.4 Hash Verification Review

| Question | Finding |
|---|---|
| Is a hash computed? | Yes (`ipn-verifier.ts:25-60`). Used by the IPN route and the adapter only |
| Algorithm | MD5, as SSLCommerz specifies ✅. The body also carries `verify_sign_sha2` (below) |
| Field order | **Wrong.** The code sorts the `verify_key` fields, then appends `store_passwd` last, because `Map` keeps insertion order. SSLCommerz `ksort`s **after** adding `store_passwd`, so it sits between `store_id` and `tran_date` |
| Empty fields | The code keeps them (correct: PHP's `isset("")` is true) |
| Comparison | `===` after `toLowerCase()`. **Not constant-time** |
| Missing `verify_sign` / `verify_key` | Returns `false` ✅ |
| Missing password | Not checked. It hashes with `md5("")`, a value anyone can compute (H2) |
| Fields we rely on | `verify_key` is attacker-supplied. Nothing requires it to cover `tran_id`, `val_id`, `amount`, `currency`, `status` or `store_id` (M1) |

**The authoritative algorithm** (official PHP SDK `SSLCOMMERZ_hash_verify`, identical in the Python SDK's `hash_validate_ipn`):

```
new_data = { k: post[k] for k in split(post.verify_key, ",") if k is present in post }   // empty strings included
new_data["store_passwd"] = md5(store_password)
ksort(new_data)                                                                            // store_passwd sorted IN
hash_string = join("&", [k + "=" + v for (k, v) in new_data])
valid = md5(hash_string) == post.verify_sign
```

**Checked against 4 genuine signed bodies** from the sandbox (store password `qwerty`). Script: [Evidence](#evidence-commands-re-runnable).

| Candidate | success (card) | fail | cancel | success (net banking, risk) |
|---|---|---|---|---|
| Official SDK algorithm | ✅ match | ✅ | ✅ | ✅ |
| **Current repo code** (`store_passwd` appended last) | ❌ | ❌ | ❌ | ❌ |
| **Brief §5.1 sketch** (values only, empties dropped, password appended) | ❌ | ❌ | ❌ | ❌ |
| Official, but empty fields dropped | ❌ | ❌ | ❌ | ❌ |
| Official with a wrong password | ❌ | ❌ | ❌ | ❌ |

**`verify_sign_sha2`.** SSLCommerz also sends a SHA-256 signature. It reproduces as `sha256(same sorted string, with store_passwd = sha256(password))` (✅ on capture #2). It is **not** in the SDKs, and it's undocumented. It is an optional extra (D1), and MD5 remains the required check, per §5.1 and §19.

**What MD5 protects, and what it doesn't (brief §5.5).**
- **It stops** anyone who doesn't know the store password from altering a signed field, or inventing a signed body. MD5's collision weakness would let someone craft two different inputs with the same hash. It doesn't let them forge a signature for content they choose without the secret, and that is the property this check relies on.
- **It doesn't stop** anyone who has the store password: they can sign anything, and the password must then be rotated in the SSLCommerz merchant panel.
- **It doesn't stop replay.** The redirect bodies pass through the guest's browser, so a guest can resend their own genuine signed body. Freshness and one-time use come from `val_id` uniqueness and the payment state machine, never from the hash.
- **It never confirms a payment on its own.** Fulfilment still requires the Validator, called server-side with our credentials.

---

## 0.5 Data Flow & Trust Boundaries

```mermaid
sequenceDiagram
  autonumber
  participant G as Guest browser
  participant S as Our server
  participant P as SSLCommerz (sandbox/securepay)
  G->>S: POST /create {bookingId}             %% TB1: raw ID, no token
  S->>P: POST /gwprocess/v4/api.php (store_id, store_passwd, tran_id=bookingCode, amount, urls, cus_*)   %% TB2
  P-->>S: {status, sessionkey, GatewayPageURL}
  S-->>G: {sessionkey, gatewayPageURL}        %% session key leaves the server
  G->>P: hosted checkout; guest picks card / MFS / net banking   %% card data only ever on P
  P-->>G: auto-submitting form
  G->>S: POST success|fail|cancel (signed body)   %% TB3: browser-carried, replayable
  P->>S: POST ipn (signed body)               %% TB4: server-to-server, retried
  S->>P: GET validationserverAPI.php?val_id&store_id&store_passwd   %% TB5: the only authority
  P-->>S: {status VALID|VALIDATED|…, tran_id, amount, currency, risk_level, …}
  S->>S: confirm booking                      %% TB6: DB state
```

| Boundary | Data crossing it | Current trust |
|---|---|---|
| TB1 Guest → `/create` | `bookingId` | Fully trusted; no token |
| TB2 Server → SSLCommerz init | Credentials, amount, guest PII | TLS, but the host isn't pinned (any `SSL_BASE_URL`), no timeout, redirects are followed |
| TB3 Browser → success/fail/cancel | Signed form body | Not hash-checked. `tran_id` is trusted to choose the booking (C1, C6) |
| TB4 SSLCommerz → IPN | Signed form body | Hash-checked with the wrong algorithm (C3) |
| TB5 Server → Validator | `val_id` plus credentials in the URL | Response trusted without a schema. `tran_id`, currency and store aren't compared |
| TB6 Admin → refund / payment edit / cancel | `paymentId`, amount, status | OWNER refund route (no MFA), and **MANAGER bypasses** through `updateBooking` and `cancelBookingWithRefundDecision` (H12) |

---

## 0.6 Threat Model

| # | Threat | Status | Evidence / what's missing |
|---|---|---|---|
| T1 | Forged success redirect with a fabricated `val_id` | ⚠️ Partial | The Validator returns `INVALID_TRANSACTION` for an unknown `val_id` (0.8 D), so a fabricated one fails. But a **real `val_id` from another booking** succeeds (C1) |
| T2 | Replay of a legitimate success URL with a different `tran_id` | ❌ | Exactly C1: `validatePayment` never compares the Validator's `tran_id` with the booking |
| T3 | Success endpoint called directly with a booking but no `val_id` | ✅ | Redirects with `missing_val_id`; nothing changes (`success/route.ts:31`) |
| T4 | IPN with a tampered amount and a reused `verify_sign` | ✅ by accident | The hash covers `amount`, so tampering fails. But today *every* IPN fails (C3) |
| T5 | IPN with no `verify_sign` | ✅ | `verifyIPNSignature` returns false. But the booking lookup happens first (M5) |
| T6 | IPN before the success redirect, or after the fail redirect | ❌ | Fail sets the attempt `FAILED` on the redirect's word (H6). A later genuine success then *creates* a second payment row (`validate-payment.ts:131`) instead of settling the attempt |
| T7 | IPN delivered twice | ⚠️ | A `LIKE` scan on `PaymentLog`: not atomic, not unique (H4) |
| T8 | Success and IPN concurrently | ❌ | Both read `INITIATED` and both write; `BookingLog` duplicates; with no `INITIATED` row, both *create* `SUCCESS` rows. No claim, no unique `val_id`/`bank_tran_id` (H4) |
| T9 | Two bookings raced through one SSLCommerz session | ❌ | Same as C1: one captured `val_id` is accepted for any `tran_id` supplied |
| T10 | Amount changed between initiate and validate | ⚠️ | The Validator amount is compared with `booking.totalAmountPoisha` at validation time (good), but a total an admin **edits after capture** is silently compared against the new total. The payment then shows "failed" and the guest's money is stranded, with no review path (H7) |
| T11 | `tran_id` collision or reuse across bookings | ❌ | `tran_id = bookingCode` on every attempt. The sandbox accepted a **new session for an already-paid `tran_id`** (0.8 L), and a query by `tran_id` then returns 2 transactions (0.8 S3) (C5, H11) |
| T12 | Refund abused by a compromised MANAGER session | ⚠️ | The refund route is OWNER-only, but a MANAGER can set an SSLCommerz payment to `REFUNDED` in `updateBooking`, or "record" a refund in `cancelBookingWithRefundDecision` (H12). No MFA on the OWNER path |
| T13 | Store password leaked through logs, referrers or errors | ❌ | C2 (errors, DB, console). Not referrers: the password is never in a browser URL ✅ |
| T14 | Card data exposure | ✅ with one caveat | Hosted checkout only (`GatewayPageURL`); no card fields are posted by us; `grep card_no\|cvv\|card_expiry` finds only a response type field. SSLCommerz returns a **truncated PAN** (`450850******4050`), `card_ref_id` and a `token_key`. These are stored raw in `Payment.rawWebhookPayload` and `PaymentLog` (M7). Truncated PANs are allowed to be stored under PCI DSS, but we don't need them |
| T15 | IPN made to fail validation but still processed | ✅ | A failed hash returns 401 before any processing. A Validator failure returns 500 without changing state |
| T16 | Risky payment auto-confirmed (**new**) | ❌ | `risk_level=1` ("Not Safe") arrives with `status=VALID` (0.8, captures #2 and #8), and nothing reads `risk_level` (H3) |
| T17 | Sandbox credentials in production (**new**) | ❌ | Defaults to the sandbox host; `testbox` isn't refused (H9) |
| T18 | Replay of a signed body to the generic router (**new**) | ❌ once C3 is fixed | E6 / H1 |
| T19 | Enumerating booking IDs and PII through fail/cancel (**new**) | ❌ | C6 |

---

## 0.7 Test Coverage Gap

```
$ find src/lib/payments/sslcommerz src/app/api/payments/sslcommerz -name "*.test.ts" | wc -l
0
bkash: 15 files (157 tests)   nagad: 15 files (255 tests)   banglaqr: 11 files (96 tests)
```

The bKash report's "SSLCommerz has no automated tests" is **confirmed**. Compared with bKash, there are no tests for:
- crypto (hash) and validation;
- auth (token), redirect and concurrency;
- amounts and reconciliation;
- audit, rate limits and errors;
- resilience, notifications, refunds and settings.

There is also no fake SSLCommerz, and no environment fixture. The captured sandbox bodies in 0.8 give us **genuine** signed vectors to test the hash against, which the Nagad suite never had.

---

## 0.8 Live Sandbox Probe

All probes ran on 2026-09-30 against `https://sandbox.sslcommerz.com` with SSLCommerz's **public demo store** (`store_id=testbox`, `store_passwd=qwerty`, published in its developer docs). No team credentials were used. Callbacks went to a local capture server (`http://localhost:3199/…`). The IPN could not be delivered (SSLCommerz can't reach `localhost`).

### Session initiation

```
$ curl -X POST https://sandbox.sslcommerz.com/gwprocess/v4/api.php \
    -d store_id=testbox -d store_passwd=qwerty -d total_amount=100 -d currency=BDT -d tran_id=PROBE-1790761672 \
    -d success_url=… -d fail_url=… -d cancel_url=… -d ipn_url=… -d cus_name=Test … -d shipping_method=NO
HTTP/1.1 200 OK   Content-Type: application/json
{"status":"SUCCESS","failedreason":"","sessionkey":"D2721E349B73573459293994E1536B9A",
 "gw":{"visa":"dbbl_visa,brac_visa,…","mobilebanking":"dbblmobilebanking,bkash,nagad,…",…},
 "redirectGatewayURL":"https://sandbox.sslcommerz.com/gwprocess/v4/bankgw/indexhtmlOTP.php?…",
 "GatewayPageURL":"https://sandbox.sslcommerz.com/EasyCheckOut/testcded2721e349b73573459293994e1536b9a",
 "storeBanner":"…","storeLogo":"…","store_name":"Demo","ip_address":"103.231.163.109","desc":[…]}

# L. same tran_id as an already-PAID transaction → accepted
SUCCESS  sessionkey=C817DAEA1A8C3ABAFC5C568A6A9E3941
# M. total_amount=5 (docs say minimum 10.00) → SUCCESS      N. total_amount=500000.01 → SUCCESS
#    (the sandbox doesn't enforce the documented 10–500,000 BDT range; we must)
# O. wrong store_passwd
{"status":"FAILED","failedreason":"Store Credential Error Or Store is De-active","sessionkey":"",…}
# P. tran_id of 48 characters → SUCCESS
```

### The four callbacks (captured request bodies, abridged; all `POST`, `application/x-www-form-urlencoded`)

```
#2 POST /success  (card, "Success")
tran_id=PROBE-C1-1790761690  val_id=260930154854czCjijkUrgnn3mR  amount=1250.50  card_type=VISA-Dutch Bangla
store_amount=1219.24  card_no=450850******4050  bank_tran_id=260930154854I2RQNLFHIGDsNIg  status=VALID
tran_date=2026-09-30 15:48:11  error=  currency=BDT  card_issuer=…  card_brand=VISA  card_sub_brand=Classic
card_issuer_country=Spain  card_issuer_country_code=ES  store_id=testbox
verify_sign=c7562cb2eae50249536d9d3c8e2a88e1
verify_key=amount,bank_tran_id,base_fair,card_brand,card_issuer,card_issuer_country,card_issuer_country_code,card_no,
           card_sub_brand,card_type,currency,currency_amount,currency_rate,currency_type,error,risk_level,risk_title,
           status,store_amount,store_id,tran_date,tran_id,val_id,value_a,value_b,value_c,value_d
verify_sign_sha2=de4c16f2aa8c9ef70817e3714b6a45d42e7c3753a763f88b5123a2db7a3b4ce4
currency_type=BDT currency_amount=1250.50 currency_rate=1.0000 base_fair=0.00 value_a=probe_a value_b= value_c= value_d=
subscription_id=  risk_level=1  risk_title=Not Safe

#4 POST /fail     tran_id=PROBE-F1-1790761824 amount=500.00 status=FAILED error=Issuer Bank Declined
                  bank_tran_id=260930155040gTAo0w1ayvoECAg verify_sign=1223b5da6b83ab8253ca0fc61691cd4e (no val_id)
#6 POST /cancel   tran_id=PROBE-X1-1790761824 amount=500.00 status=CANCELLED error=Cancelled by User
                  verify_sign=fb17f334917cb12bd8aff2fbcdbd51e0 (no val_id)
#8 POST /success  (net banking City Touch, "Success with risk")
                  tran_id=PROBE-R1-1790761824 val_id=2609301551550xoU9Xee3V2pDnL status=VALID risk_level=1
                  risk_title=Not Safe card_type=CITYBANKIB-City Bank verify_sign=47b215c088d330cf3e006b30c8120bcc
(MFS bKash, "Success": no redirect captured; the session query shows it VALID, risk_level=0.
 I navigated away about 1 s after paying, which probably interrupted the redirect. It is still
 the lost-callback case the reconciliation cron has to handle.)
```

### Validator API

```
# A. GET, first call
{"status":"VALID","tran_date":"2026-09-30 15:48:11","tran_id":"PROBE-C1-1790761690","val_id":"260930154854czCjijkUrgnn3mR",
 "amount":"1250.50","store_amount":"1219.24","currency":"BDT","bank_tran_id":"260930154854I2RQNLFHIGDsNIg",
 "card_type":"VISA-Dutch Bangla","card_no":"450850******4050",…,"currency_type":"BDT","currency_amount":"1250.50",
 "currency_rate":"1.0000",…,"risk_title":"Not Safe","risk_level":"1",…,"APIConnect":"DONE",
 "validated_on":"2026-09-30 15:49:39","gw_version":"",…,"card_ref_id":"dc1d…","token_key":"5p4w…","isTokeizeSuccess":0,…}
# B. GET, second call → "status":"VALIDATED" (all else identical)
# C. POST body (val_id, store_id, store_passwd, v=1, format=json) → "status":"VALIDATED"   ← POST works
# D. unknown val_id, correct credentials → {"status":"INVALID_TRANSACTION",…,"APIConnect":"DONE",…}   HTTP 200
# E. real val_id, WRONG password       → {"status":"INVALID_TRANSACTION",…,"APIConnect":"FAILED",…} HTTP 200
# F. unknown store, wrong password     → {"status":"INVALID_TRANSACTION",…,"APIConnect":"FAILED",…} HTTP 200
# S4. after a refund was initiated     → "status":"VALIDATED"   ← a refunded payment still validates
```

So:
- Credentials are verified by `APIConnect == "DONE"`, never by `error`.
- Errors come back as HTTP 200.
- `VALID` means first validation and `VALIDATED` means a repeat. Both mean "paid", and neither means "not refunded".

### Transaction query API (`merchantTransIDvalidationAPI.php`)

```
# G–K. POST (any parameters) → HTTP 500, SOAP-ENV:Fault body   ← GET-only
# GET tran_id=<paid>    → {"APIConnect":"DONE","no_of_trans_found":1,"element":[{"val_id":"…","status":"VALIDATED",…,"risk_level":"1",…}]}
# GET tran_id=<unpaid>  → {"APIConnect":"DONE","no_of_trans_found":1,"element":[{"val_id":"","status":"PROCESSING",…}]}
# GET sessionkey=<paid>   → {"status":"VALID","sessionkey":"D96B…","tran_id":"PROBE-C1-…","val_id":"…","amount":"1250.50",…}
# GET sessionkey=<unpaid> → {"status":"PENDING","sessionkey":"D272…","tran_id":"PROBE-1790761672","val_id":"",…}
# GET tran_id=<unknown>   → {"APIConnect":"DONE","no_of_trans_found":0,"element":[{"tran_id":"NO-SUCH-TRAN-XYZ","status":"INVALID"}]}
# S3. GET tran_id=<reused> → "no_of_trans_found":2
```

### Refund API (same endpoint, GET)

```
# R1. bank_tran_id=<card txn> refund_amount=100.00 refund_remarks=… refe_id=RFPROBE1
{"APIConnect":"DONE","bank_tran_id":"260930154854I2RQNLFHIGDsNIg","trans_id":"PROBE-C1-1790761690","refund_ref_id":"6abcdbdfa6ac4","status":"success","errorReason":""}
# R2. identical repeat → {"…","refund_ref_id":"6abcdbdfa6ac4","status":"processing","errorReason":"Already refund initiated!"}
# R3. refund_amount=5000.00 → {"…","status":"failed","errorReason":"Refund amount must not be more than customer&#039;s transaction amount!"}
# R4. unknown bank_tran_id  → {"APIConnect":"DONE","bank_tran_id":"NOPE123","status":"failed","errorReason":"Invalid Request"}
# R5. different amount, no refe_id → {"…","refund_ref_id":"6abcdbdfa6ac4","status":"processing","errorReason":"Already refund initiated!"}
# S1. refund_ref_id=6abcdbdfa6ac4 → {"APIConnect":"DONE",…,"initiated_on":"2026-09-30 15:52:31","refunded_on":"0000-00-00 00:00:00","status":"processing",…}
# S2. unknown refund_ref_id → {"…","status":"failed","refund_ref_id":"nope000","errorReason":"Unknown Refund Ref ID"}
# S5. full refund of the MFS (bKash) txn → {"…","refund_ref_id":"6abcdbea9ff5c","status":"success","errorReason":""}
```

So:
- `status:"success"` on a refund means **initiated**; the refund-status query shows `processing` until `refunded_on` is set.
- While one refund is in progress, **a second refund on the same transaction is refused**, whatever its amount or `refe_id`. The answer (`processing`) echoes the first refund's ID.
- The sandbox never moved the refund past `processing` during the session, so the completed state is **not observed**.

### Confirmed vs. not confirmed

| Item | Status |
|---|---|
| Init request and response fields; the error shape for bad credentials | ✅ Confirmed |
| Callbacks are signed form POSTs; field names; `risk_level` on `VALID` | ✅ Confirmed (success, fail, cancel) |
| Hash algorithm (MD5, `ksort` with `store_passwd`, empties kept) | ✅ Confirmed on 4 real bodies |
| `verify_sign_sha2` formula | ✅ Reproduced on 1 body; undocumented |
| Validator shape, `VALID`/`VALIDATED`, `APIConnect`, POST support | ✅ Confirmed |
| Transaction query by `tran_id` / `sessionkey`; GET-only | ✅ Confirmed |
| Refund initiate / duplicate / over-refund / status shapes | ✅ Confirmed. The **completed** refund state is not observed |
| IPN delivery, retry schedule, expected response body | ❌ **NOT VERIFIED**: the public sandbox can't reach `localhost`. Needs a team sandbox store and a public HTTPS URL (D10) |
| Production (`securepay.sslcommerz.com`) behaviour, amount limits, refund window | ❌ **NOT VERIFIED** (merchant agreement) |

---

## 0.9 Gap List (severity order)

### Critical

| # | File:line | What's wrong | Correct behaviour |
|---|---|---|---|
| C1 | `validate-payment.ts:51,57,114,145`; `success/route.ts:38-67` | The booking is chosen by the caller's `tran_id`. The Validator's `tran_id` is never compared with it. Idempotency is per booking. The booking status isn't checked, so a cancelled or refunded booking is re-confirmed | Look up the **attempt** by the Validator's `tran_id` (per-attempt, D3). Require the Validator's `tran_id`, `val_id`, `amount`, `currency` and `store_id` to match that attempt. `val_id` and `bank_tran_id` unique at DB level. Fulfil only a `PENDING` booking, under a row lock |
| C2 | `client.ts:95`, `validate-payment.ts:43`, `refund.ts:72`, `test-connection/route.ts:33,52-55`, `ipn/route.ts:94-104`, `success/route.ts:82`, `refund.ts:134-143` | Errors carry the full URL, including `store_passwd`, and are returned to MANAGERs, stored in `PaymentLog` and printed | The transport never puts a URL or response body into an error. Callers see a typed code; logs carry an operation name and a correlation ID. The Validator moves to POST (D2) |
| C3 | `ipn-verifier.ts:38-59` | `store_passwd` isn't sorted in, so every genuine IPN is rejected | The official algorithm, proven on the captured vectors, with `timingSafeEqual`, and failing closed on a missing password or field |
| C4 | (missing) | No reconciliation; a lost redirect means a paid booking stays `PENDING` forever | `POST /api/cron/sslcommerz-reconcile` queries each open attempt **by session key** and settles it through the same path as the callbacks |
| C5 | `initiate-session.ts:35-48,64,109` | Only `CONFIRMED`, `CHECKED_IN` and `COMPLETED` are refused; payments by other methods are ignored; `tran_id` is reused; check-then-create races | Payability check (`PENDING`, within the window, no live payment on any provider) plus a partial unique index "one open SSLCommerz attempt per booking", with a per-attempt `tran_id` |
| C6 | `fail/route.ts:30-33`, `cancel/route.ts:28-31` | `findFirst({ where: undefined })` acts on an arbitrary booking and redirects with its ID | Missing or invalid `tran_id`: log and redirect to a generic page. Never look anything up without a valid, hash-verified `tran_id`. Never put a booking ID in the redirect (use the booking token or code) |

### High

| # | File:line | What's wrong | Correct behaviour |
|---|---|---|---|
| H1 | `webhooks/payment/sslcommerz/route.ts`, `adapter.ts:32-75`, `webhooks/payment/route.ts` | The generic router is reachable for SSLCommerz: each call inserts a row, decrements inventory and emails; a non-success cancels the booking | Delete the SSLCommerz webhook route; `sslcommerzAdapter.verifyWebhook` refuses (audited), as Nagad does |
| H2 | `ipn-verifier.ts:26,49`, `validate-payment.ts:42` | The hash is computed with `md5("")` when the password is unset; the Validator is called with empty credentials | Readiness is checked first; unset credentials mean `SSLCOMMERZ_UNAVAILABLE`, and nothing is hashed or called |
| H3 | `validate-payment.ts:50-70` | No check of `currency`, `store_id`, `tran_id`, `val_id` echo, `APIConnect` or `risk_level`; `amount` falls back to `"0"`; no response schema | Strict schema; each field cross-checked; `risk_level=1` goes to review (D5) |
| H4 | `validate-payment.ts:113-158`, `ipn-verifier.ts:62-74` | No claim: success and IPN both write; duplicate `SUCCESS` rows are possible; the duplicate check is a `LIKE` scan | `updateMany` claim `INITIATED → VALIDATING`, then a guarded transition. Unique partial indexes on `val_id` (stored per attempt) and `bank_tran_id` |
| H5 | `success/route.ts` | The signed redirect body isn't hash-checked | Verify the hash on success, fail and cancel; an invalid hash is logged and never processed. The Validator is still the authority for success |
| H6 | `fail/route.ts:46-52`, `cancel/route.ts:44-50` | The redirect's claimed status changes the payment | Log only. The attempt settles through the Validator, the IPN or the cron. A new initiate re-checks a blocking attempt with SSLCommerz (D6) |
| H7 | `validate-payment.ts:66-107`; `updateBooking` | A captured payment whose amount or booking no longer matches is dropped as "failed", with no record that money was taken | Record it as captured with `REVIEW_REQUIRED` and a reason (`AMOUNT_MISMATCH`, `BOOKING_NOT_PENDING`, `ALREADY_PAID`, `RISK_FLAGGED` …) plus an OWNER alert. Block total edits while an SSLCommerz attempt is open or captured |
| H8 | `refund.ts:52-104` | "Initiated" is treated as refunded; a partial refund is marked `REFUNDED`; the booking is always cancelled; the window uses `updatedAt`; no ledger or idempotency | `SSLCommerzRefund` ledger (append-guarded). Initiated → `PENDING`; the cron polls `refund_ref_id` until `REFUNDED` or `FAILED`. `PARTIALLY_REFUNDED` / `REFUNDED` from the ledger totals. The booking isn't touched. The window runs from `executedAt` |
| H9 | `client.ts:15,18` | Defaults to the sandbox; any base URL; `SSL_IS_SANDBOX` not tied to the host; `testbox` allowed in production | A host allow-list (`securepay.sslcommerz.com`, `sandbox.sslcommerz.com`); production by default; sandbox refused in production unless explicitly allowed; `testbox` refused in production |
| H10 | `test-connection/route.ts:12,37-50` | MANAGER; passes with any password; returns the full store ID; no rate limit | OWNER + MFA, 10 per hour; success only when `APIConnect == "DONE"`; returns `{ success, environment, storeIdMasked }` |
| H11 | `initiate-session.ts:64` | `tran_id = bookingCode` on every attempt | Per attempt `{bookingCode}-{4 hex}`, in `merchantInvoiceNumber` (already `@unique`) (D3) |
| H12 | `admin-actions.ts:414-423,588-610` | MANAGER can set any SSLCommerz payment status, or record a refund with no gateway call | `assertSslcommerzPaymentEditable` / `…RefundNotRecordedManually` / `…StatusChangeAllowed` / `…TotalEditable`, following the Nagad guards |
| H13 | `create/route.ts` | No booking token; raw `bookingId` | `POST /api/payments/sslcommerz/token` (HS256, purpose `sslcommerz-pay`) plus `/initiate` requiring it (§2.1) |

### Medium

| # | File:line | What's wrong | Correct behaviour |
|---|---|---|---|
| M1 | `ipn-verifier.ts:38` | `verify_key` isn't required to cover the fields we act on | Require `amount,currency,status,store_id,tran_id` (+ `val_id` on success) in `verify_key` |
| M2 | all routes | No rate limits (except the racy 5-per-booking count) | §11 table through `PaymentRateLimitHit` (`sslcommerz:` keys), 429 + `Retry-After` |
| M3 | `client.ts:87-91` | No timeout; redirects followed; JSON parsed without a schema | 30 s timeout, `redirect: "error"`, a single retry for reads only, results typed as ok, rejected, unavailable or unknown |
| M4 | all | No correlation IDs; `console.error`; errors in English only | `SSLCommerzError { code, userFacingMessage {en, bn}, httpStatus }`, correlation IDs, the brief's §12 messages |
| M5 | `ipn/route.ts:35-57` | The booking is looked up before the hash check (404/401 oracle); the unverified body is written to the log | Check the hash first; 400 `IPN_HASH_INVALID` with only a body hash and the source IP logged |
| M6 | (missing) | No append-only audit; `PaymentLog` is mutable | `PaymentAuditLog` with `provider: "SSLCOMMERZ"`, the §10 events and masking |
| M7 | `validate-payment.ts:127,139`, all `PaymentLog` writes | Raw bodies stored: truncated PAN, `card_ref_id`, `token_key`, `card_issuer` | Store `card_type`, `card_brand` and the last 4 digits only; never `token_key`/`card_ref_id`; masked `val_id`/`tran_id`/`bank_tran_id` in audit metadata |
| M8 | all redirect routes | `NextResponse.redirect` defaults to **307**, so the browser re-POSTs the signed body to the confirmation page | 303 See Other (D12), `Cache-Control: no-store` |
| M9 | `validate-payment.ts`; `webhooks/payment/route.ts:84` | No guest confirmation email on the SSLCommerz path (only the generic router sends one) | §14 notifications, sent once, on the transition to `SUCCESS` |
| M10 | (missing) | Amount limits: the sandbox accepts ৳5 and ৳500,000.01 | `SSLCOMMERZ_MIN_AMOUNT` ৳10 and a max from settings (default ৳500,000) (D8) |
| M11 | `SSLCommerzPaymentButton.tsx:44-59` | Redirects to whatever URL the server returns; shows raw server errors | Redirect only to an allow-listed SSLCommerz host; show a localised message and a correlation ID |

### Low

| # | File:line | What's wrong | Correct behaviour |
|---|---|---|---|
| L1 | `create/route.ts:37-41` | Returns `sessionkey` to the browser | Return `{ gatewayUrl, reference }` only |
| L2 | `initiate-session.ts:54-57` | Fake fallbacks (`guest@example.com`, `01700000000`) are sent to SSLCommerz | Send the guest's own details; if a required field is missing, use a neutral placeholder and log it; never a real-looking phone number |
| L3 | `ipn/route.ts:112`, `success`/`fail`/`cancel` `GET` | GET and JSON are accepted on callbacks SSLCommerz only POSTs as a form | IPN POST-form only. Browser returns POST-form; GET only renders the result page |
| L4 | `sslcommerz.ts`, `index.ts` | Barrels re-export everything, including the config with the password | Remove the barrels; import modules directly (as in Nagad) |
| L5 | `client.ts:20-27` | Callback URLs may be `http://`, or fall back to `localhost` | Require absolute `https://` callback URLs in production |
| L6 | `docs/PAYMENTS-SSLCOMMERZ.md` | Claims that are no longer true (see [Corrections](#corrections-to-existing-documentation)) | Rewritten in Section 17 |

---

## Decisions Needed Before Section 1

These change what the brief assumes. Each has a recommendation; approving this document means approving the recommendations unless you note otherwise.

| # | Question | Recommendation |
|---|---|---|
| **D1** | **Hash algorithm.** The brief's §5.1 sketch (values only, empties dropped, password appended) fails on every real body. | Implement the **official SDK algorithm**, proven on 4 captured bodies. Require MD5 (§5, §19). **Also**, when `verify_sign_sha2` is present, require it to match (formula reproduced from the sandbox). That adds strength without replacing MD5. If production ever sends a body where only the SHA-2 check fails, it is logged as `IPN_SHA2_MISMATCH`, and we would relax it only on evidence. Require `verify_key` to cover the fields we use (M1). The captured bodies become committed test vectors (public sandbox data; `qwerty` is SSLCommerz's published demo password) |
| **D2** | **Password in URLs.** §1.1 says never. The transaction-query and refund APIs are GET-only (POST gives HTTP 500). | The Validator moves to **POST**. Query and refund stay **GET**, as SSLCommerz requires, with these controls: server-to-server only; HTTPS to the allow-listed hosts; `redirect: "error"`; the URL is never logged, thrown, stored or returned; the transport reports only `{ operation, outcome, httpStatus }`. The residual risk (the password in any egress proxy's URL log) is documented. §1.1's grep is met by construction: every match is the transport's single parameter builder |
| **D3** | **`tran_id`.** §3.1 and §7.2 say `tran_id = booking.bookingCode`. The sandbox accepts a reused `tran_id` even after payment, and a query by `tran_id` then returns several transactions. | Per attempt: `{bookingCode}-{4 random hex}` (e.g. `RES-123456-A1B2`), stored in the existing `@unique` `merchantInvoiceNumber`, and the `sessionkey` stored in `paymentId`. Callbacks and the Validator must echo the attempt's `tran_id`. The readable prefix keeps it searchable in the SSLCommerz panel. `value_a` carries our payment row ID (it's covered by the hash) as a second binding |
| **D4** | **Callback trust.** SSLCommerz signs all four callbacks, but three of them pass through the guest's browser. | Every callback: hash first, then the schema, then the attempt looked up by `tran_id`. **Success and IPN** then claim the attempt and call the Validator; only the Validator's answer can fulfil. **Fail and cancel** change nothing (§4.2, §4.3); they log and redirect. A bad hash on success: log `CALLBACK_HASH_INVALID`, show "we're confirming your payment", don't fulfil; the IPN or cron settles a genuine payment. IPN with a bad hash: 400 (§4.4) |
| **D5** | **Risk flag.** `status=VALID, risk_level=1` ("Not Safe") is a real outcome. SSLCommerz's guidance is to hold the service and check the customer. In the sandbox, the test Visa card returns `risk_level=1` even on plain "Success". | `risk_level=1`: the payment is recorded as captured with `REVIEW_REQUIRED` (reason `RISK_FLAGGED`); the booking stays `PENDING`; the OWNER is emailed to confirm manually or refund. A `riskPolicy` setting (`hold` default, or `accept`) lets you change that. Consequence: sandbox card walkthroughs will land in review; MFS returns `risk_level=0` and confirms |
| **D6** | **An existing open attempt.** §3.1 says reject. As with Nagad, the guest can still pay an old session on SSLCommerz's page. | Before refusing, **query the blocking attempt by session key**. `VALID`/`VALIDATED`: settle it through the fulfilment path (it may confirm the booking). `FAILED`/`CANCELLED`/`EXPIRED`/`UNATTEMPTED`: mark it `FAILED` and allow a new one. Still `PENDING` and younger than the attempt TTL (15 min): refuse with `PAYMENT_IN_PROGRESS`. Older: `SUPERSEDED`, still watched by the cron until the 2-hour abandon point. A late payment on a superseded attempt fulfils only if the booking is still `PENDING` with no other success; otherwise `REVIEW_REQUIRED` |
| **D7** | **Refunds.** SSLCommerz refuses a second refund while one is in progress ("Already refund initiated!"), whatever the amount. §6.4's "additional refund flag" can't work that way, and "success" means only "initiated". | An `SSLCommerzRefund` ledger. At most **one in-flight refund per payment** (DB-enforced). An additional refund is allowed only after the previous one is `REFUNDED`. Initiated → `PENDING`, stored `refund_ref_id`; the cron polls the refund-status API (§8.2, §9.2) until `refunded_on` is set (`REFUNDED`) or it fails. A timeout → `UNKNOWN` → the next status poll (by our `refe_id`, and then by `refund_ref_id` if it came back) resolves it; if SSLCommerz never returned a `refund_ref_id`, the OWNER resolves it against the panel (audited, as Nagad D7). The server action is OWNER + MFA; the amount is retyped; the reason is ≥ 10 characters. **Please confirm the refund window in your SSLCommerz merchant agreement** (7 days assumed, editable) |
| **D8** | **Limits and settings.** §7.1 hardcodes ৳500,000. | An `SSLCommerzSettings` singleton (OWNER + MFA): `maxAmountPoisha` (৳500,000), `paymentWindowMinutes` (60), `attemptTtlMinutes` (15), `refundWindowDays` (7), `riskPolicy` (`hold`), `notifyEmail`. The minimum is fixed at ৳10 (SSLCommerz's documented minimum) |
| **D9** | **Environment.** | `SSL_BASE_URL` must be one of the two SSLCommerz hosts; production is the default. `SSL_IS_SANDBOX` must agree with the host, or readiness fails. In `NODE_ENV=production`, the sandbox is refused unless `SSL_ALLOW_SANDBOX=true`, and store ID `testbox` is always refused |
| **D10** | **Sandbox for §18.** The public `testbox` store worked for everything except the IPN, which SSLCommerz can't deliver to `localhost`. | Use `testbox` for the §18 walkthrough: card, net banking and MFS payments end to end against a local production build. The IPN is tested by POSTing **genuine signed bodies captured from the sandbox**, not simulated ones. Real IPN **delivery** (and SSLCommerz's retry schedule) stays **NOT VERIFIED** unless you register a team sandbox store and give me a public HTTPS URL (e.g. a tunnel) |
| **D11** | **Entry points.** | Delete `/api/webhooks/payment/sslcommerz`; the generic router refuses `SSLCOMMERZ`. Replace `/create` with `/token` + `/initiate` (§3.1's name). Success, fail and cancel: POST-form (GET redirects to the result page without processing). IPN: POST-form only. Refunds become a Server Action; the shared `/api/admin/payments/refund` returns 400 for `SSLCOMMERZ` (after this, that route serves no gateway). The cron is `POST /api/cron/sslcommerz-reconcile`. `test-connection` becomes OWNER + MFA |
| **D12** | **Redirect status.** §4.1 says 302. | **303 See Other**: it's the status that means "follow with GET" after a POST. 302 behaves the same in every current browser, but 307 (today's default) re-POSTs the signed body. If you prefer the literal 302, say so |
| **D13** | **Abandoned sessions.** §9.1 marks sessions ABANDONED after 2 hours. | The payment becomes `ABANDONED`; the **booking stays `PENDING`** (bKash D12, Nagad D12) |
| **D14** | **IPN response body.** §4.4 says plain text; SSLCommerz documents none. | `200 text/plain` `OK` for processed, duplicate or intentionally ignored (for example, a valid hash on a closed attempt). `400 text/plain` for an invalid hash or body. `503` when we couldn't reach the Validator, so SSLCommerz retries. Never JSON, never internal detail |

---

## Outcome of the decisions (added after approval)

| # | As implemented |
|---|---|
| D1 | As recommended: the official SDK algorithm (`hash.ts`), proven on the four committed sandbox vectors; `verify_sign_sha2` required when present; `verify_key` must cover amount, currency, status, store_id, tran_id |
| D2 | As recommended: session creation and the Validator are POST; the transaction query and refunds are GET (required by SSLCommerz). The password is added only in `client.ts` and never appears in an error, log line or audit row |
| D3 | As recommended: `{bookingCode}-{4 hex}` in `merchantInvoiceNumber`, session key in `paymentId`, our row ID in `value_a` (signed, checked on every callback) |
| D4 | As recommended. A success whose hash fails shows "we're confirming your payment"; an IPN whose hash fails gets 400 |
| D5 | As recommended: `riskPolicy` setting, default `hold` → REVIEW_REQUIRED `RISK_FLAGGED` |
| D6 | As recommended: open sessions are queried by session key before a new attempt |
| D7 | As recommended: `SSLCommerzRefund` ledger; PENDING followed by the cron; UNKNOWN resolved by an OWNER (records `refund_ref_id`, or FAILED) |
| D8 | As recommended: `SSLCommerzSettings` form on `/admin/settings/payments` |
| D9, D11, D13, D14 | As recommended. D14: the IPN answers 503 only when SSLCommerz couldn't be reached (a fix found by the test suite) |
| D10 | As recommended: `testbox` for the walkthrough; IPN delivery NOT VERIFIED (see the verification report) |
| D12 | As recommended: 303 See Other |

Two findings during implementation:

- `card_no` from the Validator was first reduced to a last-4 display. It was then dropped entirely, so that no part of a card number is parsed (brief §13.6 grep: zero matches in `src/` outside the test vectors).
- The brief's §11 asks for 429 on the browser returns too. They first redirected to the result page instead; section 11 changed them to 429 with Retry-After, as Nagad's callback does.

## Adjacent Findings (documented, not fixed in this phase)

| # | Location | Finding |
|---|---|---|
| A1 | `src/app/api/webhooks/payment/route.ts` | After this phase, every gateway refuses the generic router (bKash, Nagad and SSLCommerz refuse; BanglaQR has its own route). The router defaults a missing `provider` to `BKASH`, and still has the create-row, decrement-inventory, email and cancel logic. It can be deleted in a later clean-up |
| A2 | `src/app/booking/confirmation/[id]/page.tsx` | The public confirmation page shows full guest PII to anyone with the booking ID (bKash A1, Nagad A6). C6 is fixed here, but any other leak of a booking ID has the same consequence |
| A3 | `src/app/api/bookings/route.ts` | Booking creation is unthrottled, and the booking code comes from `Math.random` (bKash A6). Per-attempt `tran_id`s (D3) no longer depend on it |
| A4 | `src/lib/payments/availability.ts:65` | `assertPaymentProviderAvailable` puts missing env var names in its message (Nagad A4); the SSLCommerz create route returns it. Fixed for SSLCommerz by not returning messages; the helper is unchanged |
| A5 | `prisma/schema.prisma` `PaymentLog` | Still mutable, and its comment says "redacted of secrets", which the SSLCommerz rows contradict (C2). No gateway will write to it after this phase. Old rows may contain the store password in `responsePayload` (dev DB: 0 SSLCommerz rows; **check production**) |
| A6 | `src/components/admin/BookingActionButtons.tsx:209`, `NewBookingView.tsx:246` | Staff can record a manual payment or refund with method `SSLCOMMERZ`, which is indistinguishable from a gateway row in reports. The Section 6 guards stop edits and refunds on real gateway rows; the dropdown label is left as it is |
| A7 | `src/app/api/admin/reports/payments/route.ts:12` | Counts only `SUCCESS` for gateways, so `PARTIALLY_REFUNDED` bKash, Nagad (and later SSLCommerz) revenue drops out of reports |

---

## Corrections to Existing Documentation

| Document | Claim | Reality |
|---|---|---|
| `PAYMENTS-SSLCOMMERZ.md` §4 | "IPN hash verification … requires both `verify_sign` and `verify_key`" | True, but the hash itself is computed wrongly; every genuine IPN fails (C3) |
| `PAYMENTS-SSLCOMMERZ.md` §4 | "Success redirect is never trusted alone" | It's validated, but bound to the wrong booking (C1) |
| `PAYMENTS-SSLCOMMERZ.md` §4 | "IPN idempotency … checks `PaymentLog`" | A non-atomic `LIKE` scan; success and IPN aren't idempotent against each other (H4) |
| `PAYMENTS-SSLCOMMERZ.md` §4 | "Store Password never leaves the server" | It leaves in error messages (C2) |
| `PAYMENTS-SSLCOMMERZ.md` §5 | "throw a clear error instead of silently defaulting to SSLCommerz's public `testbox` … sandbox" | The **base URL** silently defaults to the sandbox (H9) |
| `PAYMENTS-SSLCOMMERZ.md` §6 | "Test Connection … reports whether SSLCommerz actually accepted them" | It reports success with any password (H10) |
| `PAYMENTS-SSLCOMMERZ.md` §7 | "Unsigned IPN … confirm a 401" | Also 401 for **genuine** signed IPNs (C3) |

---

### Evidence commands (re-runnable)

```bash
# C3 / D1: hash algorithms against the captured sandbox bodies
#   captured.jsonl holds the raw POST bodies from the capture server; they are committed
#   in Section 5 as src/lib/payments/sslcommerz/__tests__/vectors/*.txt
node hashcheck.mjs
# /success verify_sign c7562cb2eae50249536d9d3c8e2a88e1
#  official   true     repo code  false     brief  false     official-without-empty false
# /fail   … official true, repo false, brief false
# /cancel … official true, repo false, brief false
# /success (risk) … official true, repo false, brief false
#  sha2 = sha256(sorted, sha256(pw)) true

# C2: the password reaches the thrown error
grep -n 'failed with status' src/lib/payments/sslcommerz/client.ts
# → 95:    throw new Error(`SSLCommerz API call to ${options.endpoint} failed with status ${res.status}: ${text}`);
grep -n 'store_passwd=' src/lib/payments/sslcommerz/*.ts src/app/api/admin/payments/sslcommerz/test-connection/route.ts

# C6: findFirst with no filter
grep -n 'where: tran_id ?' src/app/api/payments/sslcommerz/{fail,cancel}/route.ts
# → fail/route.ts:31:    where: tran_id ? { bookingCode: tran_id } : undefined,
# → cancel/route.ts:29:  where: tran_id ? { bookingCode: tran_id } : undefined,

# M8: default redirect status
node -e 'console.log(require("next/server").NextResponse.redirect("http://x/y").status)'   # → 307

# 0.7: test files
find src/lib/payments/sslcommerz src/app/api/payments/sslcommerz -name "*.test.ts" | wc -l   # → 0

# Card data grep (brief §13.6)
grep -rn "card_no\|cvv\|card_expiry" src/
# → src/lib/payments/sslcommerz/validate-payment.ts:16:  card_no?: string;   (response type only)
```

### External references

- Official PHP SDK, `SslCommerzNotification::SSLCOMMERZ_hash_verify` and `validate`: `github.com/sslcommerz/SSLCommerz-PHP/blob/master/lib/SslCommerzNotification.php`
- Official Python SDK, `hash_validate_ipn`, `init_refund`, `query_refund_status`, `transaction_query_session`: `github.com/sslcommerz/SSLCommerz-Python/blob/master/sslcommerz_lib/sslcommerz.py`
- SSLCommerz developer docs (v4): `developer.sslcommerz.com/doc/v4/`

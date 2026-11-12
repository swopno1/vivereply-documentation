# bKash Security Review — Discovery & Gap Analysis

| | |
|---|---|
| **Date** | 2026-09-29 |
| **Branch** | `hardening/bkash` (from `main` @ `f9900f5`, which includes the hardened BanglaQR work) |
| **Scope** | Every bKash route, library module, adapter, and guest/admin caller, plus the shared code they depend on (generic webhook router, shared refund route, `updateBooking`/`cancelBookingWithRefundDecision`, booking creation, confirmation page) |
| **Method** | Line-by-line read of the code (not the docs). Token-cache claims re-checked by executing the code with a mocked `fetch`. bKash API behaviour checked against the public developer portal (`developer.bka.sh`) |
| **Status** | **Approved 2026-09-30** (D1–D12 as recommended). Implemented in Sections 1–14 on `hardening/bkash`; see [verification report](PAYMENTS-BKASH-VERIFICATION.md). |

## Summary

The bKash integration is **not production-safe in its current state**. The redirect is *mostly* not trusted for fulfilment (booking confirmation only follows a server-side execute call), but almost everything around that call is unguarded.

The three Critical findings:

1. **A lost execute response can charge the guest without confirming the booking, and nothing reconciles it.** In Tokenized Checkout, money moves when *we* call execute. If that call times out, the payment stays `INITIATED` forever, the guest sees an error, and 15 minutes later they can start a second payment for the same booking.
2. **Payment records have no state machine.** An unauthenticated request to the callback with `status=failure` overwrites *any* payment, including a `SUCCESS` one, to `FAILED`. A replayed success callback can do the same through the execute error path. The booking stays `CONFIRMED` but its payment reads `FAILED`, which blocks refunds and corrupts revenue reports. Only the `paymentID` is needed, and it sits in the guest's URL bar and history.
3. **Cancelled and expired bookings can be paid and resurrected.** Create only refuses `CONFIRMED`/`CHECKED_IN`/`COMPLETED`, and execute sets `CONFIRMED` unconditionally. A cancelled booking whose room has been resold, or a booking whose guest already paid by BanglaQR, can be paid again through bKash.

Two findings change the design the brief assumes (see [Decisions](#decisions-needed-before-section-1)):

- **bKash webhooks are delivered by AWS SNS and signed with an X.509 certificate, not an HMAC shared secret** ([bKash docs: Webhooks](https://developer.bka.sh/docs/webhooks.md)). Both existing webhook routes use HMAC, so they would reject every genuine bKash notification. The SNS payload also has no `paymentID`: it identifies the payment by `trxID` and `merchantInvoiceNumber`.
- **bKash's callback carries a `signature` parameter** (and, in practice, `apiVersion`) in addition to `paymentID` and `status` ([bKash docs: Create Payment](https://developer.bka.sh/docs/create-payment-1.md)). A `.strict()` schema with only `paymentID` and `status` (brief §2.2) would reject every real callback.

Totals: **3 Critical, 10 High, 12 Medium, 7 Low** (32 gaps), plus 7 adjacent findings in shared or other-gateway code (an 8th was found during implementation).

Legend for all tables: ✅ Mitigated · ⚠️ Partial · ❌ Unmitigated

---

## 0.1 Endpoint Inventory

`find src/app/api -path "*bkash*" -name route.ts` returns five routes. Three more entry points reach bKash logic and are included: the generic webhook router, the shared refund route, and two admin server actions.

```
src/app/api/payments/bkash/create/route.ts
src/app/api/payments/bkash/callback/route.ts
src/app/api/payments/bkash/webhook/route.ts
src/app/api/webhooks/payment/bkash/route.ts          (re-exports the generic router)
src/app/api/admin/payments/bkash/test-connection/route.ts
src/lib/payments/bkash/{client,create-payment,execute-payment,refund-payment,token-manager,verify-payment,webhook-verifier}.ts
src/lib/payments/adapters/bkash-adapter.ts
src/lib/payments/bkash.ts                              (barrel)
```

### E1. `POST /api/payments/bkash/create`
File: `src/app/api/payments/bkash/create/route.ts` → `create-payment.ts`

| Property | Current state |
|---|---|
| Purpose | Creates a bKash payment session and returns `bkashURL` for the browser redirect |
| Auth | ❌ None. A raw `bookingId` (UUID) from the body is the only credential (`:11`) |
| Rate limit | ⚠️ 5 per booking per hour, counted from `PaymentLog` rows with event `PAYMENT_CREATED` (`:18-33`). Failed attempts aren't counted, there is no per-IP limit, and the check-then-act is racy |
| Validation | ❌ Manual truthiness check on `bookingId` only (`:13`). `payerReference` (guest phone) is accepted from the client (`:11`, `create-payment.ts:50`); if absent, the hardcoded fallback `"01700000000"` is used |
| Booking checks | ❌ Refuses only `CONFIRMED`/`CHECKED_IN`/`COMPLETED` (`create-payment.ts:27`). `CANCELLED`, `EXPIRED` and `PENDING_MANUAL_VERIFICATION` bookings are accepted. No age/payment window |
| Output | `{ success, paymentId, bkashURL }`. The bKash `paymentID` is returned; that's acceptable because the browser sees it in the bKash URL anyway |
| Errors | ❌ Every error returns its raw `err.message` with 500 (`:50-52`). That includes missing env var **names** from `assertPaymentProviderAvailable` (`availability.ts:63-66`), bKash `statusMessage` text, and "Booking not found" (an existence oracle). No correlation ID |
| Idempotent | ❌ No. A 15-minute "in progress" check (`create-payment.ts:36-43`) is check-then-insert, not a DB constraint; two concurrent requests both pass. After 15 minutes a second session is allowed while the first may still be executable |
| Callback URL | ⚠️ Falls back to `Host` / `X-Forwarded-Proto` request headers when `BKASH_CALLBACK_URL` is unset (`:35-37`) |

### E2. `GET /api/payments/bkash/callback`
File: `src/app/api/payments/bkash/callback/route.ts`

| Property | Current state |
|---|---|
| Purpose | bKash redirects the guest's browser here with `paymentID`, `status`, `signature` (and `apiVersion`) |
| Auth | None possible; it's a browser redirect. `signature` is ignored |
| Rate limit | ❌ None |
| Validation | ❌ None. `paymentID` is used as-is in a DB query; any `status` string accepted |
| Trust in `status` | ❌ For `cancel`/`failure`, the **query parameter alone** rewrites the payment's status with no status guard (`:33-40`): a `SUCCESS` payment becomes `FAILED`. For `success`, execute is called, and fulfilment depends on execute ✅ |
| Output | 307 redirects (Next.js default). Unknown paymentID → `/?paymentError=invalid_payment_id` (distinguishes existing from missing IDs). Failure → `/book/{roomId}?bookingId=…&paymentStatus=…`, but **the booking page ignores `paymentStatus`** (grep finds no reader), so the guest lands back on step 1 with no message |
| Errors | ⚠️ The initial `findFirst` (`:19`) is outside any try/catch, so a DB error gives a 500 page. Execute errors are logged with `console.error(err)` (`:74`) |
| Cache | ⚠️ `Cache-Control: no-store` only (brief asks for `no-store, no-cache, must-revalidate`) |
| Idempotent | ❌ No (see C2) |

### E3. `POST /api/payments/bkash/webhook`
File: `src/app/api/payments/bkash/webhook/route.ts`

| Property | Current state |
|---|---|
| Purpose | Webhook that calls `executePayment` for a still-`INITIATED` payment |
| Auth | HMAC-SHA256 of the raw body against `BKASH_WEBHOOK_SECRET` (`webhook-verifier.ts`), compared with `timingSafeEqual` ✅, fail-closed when the secret is unset ✅. **But bKash does not sign webhooks this way** (SNS X.509; see D1), so no genuine notification can ever pass |
| Rate limit | ❌ None |
| Validation | ❌ `JSON.parse` only; reads `paymentID`/`paymentId`, which the real SNS payload doesn't contain |
| Output | 401 on bad signature (brief: 400), `{received:true}` otherwise, 500 on error |
| Idempotent | ⚠️ Executes only if `INITIATED`, but check-then-act, and it races the callback (T6) |
| Logging | ❌ The full raw body is stored in `PaymentLog.requestPayload` (`:35`); the SNS payload contains the payer's wallet number (`debitMSISDN`). Invalid signatures aren't logged |

### E4. `POST /api/webhooks/payment/bkash` and `POST /api/webhooks/payment`
Files: `src/app/api/webhooks/payment/bkash/route.ts` (re-export), `src/app/api/webhooks/payment/route.ts`, `bkash-adapter.ts:33-56`

| Property | Current state |
|---|---|
| Purpose | Generic router. Defaults to `BKASH` when the body has no `provider` (`route.ts:18`) |
| Auth | Same HMAC verifier as E3 (headers `x-bkash-signature` or `x-signature`) |
| Trust in payload | ❌ `bookingId`, `transactionId`, `amount` and `status` all come from the payload (`bkash-adapter.ts:43-51`). Nothing is matched against an existing bKash `Payment` row |
| Effects | Inserts a **new** `Payment` row per delivery (`route.ts:57-66`); SUCCESS sets `CONFIRMED` and decrements `availableUnits` every time; any non-SUCCESS status **cancels the booking, even a `CONFIRMED` one** (`:100-104`); sends an email |
| Idempotent | ❌ No `ProcessedWebhook` check (BanglaQR review A1) |
| Rate limit / audit | ❌ None |

### E5. `POST /api/admin/payments/bkash/test-connection`
File: `src/app/api/admin/payments/bkash/test-connection/route.ts`

| Property | Current state |
|---|---|
| Purpose | Checks the merchant credentials by obtaining a grant token |
| Auth | Middleware requires a session (401) ✅. `requireRole("MANAGER")` (`:9`); brief requires OWNER. `requireRole` runs **inside** the try (`:7-9`), so `forbidden()` is caught and a STAFF user gets a **500** carrying `NEXT_HTTP_ERROR_FALLBACK;403` rather than a 403 |
| Rate limit | ❌ None |
| Output | Doesn't return the token ✅. Returns `baseUrl` and the raw error message. Uses the cached token, so it doesn't actually re-test the credentials when a token is cached |

### E6. `POST /api/admin/payments/refund` (shared by all gateways)
File: `src/app/api/admin/payments/refund/route.ts` → `bkash/refund-payment.ts`

| Property | Current state |
|---|---|
| Purpose | Refunds any provider's payment; called by `fetch` from `BookingDetailView.tsx:188` |
| Auth | `requireRole("OWNER")` ✅ but inside the try (`:18`), so denial is a 500 with the Next.js sentinel message. No `requireMfa` |
| Rate limit | ❌ None |
| Validation | ⚠️ `paymentId` truthiness; `AmountSchema` on the optional partial amount; `reason` optional and defaults to "Admin initiated refund" (`:41`); client's reason defaults to a canned string (`BookingDetailView.tsx:193`) |
| Business rules | ❌ No refund amount ≤ remaining refundable check; no refund window; a partial refund marks the payment `REFUNDED` in full and the refunded amount isn't recorded (`refund-payment.ts:57-61`) |
| Idempotent | ❌ No. Two clicks → two bKash refund calls |
| Errors | Raw bKash `statusMessage` returned to the browser (`refund-payment.ts:101`, route `:80-81`) |

### E7. Internal functions (not routes)

| Function | File | Reached from | Notes |
|---|---|---|---|
| `executePayment(paymentID)` | `execute-payment.ts` | E2 success path, E3 | No row lock, no booking-status guard, no payment-status guard beyond a `SUCCESS && CONFIRMED` shortcut (`:21`). The amount check is skipped when `res.amount` is falsy (`:46`). `merchantInvoiceNumber` not checked. Error path overwrites status to `FAILED` (`:107-113`). No confirmation email |
| `verifyPaymentStatus(paymentID)` | `verify-payment.ts` | **Nothing** (dead code) | Uses `GET …/payment/status?paymentID=` (`:18-19`); bKash documents Query Payment as `POST` with a JSON body. Logs the full response (`:33`) |
| `refundPayment(input)` | `refund-payment.ts` | E6 | See E6 |
| `getGrantToken()` | `token-manager.ts` | All of the above | See 0.2 |

### E8. Admin server actions that touch bKash payments

| Action | File | Finding |
|---|---|---|
| `updateBooking` | `src/app/actions/admin-actions.ts:381,475-480` | MANAGER can set **any** status string on the booking's payment when there is exactly one, including a bKash payment: `SUCCESS`, `REFUNDED`, back to `INITIATED`. No gateway call |
| `cancelBookingWithRefundDecision` | `admin-actions.ts:526-567` | MANAGER cancels a booking with a bKash `SUCCESS` payment and "records" a refund in the booking log **without calling bKash**; the payment stays `SUCCESS` |
| `updateBookingStatus` | `admin-actions.ts:~180` | Guards BanglaQR only; a MANAGER can confirm or cancel a booking whose bKash payment is mid-execute |

---

## 0.2 Token Cache Review

File: `src/lib/payments/bkash/token-manager.ts`

| Question | Finding |
|---|---|
| **Where the cache lives** | Module-level `let cachedToken: CachedToken \| null` (`:16`) holding `idToken`, `refreshToken`, `expiresAt`. Memory only ✅. Not written to DB, disk or logs ✅. Under PM2 cluster mode each worker has its own cache (N workers → N grants per hour), which is acceptable |
| **Refresh trigger** | Time-based: re-grant when less than 60 s remain (`:21`). `expires_in` defaults to 3600 if missing (`:53`). The `refresh_token` is stored but **never used**. There is no refresh on error: a 401 does not clear the cache |
| **Concurrent refresh** | ❌ **No single-flight.** Verified by execution: 10 concurrent `getGrantToken()` calls with an empty cache made **10** grant calls to bKash (output below) |
| **Failure mode** | Failed grants are not cached ✅ (next call retries). But a token that bKash **revokes or expires early** stays cached until its local expiry: verified, 3 consecutive calls reused the same rejected token (output below). That is up to an hour of 100% payment failure with no recovery. Errors propagate to the create route, which returns them raw with 500, not 503 |
| **Token in logs/responses** | Not logged ✅, not returned by test-connection ✅. Error messages carry bKash `statusMessage`/`statusCode` (`:48-50`), not the token. Headers containing `password` and a body containing `app_secret` are built in `:36-44` and never logged ✅ |
| **bKash's own limits** | bKash: token lifetime 3600 s; the Refresh Token API must not be called **more than twice per hour**, or the merchant is **blocked for one hour** ([Token management](https://developer.bka.sh/docs/token-management-overview-3.md)). Grant limits aren't documented. A thundering herd on grant is therefore a real availability risk (T5) |
| **Server-only** | ⚠️ No `import "server-only"`. `src/lib/payments/index.ts` re-exports the whole bKash barrel, so a client component importing a type from `@/lib/payments` would pull the token manager into the client bundle graph (the env vars would be empty there, but the boundary isn't enforced) |

Evidence (mocked `fetch`, no network):

```
$ pnpm exec tsx token-herd.mts
grant calls for 10 concurrent requests: 10
call 0 token reused: tok10 error: Unauthorized
call 1 token reused: tok10 error: Unauthorized
call 2 token reused: tok10 error: Unauthorized
```

---

## 0.3 Data Flow & Trust Boundaries

```mermaid
sequenceDiagram
    autonumber
    participant G as Guest browser (untrusted)
    participant S as Our server (trusted)
    participant DB as Postgres
    participant B as bKash API (semi-trusted)
    participant SNS as bKash webhook via AWS SNS

    G->>S: POST /api/bookings (room, dates, guest PII)
    S->>DB: Booking PENDING (bookingCode = RES-######, Math.random)
    S-->>G: { id (UUID), bookingCode, total }
    G->>S: POST /api/payments/bkash/create { bookingId, payerReference }
    Note over G,S: ❌ TB1: raw bookingId is the only credential; phone from client
    S->>B: token/grant (username, password, app_key, app_secret)
    B-->>S: id_token (1 h)
    S->>B: checkout/create { amount from DB ✅, invoice = bookingCode, payerReference }
    B-->>S: paymentID, bkashURL
    S->>DB: Payment INITIATED (after bKash call; no uniqueness)
    S-->>G: bkashURL
    G->>B: Guest authorises with wallet PIN/OTP on bKash's page
    B-->>G: 302 → /api/payments/bkash/callback?paymentID&status&signature
    G->>S: GET callback
    Note over G,S: ❌ TB2: status=failure/cancel trusted to rewrite payment state
    S->>B: checkout/execute (money moves HERE)
    Note over S,B: ❌ TB3: timeout = unknown outcome, never reconciled
    B-->>S: trxID, amount, transactionStatus, merchantInvoiceNumber, customerMsisdn
    S->>DB: Payment SUCCESS + Booking CONFIRMED (no status guards, no lock)
    S-->>G: 307 → /booking/confirmation/{bookingId}
    SNS-->>S: Notification (X.509-signed): trxID, amount, merchantInvoiceNumber, debitMSISDN
    Note over SNS,S: ❌ TB4: our routes expect HMAC + paymentID → genuine messages rejected
```

| Boundary | What crosses it | Current trust |
|---|---|---|
| TB1 Guest → create | `bookingId`, `payerReference` | Both trusted. Booking state barely checked |
| TB2 Guest → callback | `paymentID`, `status`, `signature` | `status` trusted for failure/cancel. `signature` ignored. `paymentID` looked up, not validated |
| TB3 Server → bKash execute | `paymentID` | Response amount checked (fail-open if absent), invoice not checked, response not schema-validated |
| TB4 bKash → webhook | SNS message | Wrong verification scheme; payload fields trusted (generic router) |
| TB5 Admin → refund / status edit | `paymentId`, amount, reason, status | OWNER for refunds, but MANAGER can bypass through `updateBooking` and "record" a refund through `cancelBookingWithRefundDecision` |

---

## 0.4 Threat Model

| # | Threat | Status | Evidence / what's missing |
|---|---|---|---|
| T1 | Attacker forges the callback redirect (query params tampered) | ❌ Unmitigated | Fulfilment still needs a successful execute ✅, but `status=failure\|cancel` rewrites **any** payment's status with no guard (`callback/route.ts:33-40`), including `SUCCESS` → `FAILED` (C2) |
| T2 | Replay of a legitimate callback URL with a different `paymentID` | ⚠️ Partial | Execute binds to the payment row's own booking, so another booking can't be confirmed ✅. But any known `paymentID` triggers an execute before its owner authorises, marking it `FAILED` (`execute-payment.ts:107-113`), and a replay after check-in overwrites `SUCCESS` (C2) |
| T3 | Attacker calls execute directly with a `paymentID` that isn't theirs | ⚠️ Partial | Not a public route ✅. Reachable through the callback with any `paymentID`; no ownership binding between browser and payment (e.g. a signed state cookie) |
| T4 | Attacker races two bookings through the same payment session | ⚠️ Partial | `paymentID` resolves to one row and its booking ✅. `Payment.paymentId` has **no unique index**, and one booking can hold several live sessions (H1) |
| T5 | Token cache thrash (DoS) | ❌ Unmitigated | No single-flight (verified 10 → 10 grants); no per-IP create limit; sticky 401 (verified). bKash blocks the merchant for 1 h after excess refresh calls |
| T6 | Callback triggered twice (bKash retry, refresh, double redirect) → double fulfilment | ❌ Unmitigated | Two concurrent executes both pass the `SUCCESS && CONFIRMED` shortcut; bKash answers the second with 2117 "already completed", and the error path writes `FAILED` over `SUCCESS` depending on ordering. No lock, no `updateMany` claim |
| T7 | Webhook arrives before or after the callback → inconsistent state | ❌ Unmitigated | The webhook calls **execute** on an `INITIATED` payment (E3), racing the callback's execute (T6). Genuine SNS messages are rejected anyway (D1), so the webhook can't serve as a fallback |
| T8 | Refund abused through a compromised MANAGER session | ⚠️ Partial | The refund route is OWNER-only ✅, but a MANAGER can set a bKash payment to `REFUNDED`/`SUCCESS` (`updateBooking`) or record a fake refund (`cancelBookingWithRefundDecision`) (H8). A compromised OWNER has no MFA gate, no amount cap, no idempotency, and no notification (H7) |
| T9 | Amount tampering between create and execute | ⚠️ Partial | Create uses the DB total ✅. Execute compares against the **live** booking total, which a MANAGER can edit mid-payment (`updateBooking`): money is captured, then the mismatch throws and the payment stays `INITIATED` (money taken, no booking). Check is skipped if `amount` is absent (`execute-payment.ts:46`) |
| T10 | `merchantInvoiceNumber` collision or reuse | ❌ Unmitigated | Invoice = `bookingCode`, reused for every attempt on a booking. bKash specifies "unique invoice number used at merchant side" and has error 2029 "Duplicate for all transactions". Not verified on execute. `bookingCode` has only 900,000 values (`Math.random`) |
| T11 | `payerReference` (guest phone) leaked in logs | ❌ Unmitigated | Full phone in `PaymentLog.requestPayload` on every create (`create-payment.ts:79,103,123`); `customerMsisdn` in logged execute/verify/refund responses (`execute-payment.ts:56,121`, `verify-payment.ts:33`, `refund-payment.ts:79,96`) and in `Payment.rawWebhookPayload` (`:72,111`) |
| T12 | Token theft from a memory dump | ⚠️ Partial | Memory only, 1 h lifetime, never logged ✅. An attacker with memory access also has the env credentials; residual risk accepted and documented |
| T13 | Replay of an old `bkashURL` after the payment window | ❌ Unmitigated | bKash payment IDs stay executable for **24 h**. No window check on callback or execute, and create accepts `CANCELLED` bookings (C3) |
| T14 | Execute outcome lost (timeout, 5xx, crash after capture) | ❌ Unmitigated | No reconciliation, no query-payment call, no `EXECUTING` state (C1) |
| T15 | Admin action races an in-flight execute | ❌ Unmitigated | Admin cancel or BanglaQR auto-release can change the booking between our read and the execute response; execute then overwrites to `CONFIRMED` |
| T16 | Host-header injection into `callbackURL` | ⚠️ Partial | Only when `BKASH_CALLBACK_URL` is unset (`create/route.ts:35-37`). It affects the requester's own session, but should fail closed in production |
| T17 | Error-message information leak | ❌ Unmitigated | Raw errors on create, refund, test-connection (H6) |

---

## 0.5 Gap List (severity order)

### Critical

**C1. Lost execute outcomes are never reconciled; the guest can be charged without a booking, then charged again.**
`src/lib/payments/bkash/execute-payment.ts:33-44,132-143`, `create-payment.ts:36-43`, `verify-payment.ts` (unused)
- **Wrong:** In Tokenized Checkout, funds move when the merchant calls execute. If execute times out (30 s), the socket drops, or the process dies after bKash completes, the code logs `EXECUTE_ERROR` and leaves the payment `INITIATED` and the booking `PENDING`. The guest sees `execute_error`, and after 15 minutes create allows a new session, so they can pay again. No cron or query call ever discovers the first capture. `verifyPaymentStatus` exists but is called from nowhere, and it uses `GET` with a query string where bKash documents a `POST` with a JSON body.
- **Correct:** Claim the payment with `updateMany({ status: "INITIATED" } → "EXECUTING")` before calling execute. A timeout or unknown outcome leaves it `EXECUTING`, which blocks new sessions for that booking. A reconciliation cron (every 5 min) runs Query Payment on `EXECUTING` rows older than 2 min and `INITIATED` rows older than 10 min: `Completed` → fulfil through the same guarded path; still `Initiated` after 2 h → `ABANDONED`. The guest-facing error says the payment is being checked, not that it failed.

**C2. No payment state machine: forged or replayed callbacks overwrite settled payments.**
`src/app/api/payments/bkash/callback/route.ts:33-40`, `execute-payment.ts:21-28,106-113`
- **Wrong:** `GET /api/payments/bkash/callback?paymentID=<id>&status=failure` sets that payment to `FAILED` whatever its current status, including `SUCCESS`. The execute replay shortcut requires the booking to be exactly `CONFIRMED`; once the guest is `CHECKED_IN` or `COMPLETED`, replaying the success URL from browser history calls bKash execute again, bKash returns 2117/2062 ("already completed"), and the error branch writes `FAILED` over `SUCCESS`. Concurrent callback + callback (or callback + webhook) produces the same overwrite. Result: a confirmed, paid booking whose payment reads `FAILED`; the refund route then refuses it ("Only successful payments can be refunded"), and revenue reports undercount.
- **Correct:** Every payment transition goes through a guarded `updateMany` with an allowed-from list (`INITIATED → EXECUTING → SUCCESS | FAILED`, `INITIATED → SUPERSEDED | ABANDONED`, `SUCCESS → PARTIALLY_REFUNDED → REFUNDED`), checked with `count === 1`. The callback never changes state from `status`; `failure`/`cancel` only choose the redirect. bKash's "already completed" codes (2062/2117) resolve by Query Payment, never by writing `FAILED`.

**C3. Cancelled, expired, and already-paid bookings can be paid and resurrected.**
`create-payment.ts:26-34`, `execute-payment.ts:64-88`
- **Wrong:** Create refuses only `CONFIRMED`/`CHECKED_IN`/`COMPLETED`. A `CANCELLED` booking (room released or resold), an `EXPIRED` BanglaQR booking, or a `PENDING_MANUAL_VERIFICATION` booking (guest already paid by QR and is awaiting verification) can start a bKash session. Execute then sets the booking `CONFIRMED` unconditionally inside a transaction that doesn't re-read the booking. Result: overbooking, or a guest charged twice across gateways.
- **Correct:** Create requires booking `PENDING`, age ≤ `paymentWindowMinutes`, and no live payment on **any** provider. Execute re-checks all of this **before** calling bKash, under a booking row lock (`SELECT … FOR UPDATE`) held across the execute call, so money is never captured for a booking we can't fulfil (D5).

### High

**H1. Concurrent or repeated create requests open multiple payable sessions for one booking.**
`create-payment.ts:31-43,88-96`, `execute-payment.ts:21`
- **Wrong:** The "in progress" check and the insert are separate queries, with no DB constraint, so a double click or two tabs creates two sessions. The guest can authorise both; the second execute runs on an already-`CONFIRMED` booking (execute doesn't check for an existing `SUCCESS`), and the guest is charged twice.
- **Correct:** A partial unique index "one live bKash payment per booking" (`status IN ('INITIATED','EXECUTING','SUCCESS', 'PARTIALLY_REFUNDED')`), plus a unique index on `paymentId` for BKASH. A new create **supersedes** an older `INITIATED` attempt in the same transaction; superseded IDs are never executed, so the guest can't be charged for them (D4).

**H2. The generic webhook router is an unguarded bKash fulfilment path.**
`src/app/api/webhooks/payment/route.ts:18-110`, `bkash-adapter.ts:33-56`, `src/app/api/webhooks/payment/bkash/route.ts`
- **Wrong:** Any HMAC-valid body (and bKash is the default provider) is trusted for `bookingId`, amount and status. Each delivery inserts a new `SUCCESS` payment and decrements inventory again; a non-SUCCESS status cancels even a `CONFIRMED` booking. No idempotency, rate limit, or audit.
- **Correct:** `/api/webhooks/payment/bkash` becomes a dedicated, hardened handler (SNS-verified, idempotent via `ProcessedWebhook`, rate-limited, audited, resolves the payment by stored invoice and trxID and never trusts payload IDs). `bkashAdapter.verifyWebhook` always returns `null` so the generic router refuses bKash, matching what BanglaQR H1 did. The legacy `/api/payments/bkash/webhook` is removed.

**H3. The webhook verification scheme doesn't match bKash, so there is no working webhook channel.**
`webhook-verifier.ts`, `webhook/route.ts:9-22`
- **Wrong:** bKash sends webhooks through AWS SNS, signed with the SNS X.509 certificate (`Signature`, `SigningCertURL`, `SignatureVersion`), with a `SubscriptionConfirmation` handshake. The payload has `trxID`, `merchantInvoiceNumber`, `amount`, `transactionStatus`, `debitMSISDN`, and **no `paymentID`**. Our HMAC check rejects every genuine message, and the handler looks up `paymentID`.
- **Correct:** See D1: verify the SNS signature with `node:crypto` (no new dependency), pin `SigningCertURL` to `https://sns.<region>.amazonaws.com/*.pem`, pin the `TopicArn` to a configured value, confirm subscriptions only for that topic, and treat the webhook as a reconciliation signal that is cross-checked with Query Payment.

**H4. Token cache: no single-flight, sticky revoked tokens, unused refresh token.**
`token-manager.ts:18-61`, `client.ts:76-79`
- **Wrong:** Verified: 10 concurrent requests → 10 grant calls; a 401 leaves the rejected token cached until local expiry. Grant failures surface as raw 500s.
- **Correct:** Promise-as-lock single-flight; proactive re-grant under 60 s; on 401 (or bKash's invalid-token codes), clear the cache and retry once; failures not cached; 503 `BKASH_UNAVAILABLE` to the guest; `bkash.token.granted` / `bkash.token.refresh_failed` events without the token. Keep using grant rather than the refresh API, because bKash blocks the merchant for an hour after more than two refreshes per hour and each PM2 worker holds its own cache.

**H5. bKash API calls are unverified against the documented request and response shapes.**
`execute-payment.ts:34-41`, `verify-payment.ts:18-25`, `client.ts:46-89`
- **Wrong:** Execute sends `paymentID` as a **path segment with no body**; bKash documents `POST /tokenized/checkout/execute` with `{"paymentID": …}` in the body. Query Payment uses `GET`; bKash documents `POST`. Responses are cast (`as T`) with no validation, so a missing `amount` skips the amount check (`execute-payment.ts:46`, fail-open) and `merchantInvoiceNumber` is never compared. There is no sandbox evidence in the repo, so it is **unknown whether a bKash payment can currently complete at all**.
- **Correct:** Request shapes follow the docs; every response is parsed with a Zod schema (unknown → error); execute requires `statusCode === "0000"`, `transactionStatus === "Completed"`, amount equal to the stored payment amount, invoice equal to the stored invoice, and a present `trxID`. Sandbox verification is needed (D10).

**H6. Internal information leaks in error responses; no correlation IDs.**
`create/route.ts:50-52`, `availability.ts:63-66`, `refund/route.ts:79-81`, `test-connection/route.ts:30-35`, `callback/route.ts:24-27`
- **Wrong:** Raw messages reach the browser: env var names that are missing, bKash `statusMessage`, "Booking not found", `NEXT_HTTP_ERROR_FALLBACK;403`. The callback distinguishes unknown from known payment IDs.
- **Correct:** A `BkashError(code, …)` class; responses are `{ error: { code, message: {en,bn}, correlationId } }` with `BK-YYYY-MM-DD-xxxxxx` references; details only in logs.

**H7. Refunds: no amount ceiling, no idempotency, partial refunds recorded as full, no rate limit or notification.**
`bkash/refund-payment.ts:16-116`, `src/app/api/admin/payments/refund/route.ts`, `BookingDetailView.tsx:183-210`
- **Wrong:** Refund amount isn't checked against the original minus earlier refunds. Two clicks send two refund calls. A partial refund sets `REFUNDED` and loses the amount; `refundTrxID` is kept only in log text. Reason is optional with a default. A timeout leaves the outcome unknown (bKash says to call Refund Status). OWNER-only, but no MFA, rate limit, audit row, or email. Exposed as a JSON route rather than a Server Action.
- **Correct:** See D9. A Server Action, `requireRole("OWNER")` + `requireMfa()` outside try; a Zod schema (reason 10–500 characters); a `BkashRefund` append-only table with an idempotency key; `refundedAmountPoisha` on Payment; `PARTIALLY_REFUNDED`/`REFUNDED`; refund window; timeouts resolved through Refund Status; 10 per admin per day; audit and email.

**H8. MANAGER can rewrite bKash payment state without the gateway.**
`src/app/actions/admin-actions.ts:475-480` (`updateBooking`), `:526-567` (`cancelBookingWithRefundDecision`), `updateBookingStatus`
- **Wrong:** A MANAGER can set a bKash payment to `SUCCESS`/`REFUNDED`/`INITIATED` by editing the booking, record a refund that never happened, or confirm or cancel a booking mid-execute. This bypasses the OWNER-only refund rule.
- **Correct:** A bKash-scoped guard (like `assertBanglaQRStatusChangeAllowed`): bKash payment statuses are gateway-owned and can't be edited; bookings with an `EXECUTING` bKash payment can't change status; cancelling a booking with a bKash `SUCCESS` payment records "refund required" but not a refund, and points the OWNER to the refund flow. Other gateways are untouched.

**H9. Rate limiting is nearly absent and bypassable.**
`create/route.ts:17-33`
- **Wrong:** Only successful creates are counted, per booking, from a mutable log table. Nothing on callback, webhook, test-connection or refund. Every create costs up to two bKash calls (grant + create).
- **Correct:** The brief §9 table, DB-backed (works across PM2 workers), keyed on the Nginx `X-Real-IP` as in BanglaQR, audited, 429 + `Retry-After`. Per-booking limits are applied **after** token verification, so strangers can't lock a guest out (BanglaQR T16).

**H10. Guest PII and full transaction data in mutable logs.**
`create-payment.ts:79,103,123`, `execute-payment.ts:56,72,111,121`, `verify-payment.ts:33`, `refund-payment.ts:67,79,96`, `webhook/route.ts:35`, `callback/route.ts:74`
- **Wrong:** Full guest phone numbers, `customerMsisdn`, full bKash responses and raw webhook bodies are stored in `PaymentLog` (mutable, cascades on booking delete) and `Payment.rawWebhookPayload`. Full trxIDs appear in `BookingLog.note`. `console.error(err)` may print bKash response text.
- **Correct:** Audit rows go to `PaymentAuditLog` (append-only trigger already exists) with `provider = "BKASH"`, masked: phone → last 3 digits (`01XXXXXX324`), trxID → `AB****XY`, never tokens or secrets. `rawWebhookPayload` for bKash stores a masked, whitelisted subset. Existing `PaymentLog` writes are kept for backwards compatibility but carry masked payloads only.

### Medium

**M1. No signed booking token; the phone number comes from the client.**
`create/route.ts:11`, `create-payment.ts:50`, `BkashPaymentButton.tsx:47`
- **Wrong:** A booking UUID is the only credential. `payerReference` comes from the client, with a hardcoded `"01700000000"` fallback.
- **Correct:** `BKASH_TOKEN_SECRET` HS256 JWT (`bookingId`, `iat`, `exp` = 60 min, `jti`), issued by `POST /api/payments/bkash/token` on proof of `bookingId` + `bookingCode` (the same model as BanglaQR). `payerReference` is read from `booking.guest.phone`.

**M2. No schema validation on any bKash input.**
All five routes and the refund route.
- **Wrong:** Manual checks or none.
- **Correct:** Zod `.strict()` schemas for create, callback (D2), webhook (SNS envelope and inner message), refund and test-connection, plus response schemas for every bKash API call.

**M3. `merchantInvoiceNumber` reused across attempts; `paymentId` not unique.**
`create-payment.ts:59`, `prisma/schema.prisma` (Payment)
- **Wrong:** Every attempt for a booking sends the same invoice, and the invoice isn't stored. The webhook identifies payments **only** by invoice and trxID, so shared invoices make webhook→payment mapping ambiguous.
- **Correct:** Invoice per attempt (D3), stored in an additive `Payment.merchantInvoiceNumber` with a unique index; the execute and webhook invoice must equal the stored value; mismatches are a high-severity audit event.

**M4. The failure path strands the guest.**
`callback/route.ts:51-53,67-79,83`, `src/app/book/[roomId]/page.tsx`
- **Wrong:** Failure redirects to `/book/{roomId}?paymentStatus=…`, which nothing reads. The guest is back at step 1 with no message and no way back to their booking.
- **Correct:** A dedicated `/payment/bkash/result` page (failure/cancel/pending-verification states, bilingual, with a "try again" path that re-issues a token) that shows no booking PII. Redirects use 302 with `Cache-Control: no-store, no-cache, must-revalidate`.

**M5. No guest confirmation email on the bKash callback path; inventory handled inconsistently.**
`execute-payment.ts` (no email), `webhooks/payment/route.ts:76-93`
- **Wrong:** Guests who pay through the normal redirect never get a confirmation email. The generic router sends one (and decrements inventory); execute does neither.
- **Correct:** Section 13 notifications from the single fulfilment path, scheduled after commit (never failing the payment). Inventory is left as it is today on the execute path (adjacent A4 in the BanglaQR review), and the inconsistency is documented.

**M6. Test-connection is MANAGER-level, not rate-limited, and doesn't really test.**
`test-connection/route.ts:9,12,21-29`
- **Correct:** OWNER outside the try, 10 per admin per hour, a forced fresh grant, and a response exactly `{ success, environment, tokenExpiresIn }`.

**M7. No structured logging or correlation IDs.** `console.warn/error` at `webhook-verifier.ts:10`, `callback/route.ts:74`, `webhook/route.ts:48`.
- **Correct:** A `bkashLog` with `component: "bkash"` and `correlationId`, masking at the logger.

**M8. The database outage path is unhandled.**
`callback/route.ts:19` (outside try), create/refund return 500.
- **Correct:** Prisma connection errors → 503 with `Retry-After: 30`. The callback redirects to the result page in a "we're checking your payment" state; reconciliation finishes it.

**M9. No payment window.**
`create-payment.ts`, `execute-payment.ts`
- **Wrong:** Payment IDs stay executable for 24 h at bKash; we never check age.
- **Correct:** Refuse create after `paymentWindowMinutes` (default 60) from booking creation; refuse to execute an attempt older than the window. The guest isn't charged because execute never runs.

**M10. No append-only audit of the brief's §10 events.**
`PaymentLog` is mutable and misses callback-received, token, rate-limit, webhook-rejected and refund events.
- **Correct:** `PaymentAuditLog` with `provider: "BKASH"`, the brief's event list, and a correlation ID on every row.

**M11. No amount ceiling.**
- **Correct:** An owner-configurable cap (D8), checked at create.

**M12. Zero automated tests for bKash.**
- **Correct:** Section 16 test suites (unit + DB-backed against the `*_test` DB), and a `test:bkash:db` script mirroring BanglaQR's.

### Low

**L1. A sandbox base URL can run in production unnoticed.**
`client.ts:3-11`
- **Wrong:** `BKASH_BASE_URL` silently overrides `BKASH_IS_SANDBOX`; nothing stops a sandbox URL (or `BKASH_IS_SANDBOX=true`) in production.
- **Correct:** Readiness fails in production when the base URL host is `*.sandbox.bka.sh` or `BKASH_IS_SANDBOX=true`, unless `BKASH_ALLOW_SANDBOX_IN_PRODUCTION=true` is set explicitly for staging.

**L2. Credential getters default to `""`.**
`client.ts:13-27`
- **Wrong:** Not a secret fallback (the brief's grep is clean), but the empty-string default hides misconfiguration until the grant call.
- **Correct:** A single `requireBkashConfig()` that throws a typed `BKASH_UNAVAILABLE`.

**L3. The server-only boundary is not enforced.**
`src/lib/payments/bkash/*.ts`, `src/lib/payments/index.ts:8`
- **Correct:** Add `import "server-only"` to the bKash server modules (the package already ships with Next.js).

**L4. The callback URL derives from request headers when unset.**
`create/route.ts:35-37`
- **Correct:** In production, `BKASH_CALLBACK_URL` is required by readiness; header derivation is dev-only.

**L5. Webhook verifier nits.**
`webhook-verifier.ts:10,24-25`
- **Wrong:** It warns on every request and accepts non-hex input. Moot once D1 is adopted.

**L6. Test-connection returns `baseUrl`.**
`test-connection/route.ts:28`
- **Wrong:** Minor information disclosure.

**L7. Documentation overstates the current state.**
See [Corrections](#corrections-to-existing-documentation).

---

## Decisions Needed Before Section 1

These change the design the brief assumes. Each has a recommendation; approval of this document means approving the recommendations unless you note otherwise.

| # | Question | Recommendation |
|---|---|---|
| **D1** | **Webhook authentication.** The brief (§1.4, §8.1) specifies HMAC-SHA256 with `BKASH_WEBHOOK_SECRET`. bKash actually sends webhooks through **AWS SNS**, signed with an X.509 certificate, with no shared secret, and the payload has no `paymentID`. | Implement SNS signature verification with `node:crypto` (no new dependency): only `SignatureVersion` 1/2; `SigningCertURL` must be `https://sns.<region>.amazonaws.com/…pem`; the certificate is cached in memory; `TopicArn` must equal the new `BKASH_WEBHOOK_TOPIC_ARN` (constant-time compare); a `SubscriptionConfirmation` is auto-confirmed only for that topic (the host pin prevents SSRF). The webhook is treated as a **reconciliation trigger**: it resolves the payment by stored invoice and trxID, then confirms with Query Payment before fulfilling. `BKASH_WEBHOOK_SECRET` and the HMAC routes are retired. The §16.1 HMAC tests become SNS tests (missing, malformed, wrong certificate host, tampered body, wrong topic). **The brief's intent (fail closed, constant-time, idempotent, rate-limited, audited) is kept.** |
| **D2** | **Callback schema.** §2.2's `.strict()` schema allows only `paymentID` and `status`, but bKash also sends `signature` (and `apiVersion`). | `.strict()` with `paymentID`, `status`, and optional bounded `signature` and `apiVersion`; anything else is rejected. bKash doesn't publish the callback signature algorithm, so (per §4.3) it isn't verified; fulfilment relies on the server-side execute. |
| **D3** | **Invoice number.** §5.2 says invoice = `bookingCode` and "unique across all payments", which conflicts with retries (each attempt reuses the code). bKash wants a unique invoice per payment, and webhooks identify payments only by invoice. | Per attempt: `{bookingCode}-{4 random hex}` (via `randomBytes`), stored in a new `Payment.merchantInvoiceNumber` with a unique index. Execute and webhook must match the stored value. The `bookingCode` prefix keeps it readable in the bKash merchant portal. |
| **D4** | **Existing `INITIATED` attempt.** §1.1 says reject create if an `INITIATED` bKash payment exists. That locks out a guest who closed the bKash page. | A new create **supersedes** any `INITIATED` attempt in the same transaction (status `SUPERSEDED`). A superseded `paymentID` is never executed, so the guest can't be charged for it, and a late callback for it lands on "this payment link was replaced". `EXECUTING` or `SUCCESS` still blocks create, as §1.1 intends. |
| **D5** | **Where the booking guard runs.** §6.5 says reject fulfilment if the booking isn't `PENDING`, but by then bKash has already captured the money. | Guard **before** execute: lock the booking row (`SELECT … FOR UPDATE`) and hold it across the execute call (bounded by the 30 s timeout; interactive transaction timeout 40 s). Admin cancel and BanglaQR auto-release then wait instead of interleaving. If a capture ever can't be fulfilled (e.g. an out-of-band DB edit), the payment is recorded `SUCCESS`, the booking is left alone, and it is escalated to the OWNER as `CAPTURED_UNFULFILLED` for a refund. |
| **D6** | **Rate-limit storage.** BanglaQR's limiter uses `BanglaQRRateLimitHit`, and the rules say don't change BanglaQR. | A new gateway-neutral `PaymentRateLimitHit` table and `src/lib/payments/shared/rate-limit.ts`, used by bKash only. BanglaQR can migrate to it in a later phase. Audit reuses the existing `PaymentAuditLog` (it has a `provider` column, and its append-only trigger covers every row) with no BanglaQR code change. |
| **D7** | **Booking token delivery.** §1.1 needs a signed token, but the guest currently only receives `bookingId`. | `POST /api/payments/bkash/token` with `{ bookingId, bookingCode }` (the same proof as BanglaQR), rate-limited per IP, returning a 60-minute JWT. Create takes `{ bookingToken, amount }` as §2.1 specifies. `/api/bookings` is not changed. |
| **D8** | **Amount cap and settings.** §2.1 hardcodes ৳500,000. For BanglaQR (D3) you asked for caps in owner settings. | A `BkashSettings` singleton (OWNER + 2FA), editable on `/admin/settings/payments`: `maxAmountPoisha` (default ৳500,000), `paymentWindowMinutes` (60), `refundWindowDays` (7, per §7.2; bKash rejects late refunds, but its docs don't state the number, so **please confirm it with your merchant agreement**), `notifyEmail`. |
| **D9** | **Refund design.** bKash allows up to **10 partial refunds** per transaction and says to call Refund Status when there's no response within 30 s. | A new append-only `BkashRefund` table (request key, amount, reason, admin, role, bKash refund trxID, status `REQUESTED`/`COMPLETED`/`FAILED`/`UNKNOWN`) and additive `Payment.refundedAmountPoisha`. A second refund needs an explicit "additional refund" flag (§6.4). `UNKNOWN` is resolved by Refund Status (cron and a manual button). OWNER + 2FA; the modal requires choosing full or partial, a reason of at least 10 characters, and typing the exact amount. **Two-person approval: not in v1** (tradeoff documented). **Password re-entry: deferred to v1.1**; 2FA is already enforced for OWNER. The existing v1.2.0-beta refund endpoint is kept, pending sandbox confirmation (D10). |
| **D10** | **Sandbox access.** No bKash credentials are configured locally, so §16.2 steps 1 and 8 (and a live SNS test) can't run, and H5's request shapes can't be confirmed. | Either you provide your merchant's **sandbox** credentials in `.env` (never committed), or you approve using bKash's **publicly published** sandbox credentials locally. Without either, those steps are marked **NOT RUN** in the report, and every bKash call is tested against a local fake that follows the documented shapes. |
| **D11** | **Webhook and refund entry points.** Two bKash webhook routes exist, and the brief names a refund URL but also says refunds must be a Server Action. | Keep `/api/webhooks/payment/bkash` as the only webhook route and delete `/api/payments/bkash/webhook`. The generic router refuses `BKASH` (like BanglaQR). Refunds are a Server Action only. The shared `/api/admin/payments/refund` returns 400 for `BKASH` (pointing to the booking page); **its Nagad and SSLCommerz branches are unchanged**. |
| **D12** | **Abandoned sessions.** §12.3 marks payments `ABANDONED` after 2 h. | The payment becomes `ABANDONED`; the **booking stays `PENDING`** (no bKash booking auto-expiry in this phase; the guest can still pay within the window by another method). Documented as a known limit. |

---

## Outcome of the decisions (added after approval)

| # | As implemented |
|---|---|
| D1 | As recommended. SNS verification in `webhook-verifier.ts`; `BKASH_WEBHOOK_SECRET` retired |
| D2 | As recommended, and stronger. The sandbox showed that bKash puts the **same `signature` value on all three callback URLs it returns from create**. We store its hash at create and require it on the callback (compared with `timingSafeEqual`), so knowing a paymentID is no longer enough to trigger execute |
| D3–D8, D11, D12 | As recommended |
| D9 | **Changed:** refunds use the **v2** refund and refund-status APIs, not v1.2.0-beta. In the sandbox, v1's refund-status call returned only one of two partial refunds, so it can't settle partial refunds; v2 lists all of them |
| D10 | Read as approval to use bKash's **publicly published** sandbox credentials locally (never committed). Grant, create, execute, query, and v1 and v2 refunds were exercised against the real sandbox on 2026-09-29 |

Confirmed in the sandbox: the pre-hardening execute (`/execute/{paymentID}`) and query (`GET …/payment/status?paymentID=`) calls return **HTTP 403** from bKash's gateway (H5). The old code could not complete any bKash payment.

## Adjacent Findings (documented, not fixed in this phase)

| # | Location | Finding |
|---|---|---|
| A1 | `src/app/booking/confirmation/[id]/page.tsx:24-60` | The confirmation page is public by booking UUID and renders the guest's full name, email, phone, **NID/passport number** and address. The UUID is unguessable, but it appears in redirect URLs, browser history and `Referer` headers. All gateways redirect here, including bKash §1.2. Recommend a signed, short-lived view token or showing masked PII. |
| A2 | `src/lib/payments/banglaqr/release.ts:95-105` | BanglaQR auto-release expires any `PENDING` booking holding an `INITIATED` BanglaQR attempt, without checking other providers. A guest who opens BanglaQR and then pays by bKash can have the booking expired mid-execute. D5 (booking lock during execute) makes the bKash side safe: execute is refused if release wins. BanglaQR itself is not changed. |
| A3 | `src/app/api/admin/payments/refund/route.ts` (Nagad, SSLCommerz branches) | The same gaps as H7 for Nagad and SSLCommerz: `requireRole` inside the try (500 instead of 403), no amount ceiling, no idempotency, raw error messages. |
| A4 | `src/lib/payments/sslcommerz/refund.ts:67` | Refund reference ID uses `Math.random()`. |
| A5 | `src/app/api/webhooks/payment/route.ts:100-104` | For Nagad and SSLCommerz, any non-SUCCESS webhook cancels the booking even when it is already `CONFIRMED` (extends BanglaQR review A1). |
| A6 | `src/app/api/bookings/route.ts` | Public booking creation has no rate limit, no schema validation, and a `Math.random` booking code (BanglaQR review A2 still open). D7 makes `bookingCode` part of the proof for a bKash token, so its weak entropy matters more; mitigated by the per-IP token rate limit. |
| A7 | `src/app/actions/admin-actions.ts:475-480` | `updateBooking` lets a MANAGER set arbitrary payment status strings for **every** provider. The bKash half is fixed under H8; Nagad and SSLCommerz remain. |
| A8 | `src/app/actions/admin-actions.ts` (`updateBookingStatus`, `updateBooking`, `cancelBookingWithRefundDecision`) | `requireRole` runs inside `try`, so a denied user gets `{ error: "NEXT_HTTP_ERROR_FALLBACK;403" }` rather than a real 403. The denial still holds. The bKash guards added under H8 run after the role check and don't change this. *(Found during implementation.)* |

---

## Corrections to Existing Documentation

| Document | Claim | Reality |
|---|---|---|
| `PAYMENTS-BKASH.md` §1 | "Fulfillment only occurs after server-to-server execution **and status verification**" | Status verification (`verify-payment.ts`) is never called (C1) |
| `PAYMENTS-BKASH.md` §1 step 2 | Create "validates the payment amount against the booking total" | Create doesn't take an amount; it *uses* the DB total. Execute validates, fail-open (H5) |
| `PAYMENTS-BKASH.md` §4 | "Prevents duplicate payments for the same booking" | App-level check only, racy, 15-minute window (H1) |
| `PAYMENTS-BKASH.md` §4 | "Replay Protection: callback handlers check for already-executed payment records" | Only when the booking is exactly `CONFIRMED`; a replay otherwise corrupts the record (C2) |
| `PAYMENTS-BKASH.md` §4 | "Every transaction step is recorded in `PaymentLog`… redacted" | Full phone numbers and bKash responses are stored unredacted (H10) |
| `PAYMENTS-BKASH.md` §4 | Rate limiting "5 attempts per booking per hour" | Counts successes only; no IP limit (H9) |
| `PAYMENTS-BKASH.md` §5 | "Settings & Testing… verify API credentials" | Uses the cached token, so it doesn't re-test credentials (M6) |
| `PAYMENTS-BKASH.md` §2 | `BKASH_WEBHOOK_SECRET` "hmac webhook secret" | bKash webhooks are SNS-signed; no shared secret exists (D1) |
| `prisma/schema.prisma` `PaymentLog` comment | "JSON, redacted of secrets" | Not redacted of PII (H10) |

### Evidence commands (re-runnable)

```bash
# Brief §16.3 greps against the current code
grep -rn "BKASH_WEBHOOK_SECRET\|BKASH_APP_SECRET\|BKASH_PASSWORD" src/ | grep -v "process.env"
# → src/lib/payments/bkash/webhook-verifier.ts:10: console.warn("BKASH_WEBHOOK_SECRET is not configured.");   (log text, not a value)
grep -rn "timingSafeEqual" src/lib/payments/bkash/
# → src/lib/payments/bkash/webhook-verifier.ts:31
grep -rn "id_token\|idToken" src/ | grep -v "token-manager.ts"
# → types.ts:33 (response type); test-connection/route.ts:12,14; create-payment.ts:47,67;
#   execute-payment.ts:30,38; refund-payment.ts:33,49; verify-payment.ts:15,22
#   All are "get token → Authorization header". None logs or returns it.

# H5/C1: verifyPaymentStatus is never called
grep -rn "verifyPaymentStatus" src | grep -v "bkash/verify-payment.ts"
# → (no output)

# M4: nothing reads the paymentStatus query param the callback redirects with
grep -rn "paymentStatus" src/app/book src/components/travel/BookingStepper.tsx
# → (no output)

# H4: token cache (mocked fetch; script in the section 0.2 evidence block)
# → grant calls for 10 concurrent requests: 10
```

### External references

- bKash — Webhooks (SNS delivery, payload fields): https://developer.bka.sh/docs/webhooks.md
- bKash — Token management (1 h lifetime, refresh limit 2/h, 1 h block): https://developer.bka.sh/docs/token-management-overview-3.md
- bKash — Create Payment (unique invoice, callback params incl. `signature`, 24 h payment ID expiry): https://developer.bka.sh/docs/create-payment-1.md
- bKash — Execute Payment (`paymentID` in the JSON body): https://developer.bka.sh/docs/execute-payment-1.md
- bKash — Refund (up to 10 partial refunds; Refund Status after 30 s with no response): https://developer.bka.sh/docs/refund-transaction-4.md
- bKash — Error codes (2062, 2117 already completed; 2056 invalid state; 2029 duplicate): https://developer.bka.sh/docs/error-codes.md

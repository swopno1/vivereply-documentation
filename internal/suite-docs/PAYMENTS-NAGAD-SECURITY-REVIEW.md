# Nagad Security Review — Discovery & Gap Analysis

| | |
|---|---|
| **Date** | 2026-09-30 |
| **Branch** | `hardening/nagad` (from `main` @ `829b9cc`, which includes the hardened BanglaQR and bKash work) |
| **Scope** | Every Nagad route, library module and adapter, plus the guest and admin code that calls them and the shared code they depend on: the generic webhook router, the shared refund route, `updateBooking` and `cancelBookingWithRefundDecision`, availability, and the booking detail refund UI |
| **Method** | Line-by-line read of the code, not the docs. The RSA claims were re-checked by running the repo's own `crypto.ts` against locally generated key pairs (scripts under [Evidence](#evidence-commands-re-runnable)). Nagad's API behaviour was compared against three public SDKs and a community write-up of Nagad's integration guide, because Nagad publishes no open developer portal (see [External references](#external-references)) |
| **Status** | **Approved 2026-09-30** (D1–D12 as recommended). Implemented in Sections 1–14 on `hardening/nagad`; see the [verification report](PAYMENTS-NAGAD-VERIFICATION.md) and [PAYMENTS-NAGAD.md](PAYMENTS-NAGAD.md) |

## Summary

The Nagad integration is **not production-safe**. It is also likely that **it has never completed a real payment**.

There are five Critical findings.

1. **A genuine successful payment is marked `FAILED` at the callback, and the booking is never confirmed.** Real Nagad callbacks carry `status_code=00_0000_000`. The callback route treats any `status_code` other than `"000"` as a failure (`callback/route.ts:54`). It writes `FAILED` and redirects before verify is ever called. The guest has paid and the booking stays `PENDING`. Nothing reconciles it.
2. **Anyone can cancel a booking, or inflate revenue and drain room inventory, through the generic webhook router.** `POST /api/webhooks/payment` with `{"provider":"NAGAD","payment_ref_id":"…"}` has no authentication: the RSA check runs only if the attacker chooses to send a signature header.
   - For an unpaid session it cancels the booking.
   - For a paid one, every call adds another `SUCCESS` payment row, decrements `availableUnits` and sends another confirmation email.
   - Nagad has no documented server-to-server webhook, so attackers are the only callers this route will ever have.
3. **Payment records have no state machine.** `GET /api/payments/nagad/callback?payment_ref_id=<id>&status=Aborted` overwrites any Nagad payment, including a `SUCCESS` one, to `FAILED`. It needs only the reference ID, which sits in the guest's URL bar and history. Verify also re-runs on settled rows and sets the booking `CONFIRMED` unconditionally, which revives a cancelled booking.
4. **Cancelled, expired and already-paid bookings can be paid through Nagad.** Initialize refuses only `CONFIRMED`, `CHECKED_IN` and `COMPLETED`, and only looks at Nagad payments. A booking already paid by bKash or BanglaQR can be charged again.
5. **A payment whose callback never arrives is never reconciled, and it locks the booking.** In Nagad the money moves on Nagad's page, before we hear anything. If the browser closes, the row stays `INITIATED` forever. Initialize then refuses every retry for that booking ("already in progress"), and no cron checks the payment.

**Nagad has probably never worked (High H1, unconfirmed without a sandbox).** The client checks the RSA signature on Nagad's initialize response over the **encrypted** `sensitiveData` string. Nagad's integration guide signs the **decrypted plaintext**. A local simulation with Nagad-style signing shows the current check rejects a genuine response. The payment button would then fail with "RSA signature verification failed" on every attempt. This matches the pattern in the bKash review, where the old execute call got HTTP 403 from the real sandbox.

Four findings change the design the brief assumes (see [Decisions](#decisions-needed-before-section-1)):

- **Only Nagad's initialize response is signed.** The complete and verify responses are plain JSON over TLS. §1.4 and §3.4 ("RSA-verify the verify response before parsing") can't be done as written (D1).
- **A public `/complete` endpoint would send the challenge to the browser.** Today both phases run server-side in one request, so the challenge never leaves the server. That's the safer design, and §3.2 and §2.2 would undo it (D2).
- **Real callbacks carry eight query parameters.** They are `merchant`, `order_id`, `payment_ref_id`, `status`, `status_code`, `message`, `payment_dt` and `issuer_payment_ref`. Status values are `Success`, `Aborted` and so on, not `Failure` or `Cancel`. `payment_ref_id` is base64 and can end in `=`. The §2.3 `.strict()` schema would reject every real callback (D3).
- **The §3.6 test-connection "handshake" can't work with correctly configured keys.** It encrypts with *Nagad's* public key and decrypts with *our* private key, which belong to different key pairs. The current test-connection does exactly this. It **fails when the keys are right** and **passes only when the keys are wrong**, i.e. when our own public key was pasted in as Nagad's (H9, D9).

Totals: **5 Critical, 12 High, 11 Medium, 6 Low** (34 gaps). There are also 6 adjacent findings in shared or other-gateway code.

Legend for all tables: ✅ Mitigated · ⚠️ Partial · ❌ Unmitigated

---

## 0.1 Endpoint Inventory

```
$ find src/app/api -type d -name "*nagad*"
src/app/api/payments/nagad
src/app/api/admin/payments/nagad
src/app/api/webhooks/payment/nagad

$ find src/app/api -path "*nagad*" -name "route.ts"
src/app/api/payments/nagad/callback/route.ts
src/app/api/payments/nagad/create/route.ts
src/app/api/webhooks/payment/nagad/route.ts
src/app/api/admin/payments/nagad/test-connection/route.ts

$ find src/lib/payments/nagad -type f
adapter.ts (107)  client.ts (125)  complete-initialization.ts (127)  crypto.ts (88)
index.ts (7)  initialize-payment.ts (147)  refund.ts (124)  verify-payment.ts (184)      = 909 lines
```

Three more entry points reach Nagad logic and are covered below:
- the generic router `POST /api/webhooks/payment`, which the Nagad webhook route re-exports;
- the shared refund route;
- two admin server actions.

### E1. `POST /api/payments/nagad/create`
File: `src/app/api/payments/nagad/create/route.ts` → `adapter.ts` → `initialize-payment.ts` + `complete-initialization.ts`

| Property | Current state |
|---|---|
| Purpose | Runs phase 1 (initialize) and phase 2 (complete) server-side in one request and returns Nagad's checkout `callBackUrl` |
| Auth | ❌ None. A raw `bookingId` (UUID) from the body is the only credential (`:12`) |
| Rate limit | ⚠️ 5 per booking per hour, counted from `PaymentLog` rows with event `PAYMENT_INITIATED` (`:27-43`). Failed attempts don't count, there is no per-IP limit, and the check-then-act is racy. Each request costs 4 RSA operations and 2 Nagad calls, which makes it an amplifier |
| Validation | ❌ Destructuring with no schema (`:12`). `customerPhone` and `customerEmail` are accepted from the client (`:55-56`). They reach `completeInitialization` but aren't sent to Nagad |
| Booking checks | ❌ Refuses only `CONFIRMED`, `CHECKED_IN` and `COMPLETED`, and only an existing **Nagad** `SUCCESS` or `INITIATED` payment (`initialize-payment.ts:69-82`). `CANCELLED`, `EXPIRED`, `PENDING_MANUAL_VERIFICATION`, and bookings already paid by another gateway are all accepted. No payment window |
| Output | `{ success, paymentId, callBackUrl }`. `paymentId` is Nagad's `paymentReferenceId` (§10.3 says don't return it; it's also inside `callBackUrl`) |
| Errors | ❌ Returns the raw `err.message` with 500 (`:60-75`). That includes missing env var **names** (`availability.ts:65`), Nagad `reason` text, "Nagad API response RSA signature verification failed.", JSON parse errors, and "Booking not found" (an existence oracle). No correlation ID |
| Idempotent | ❌ No. The "already in progress" check is check-then-insert, and the `Payment` row is created only **after** both Nagad calls (`complete-initialization.ts:86`). Two concurrent requests both open Nagad sessions, and both are payable |
| Callback URL | ⚠️ Falls back to the `Host` / `X-Forwarded-Proto` headers (`:45-48`). In practice this is dead code, because readiness requires `NAGAD_CALLBACK_URL`. `client.ts:26-31` also has a hardcoded `localhost` fallback |

### E2. `GET` and `POST /api/payments/nagad/callback`
File: `src/app/api/payments/nagad/callback/route.ts`

| Property | Current state |
|---|---|
| Purpose | Nagad redirects the guest here after checkout. It should verify server-side and then redirect |
| Auth | ❌ None, as with every gateway callback. Nagad's callback carries no signature. `order_id` and `merchant` are ignored, so nothing binds the request to the attempt |
| Rate limit | ❌ None. Every hit with a known reference writes a `PaymentLog` row (`:38-46`) |
| Validation | ❌ Three aliases for the reference (`:7-10`). No schema, no format check. `POST` is also accepted (`:95-97`) |
| State changes | ❌ `status` ∈ {Failed, Aborted, Cancel, Cancelled} **or** `status_code` ≠ `"000"` rewrites the payment to `FAILED`/`CANCELLED` **without verify, whatever its current status** (`:49-61`). The real success code is `00_0000_000` (C1) |
| Fulfilment | ✅ Otherwise calls `verifyPayment` before redirecting to the confirmation page (`:70-76`). But see C3 and H4 for how verify itself behaves |
| Output | 307 redirects with `Cache-Control: no-store` ✅. Failures go to `/book/{roomId}?bookingId=…&paymentStatus=…`, and **nothing reads `paymentStatus`** (`grep` returns no output), so the guest gets no message (M4). An unknown reference goes to `/?paymentError=invalid_payment_ref_id`, not the 400 with a correlation ID that §4 asks for |
| Idempotent | ❌ No. A replay re-runs verify and rewrites the row every time (C3) |
| Availability | ❌ Doesn't call `assertPaymentProviderAvailable` (the doc's §7 says every route does) |

### E3. `POST /api/webhooks/payment/nagad` and `POST /api/webhooks/payment`
Files: `src/app/api/webhooks/payment/nagad/route.ts` (re-exports the generic router), `src/app/api/webhooks/payment/route.ts`, `adapter.ts:55-104`

| Property | Current state |
|---|---|
| Purpose | Generic "gateway webhook". Nagad has **no documented server-to-server notification**, so no genuine caller exists |
| Auth | ❌ Signature verified **only if** the caller sends an `x-nagad-signature` or `x-signature` header **and** the body has `sensitiveData` (`adapter.ts:69`). Otherwise it proceeds straight to `verifyPayment(payment_ref_id)` |
| Provider | ❌ Taken from the request body (`route.ts:18`); the Nagad path accepts any `provider: "NAGAD"` body |
| Effects | ❌ On every call: `prisma.payment.create` with a **new** row (`route.ts:57-66`). On success: booking `CONFIRMED`, `room.availableUnits` decremented (`:76-81`), and a confirmation email sent (`:84-93`). On anything else: **booking `CANCELLED`** (`:101-104`), even if it was confirmed |
| Idempotent | ❌ No. Each replay adds a `SUCCESS` payment row (double revenue), takes another unit, and sends another email |
| Rate limit / errors | ❌ None. The body is logged to `console.error` on exceptions |

### E4. `POST /api/admin/payments/nagad/test-connection`
File: `src/app/api/admin/payments/nagad/test-connection/route.ts`

| Property | Current state |
|---|---|
| Auth | ⚠️ `requireRole("MANAGER")` (`:19`); §3.6 says OWNER. It runs **inside** `try`, so a denied user gets a 500 whose message includes `NEXT_HTTP_ERROR_FALLBACK;403`. No MFA gate |
| Rate limit | ❌ None |
| Behaviour | ❌ **The logic is inverted** (H9). It encrypts with Nagad's PG public key and decrypts with our merchant private key (`:51-54`), which belong to different key pairs. With correct keys, PKCS#1 v1.5 implicit rejection returns random bytes and the route reports "handshake check failed". It reports success only if `NAGAD_PG_PUBLIC_KEY` holds **our own** public key, and that misconfiguration would then fail every real payment. `signatureVerified` (sign with ours, verify with Nagad's) is always `false` for a correct setup |
| Output | ❌ Returns `merchantId` and `baseUrl` (`:41-42,68-69`) plus raw error messages (`:73-76`). §3.6 wants only `{ success, environment, keySizeBits }` |
| Key checks | ❌ No PEM parse, no key size, no check that the private key matches its public half |

### E5. `POST /api/admin/payments/refund` (shared by all gateways)
Files: `src/app/api/admin/payments/refund/route.ts:51-57`, `src/lib/payments/nagad/refund.ts`, and the UI at `src/app/admin/bookings/[id]/BookingDetailView.tsx:830-835`

| Property | Current state |
|---|---|
| Auth | ⚠️ `requireRole("OWNER")` ✅, but inside `try` (a denial becomes a 500). No MFA. Raw JSON route, where §3.5 asks for a Server Action |
| Validation | ❌ `paymentId`, optional `amountPoisha` (`AmountSchema`: positive integer only) and optional `reason`, which defaults to "Admin initiated refund". No ceiling: a refund larger than the payment is sent to Nagad |
| Nagad call | ❌ Posts a **plaintext, unsigned** JSON body to `/api/dfs/refund/payment` (`refund.ts:43-58`). The public SDKs use `POST …/purchase/cancel?paymentRefId=…&orderId=…` with an RSA-encrypted `sensitiveDataCancelRequest` and a `signature`, and get back an encrypted `sensitiveData` (H7) |
| Result | ❌ Success is decided by `status === "Success" || statusCode === "000"`. The refund transaction ID is **fabricated** (`REF_${Date.now()}`) when Nagad sends none (`:61`). **Any** refund, partial or full, sets the payment to `REFUNDED` (`:67-69`) |
| Idempotent | ❌ No. Two clicks send two refunds; there is no ledger |
| Output / errors | ❌ Raw error messages (`route.ts:78-81`) |

### E6. Internal functions (not routes)

| Function | Called from | Notes |
|---|---|---|
| `initializePayment` (`initialize-payment.ts:55`) | adapter only | Phase 1. Decrypts Nagad's response without schema or merchant check (`:123-124`) |
| `completeInitialization` (`complete-initialization.ts:36`) | adapter only | Phase 2. Sends `merchantCallbackUrl`; the SDKs send `merchantCallbackURL` (M2). Creates the `Payment` row only after Nagad succeeds |
| `verifyPayment` (`verify-payment.ts:19`) | callback, adapter (webhook) | No status guard, no lock, no schema, OR-ed success test, fail-open amount, no `orderId`/`merchantId` check (C3, H4) |
| `refundPayment` (`refund.ts:22`) | shared refund route | See E5 |
| `nagadFetch` (`client.ts:55`) | all of the above | Throws only on HTTP ≥ 400. Nagad reports errors as **HTTP 200** with `reason`, `message` or `devMessage` (the SDKs' `request.ts` handles it this way), so a failure body flows on as data (H3). Checks the signature over the wrong bytes (H1) |

### E7. Admin server actions that touch Nagad payments

| Action | Gap |
|---|---|
| `updateBooking` (`admin-actions.ts:390`, MANAGER) | Writes any string to `payment.status` for any Nagad payment (`:490-495`). A MANAGER can mark a Nagad payment `REFUNDED` or `SUCCESS` with no gateway call. bKash got a guard for this (bKash H8); Nagad didn't (bKash review A7) |
| `cancelBookingWithRefundDecision` (`:541`, MANAGER) | For a booking with a Nagad `SUCCESS` payment, "refund: yes" writes a refund note but calls no gateway (`:564-596`). The booking log says refunded; nobody was refunded |

---

## 0.2 RSA Key Material Review

| Question | Finding |
|---|---|
| Where is the private key read from? | ✅ `process.env.NAGAD_MERCHANT_PRIVATE_KEY` only (`client.ts:18-20`). No file or DB path. The `grep` in [Evidence](#evidence-commands-re-runnable) shows other occurrences only in a comment (`crypto.ts:7-10`) and one error string (`test-connection/route.ts:39`) |
| Ever logged, returned or exposed to the client? | ✅ Not directly: no code path logs or returns the key. Two indirect risks: ⚠️ `verifyWithPublicKey` logs the whole crypto error object with `console.error` (`crypto.ts:78`); Node's messages don't include key bytes, but this is unreviewed output on a production path. ⚠️ The barrel `index.ts` re-exports `getNagadMerchantPrivateKey` and the crypto helpers, so a client component could import them by mistake. In the browser `process.env` would be empty and the build wouldn't inline it; this is a guardrail gap (L2), not a leak |
| How is the public key loaded? | `process.env.NAGAD_PG_PUBLIC_KEY` (`client.ts:22-24`), passed through `formatPemKey` on **every** call |
| Padding | ✅ `RSA_PKCS1_PADDING` (PKCS#1 v1.5) for both encrypt and decrypt (`crypto.ts:37,52`). This matches Nagad's guide ("OPENSSL_PKCS1_PADDING") and all three SDKs. OAEP is not used |
| Signature algorithm | ✅ RSA-SHA256 (`crypto.ts:62,72`), matching the guide ("SHA256withRSA") |
| Signature verified on every Nagad response? | ❌ Only when the response has `sensitiveData` (`client.ts:106`), i.e. only initialize. Complete and verify are unsigned by Nagad's design (D1). **And the one check that runs covers the wrong bytes**: the encrypted base64 string, not the decrypted plaintext Nagad signs (H1; simulation in Evidence) |
| Unsigned or invalid signature? | ✅ Rejected by throwing (`client.ts:108-114`), which is fail closed for initialize. ❌ But the webhook adapter skips the check when no signature header is sent (`adapter.ts:69`, C2) |
| Keys validated on startup? | ❌ No. Readiness checks only that the vars are non-empty (`client.ts:33-40`). A 1024-bit key is accepted (simulation). A garbage string is wrapped in PEM armour by `formatPemKey` (`crypto.ts:13-28`) and fails only mid-payment, as a raw error shown to the guest. No check that the merchant private key and PG public key are different key pairs (H10) |
| `\n` normalisation | ✅ `formatPemKey` replaces literal `\n` (`crypto.ts:15`), and a bare base64 body gets armour and 64-column lines. ⚠️ A bare body is assumed to be PKCS#8 (`BEGIN PRIVATE KEY`). If Nagad's portal issues a PKCS#1 body (`BEGIN RSA PRIVATE KEY`), it would be mislabelled. We'll parse with `crypto.createPrivateKey`, trying both forms, and record which one loaded. **Deployment note:** Vercel, Docker `--env-file` and most `.env` loaders keep `\n` as two characters. That's the most common cause of "error:1E08010C:DECODER routines::unsupported" at payment time |
| Decryption oracle | ✅ By design: we only ever decrypt Nagad's own responses, fetched by us over TLS; no route decrypts attacker-supplied ciphertext. Node 24 / OpenSSL 3.5 also uses **implicit rejection** for PKCS#1 v1.5 decrypt: a tampered ciphertext returns random bytes instead of throwing (50/50 in the Evidence script). ❌ The code then runs `JSON.parse` and returns the raw `SyntaxError` to the guest. It isn't an oracle, but decrypted output must be JSON-parsed, schema-checked and signature-checked, and all three failures must map to one generic error (H2) |
| Environment / key pairing | ❌ `NAGAD_IS_SANDBOX` **defaults to sandbox** when unset (`client.ts:8`), and `NAGAD_BASE_URL` accepts any URL (`:5-6`). A production deploy that forgets the flag talks to the sandbox, where test wallets "pay" and verify says `Success`: bookings are confirmed with play money. There's no check tying the keys to the environment (a sandbox PG key against the production host, or the reverse, surfaces only as H1-style failures) |

---

## 0.3 Two-Phase Initialization Review

| Question | Finding |
|---|---|
| What's stored between phase 1 and phase 2? | Nothing in the DB. Both phases run in one server request (`adapter.ts:15-37`); `paymentReferenceId` and Nagad's `challenge` are held in memory between them. ✅ The challenge **never reaches the browser**. ❌ A crash between the phases, or after phase 2 but before `payment.create` (`complete-initialization.ts:86`), leaves a live Nagad session with no row, so no reconciliation can find it |
| How is the challenge protected from tampering? | ✅ It arrives inside `sensitiveData`, RSA-encrypted to our key, and (per the guide) signed by Nagad. It goes back to Nagad inside our encrypted, signed phase-2 payload. The browser never sees it. ❌ Because of H1 the signature isn't actually verified on the right bytes, and the decrypted object isn't schema-checked (`merchantId` in it isn't compared) |
| Stale `paymentReferenceId` in phase 2? | Not reachable from outside: phase 2 uses the value phase 1 just returned. Nagad's session lifetime isn't published |
| Phase 2 called twice for one reference? | Not possible through a route today (no public `/complete`). The brief's §3.2 would add that surface; D2 recommends against it |
| Phase 1 `sensitiveData` decrypted and validated? | ⚠️ Decrypted with the merchant private key ✅. `JSON.parse` only, with a type cast (`initialize-payment.ts:124`). `paymentReferenceId` and `challenge` can come back `undefined`, and the row would then be written with `paymentId: null` (H2) |
| Phase 1 response signature verified before use? | ❌ Verified before decrypting, over the ciphertext (H1). Per the guide, the correct order is decrypt → verify the signature over the plaintext bytes → parse → schema |
| Our own challenge (phase 1 request) | ✅ `crypto.randomBytes(10)` as hex = 80 bits (`crypto.ts:86-88`). No `Math.random` anywhere in the Nagad code |
| `orderId` | ❌ `booking.bookingCode` (`RES-######`, generated with `Math.random`, 900,000 values), **reused for every attempt** on a booking. Nagad rejects duplicate order IDs per merchant (reported by SDK users; not in a public spec), so a guest whose first attempt failed may never be able to retry. The hyphen may also be refused (the guide examples are alphanumeric, ≤ 20 chars). Unconfirmed without a sandbox (M6) |
| Timestamps | ✅ `getDhakaFormattedTimestamp` uses `Intl` with `timeZone: "Asia/Dhaka"`, independent of the server's `TZ`. Checked at the Dhaka midnight boundary on Node 24: `2026-09-29T18:00:05Z → 20260930000005`, `17:59:59Z → 20260929235959` ✅. ⚠️ `hour12: false` returns `"24"` for midnight on older ICU builds; `hourCycle: "h23"` is the robust option (L5) |

---

## 0.4 Data Flow & Trust Boundaries

```mermaid
sequenceDiagram
    autonumber
    participant G as Guest browser (untrusted)
    participant S as Our server (trusted)
    participant DB as Postgres
    participant N as Nagad API (TLS; signs only initialize)
    participant A as Anyone on the internet

    G->>S: POST /api/bookings (room, dates, guest PII)
    S->>DB: Booking PENDING (bookingCode RES-######)
    S-->>G: { id (UUID), bookingCode, total }
    G->>S: POST /api/payments/nagad/create { bookingId, customerPhone?, customerEmail? }
    Note over G,S: ❌ TB1: raw bookingId is the only credential; booking state barely checked
    S->>N: check-out/initialize/{merchantId}/{orderId=bookingCode}<br/>enc(PG pub){merchantId, datetime, orderId, challenge} + sign(merchant priv)
    N-->>S: { sensitiveData: enc(merchant pub){paymentReferenceId, challenge, acceptDateTime}, signature }
    Note over S,N: ❌ TB2: signature checked over ciphertext, not plaintext (H1); no schema
    S->>N: check-out/complete/{paymentReferenceId}<br/>enc{merchantId, orderId, amount (from DB ✅), currencyCode, challenge} + sign
    N-->>S: { status, callBackUrl } (unsigned)
    S->>DB: Payment INITIATED (only now; no unique index)
    S-->>G: { paymentId, callBackUrl }
    G->>N: Guest pays with wallet PIN/OTP on Nagad's page (MONEY MOVES HERE)
    N-->>G: 302 → /api/payments/nagad/callback?merchant&order_id&payment_ref_id&status&status_code=00_0000_000&…
    G->>S: GET callback
    Note over G,S: ❌ TB3: status/status_code trusted to write FAILED; real success code misread (C1)
    S->>N: GET verify/payment/{paymentReferenceId}
    N-->>S: { merchantId, orderId, paymentRefId, amount, status, statusCode, issuerPaymentRefNo, … } (unsigned)
    Note over S,N: ❌ TB4: OR-ed success test, fail-open amount, orderId/merchantId unchecked (H4)
    S->>DB: Payment SUCCESS + Booking CONFIRMED (no guard, no lock)
    S-->>G: 307 → /booking/confirmation/{bookingId}
    A->>S: POST /api/webhooks/payment { provider: "NAGAD", payment_ref_id }
    Note over A,S: ❌ TB5: no auth; cancels, duplicates, decrements inventory (C2)
```

| Boundary | What crosses it | Current trust |
|---|---|---|
| TB1 Guest → create | `bookingId`, `customerPhone`, `customerEmail` | All trusted. Booking state barely checked |
| TB2 Nagad → us (initialize) | encrypted `sensitiveData`, `signature` | Signature checked over the wrong bytes; decrypted JSON trusted by cast |
| TB3 Guest → callback | `payment_ref_id`, `status`, `status_code` (+ `order_id`, `merchant`, … ignored) | `status` and `status_code` rewrite payment state; the reference is looked up but not format-checked |
| TB4 Nagad → us (verify) | plain JSON over TLS | TLS only (the host isn't pinned; `NAGAD_BASE_URL` is free text); fields partly checked |
| TB5 Internet → generic webhook | any JSON | Effectively none |
| TB6 Admin → refund / status edit | `paymentId`, amount, reason, status | OWNER for API refunds, but MANAGER can bypass through `updateBooking` and "record" a refund through `cancelBookingWithRefundDecision` |

---

## 0.5 Threat Model

| # | Threat | Status | Evidence / what's missing |
|---|---|---|---|
| T1 | Attacker forges the callback redirect (query params tampered) | ❌ Unmitigated | `status=Aborted` (or any `status_code` ≠ `000`) rewrites **any** payment, `SUCCESS` included, without verify (`callback/route.ts:49-61`). Fulfilment still needs verify ✅ |
| T2 | Replays a legitimate callback URL with a different `payment_ref_id` | ⚠️ Partial | The reference resolves to its own row and booking, so another booking can't be confirmed ✅. But any known reference can be driven to `FAILED` (T1), and replays re-run verify on settled rows (T7). `order_id` isn't checked against the attempt |
| T3 | Attacker calls verify with someone else's `paymentReferenceId` | ❌ Unmitigated | Verify isn't a route, but it's reachable through the callback and, with no auth, through the generic webhook router (C2). The webhook path turns a non-success verify result into a **booking cancellation** |
| T4 | Races two bookings through the same `paymentReferenceId` | ⚠️ Partial | One reference maps to the one booking whose `orderId` Nagad signed ✅. But `Payment.paymentId` has no unique index for Nagad, and the webhook router **inserts new rows**, so one reference can end up with many `SUCCESS` rows (C2, H6) |
| T5 | Causes RSA verification to be skipped (missing public key, malformed signature) | ⚠️ Partial | `nagadFetch` rejects a missing key or signature on an encrypted response ✅. The webhook adapter skips verification when the signature header is absent ❌ (`adapter.ts:69`). A malformed key isn't caught at load (H10) |
| T6 | Valid signature, tampered body | ⚠️ Partial | For initialize, the signature covers the plaintext (per the guide), so a tampered ciphertext fails it once H1 is fixed; today the check is over the ciphertext. Verify and complete responses are unsigned: TLS is the only integrity (D1). Once decrypted, nothing checks `merchantId` |
| T7 | Callback triggered twice (Nagad retry, refresh) → double fulfilment | ❌ Unmitigated | No status guard, lock or claim. Each callback re-runs verify, rewrites the row and sets the booking `CONFIRMED` (`verify-payment.ts:87-110`). Through the webhook router, each replay adds a payment row, takes a room unit and sends an email |
| T8 | Verify says `Success` for a payment that was later refunded | ❌ Unmitigated | A replay after a refund re-runs verify. If Nagad still reports `Success` for the original purchase (likely; refunds are separate cancel records, `cancelIssuerRefNo`), the row goes `REFUNDED → SUCCESS` and a cancelled booking goes back to `CONFIRMED` |
| T9 | Amount tampering between initialize and complete | ⚠️ Partial | The amount comes from the DB ✅ and is signed inside `sensitiveData` ✅. Verify compares Nagad's amount with the **live** booking total, which a MANAGER can edit mid-payment; it skips the check when Nagad's `amount` is absent (fail open; `verify-payment.ts:42-44`) |
| T10 | `merchantOrderId` (booking code) collision or reuse | ❌ Unmitigated | `orderId = bookingCode` for every attempt; not stored per attempt; not checked in verify. Booking codes use `Math.random` with 900,000 values (bKash A6) |
| T11 | Timezone-related replay (Asia/Dhaka boundaries) | ⚠️ Partial | The timestamp is correct across Dhaka midnight regardless of server `TZ` ✅. Nothing checks Nagad's `acceptDateTime` or `payment_dt` against our attempt window, so a session can be paid days later and still confirm (M8) |
| T12 | Private key leaked through an env dump, log line or error stack | ⚠️ Partial | Not logged or returned ✅. `console.error(err)` on verify failures; raw errors returned to clients (none include key bytes, but nothing prevents it); no redaction layer; no PEM-shaped-string guard on logs |
| T13 | Sandbox signature used against production (or the reverse) | ❌ Unmitigated | Sandbox is the default when `NAGAD_IS_SANDBOX` is unset, and the base URL is free text. Nothing refuses sandbox hosts in production (H10). Key/host mismatch is detected only indirectly |
| T14 | RSA decryption oracle (different errors for padding vs signature failure) | ⚠️ Partial | No route decrypts attacker ciphertext ✅; Node 24 uses implicit rejection ✅. Errors do differ in text ("RSA signature verification failed" vs a `SyntaxError`), and both reach the guest. They need to become one generic error |
| T15 | Unauthenticated booking cancellation / inventory drain | ❌ Unmitigated | Generic webhook router (C2) |
| T16 | Paid, never-confirmed payments | ❌ Unmitigated | C1 (success misread) and C5 (no reconciliation) |
| T17 | Refund abuse or double refund | ❌ Unmitigated | No ledger, no idempotency, no ceiling, no MFA; MANAGER bypasses (H7, E7) |
| T18 | Error-message information leak | ❌ Unmitigated | create, test-connection, refund (H8) |

---

## 0.6 Test Coverage Gap

```
$ find src -path "*nagad*" -name "*.test.ts" | wc -l
0
$ find src/lib/payments/bkash -name "*.test.ts" | wc -l
15          (157 DB-backed tests, per docs/PAYMENTS-BKASH-VERIFICATION.md)
$ find src/lib/payments/banglaqr -name "*.test.ts" | wc -l
11          (96 DB-backed tests, per docs/PAYMENTS-BANGLAQR-VERIFICATION.md)
```

Confirmed: **Nagad has no tests.** Nothing exercises the RSA helpers, the two-phase flow, the callback, verify, refunds or the adapter. Every Critical finding above would have been caught by a single happy-path test against a Nagad-shaped fake: C1 by a real `status_code`, H1 by a real signature. Section 13 builds the suite; §13 of the brief lists what it must cover.

---

## 0.7 Gap List (severity order)

### Critical

**C1. A real successful callback is marked `FAILED` before verify; the guest is charged and the booking isn't confirmed.**
`src/app/api/payments/nagad/callback/route.ts:49-67`
- **Wrong:** The route writes `FAILED` or `CANCELLED` whenever `status` is Failed/Aborted/Cancel/Cancelled **or** `status_code` isn't `"000"`. Nagad's documented success callback has `status=Success&status_code=00_0000_000` (all three SDKs' samples). So every real success takes the failure branch: payment `FAILED`, booking `PENDING`, redirect to a page that shows nothing (M4), and verify never runs. The money is taken.
- **Correct:** The callback never writes state from `status` or `status_code`. It validates the parameters, finds the attempt, and (unless already settled) calls verify; only verify's result moves the payment. `status` only picks the redirect page while verify is pending.

**C2. The generic webhook router lets anyone cancel bookings, duplicate payments and drain inventory.**
`src/app/api/webhooks/payment/route.ts:18-22,56-104`, `src/app/api/webhooks/payment/nagad/route.ts`, `src/lib/payments/nagad/adapter.ts:55-104`
- **Wrong:** `{"provider":"NAGAD","payment_ref_id":"<ref>"}` with no signature header goes straight to `verifyPayment`. The router then inserts a new `Payment` row on every call, decrements `room.availableUnits` and emails the guest on success, and sets the booking `CANCELLED` on any other result, even `CONFIRMED` ones. An unpaid session's reference (visible to anyone who sees the checkout URL, the callback URL or a `Referer`) is enough to cancel a booking.
- **Correct:** Nagad has no webhook, so delete `/api/webhooks/payment/nagad`, and the Nagad adapter's `verifyWebhook` refuses every request (returns `null`), as the bKash and BanglaQR adapters already do, so the generic router can never fulfil or cancel through Nagad.

**C3. No payment state machine: forged or replayed callbacks overwrite settled payments, and verify revives cancelled bookings.**
`callback/route.ts:58-61`, `verify-payment.ts:54-69,87-110,134-149`
- **Wrong:** Every write is an unconditional `payment.update` by id. A callback with `status=Aborted` turns `SUCCESS` into `FAILED`, which blocks refunds ("Only successful payments can be refunded") and undercounts revenue. A success replay after the booking was cancelled (or refunded, T8) sets the booking `CONFIRMED` again. Verify also turns an amount mismatch on an already-`SUCCESS` row into `FAILED`.
- **Correct:** Every transition is a guarded `updateMany` with an allowed-from list, checked for `count === 1`. The allowed transitions are:
  - `INITIALIZING → INITIATED → VERIFYING → SUCCESS | FAILED | CANCELLED | REVIEW_REQUIRED`
  - `VERIFYING → VERIFY_PENDING` (timeout)
  - `INITIATED → SUPERSEDED | ABANDONED`
  - `SUCCESS → PARTIALLY_REFUNDED → REFUNDED`

  Settled rows are never re-verified by the callback. The booking is confirmed only from `PENDING`, under a row lock.

**C4. Cancelled, expired and already-paid bookings can be paid through Nagad.**
`initialize-payment.ts:69-82`, `verify-payment.ts:97-102`
- **Wrong:** Initialize refuses only three booking statuses and only looks at Nagad payments. A `CANCELLED` booking (room released or resold), an `EXPIRED` BanglaQR hold, a `PENDING_MANUAL_VERIFICATION` booking (guest already paid by QR), or a booking already paid through bKash can open a Nagad session. Verify then sets `CONFIRMED` without re-reading the booking.
- **Correct:** Initialize requires a `PENDING` booking within the payment window and no live payment on **any** provider (reuse the bKash payability rule). Fulfilment re-checks under `SELECT … FOR UPDATE`. Unlike bKash, Nagad has already taken the money by then (D6). If the booking can't be fulfilled, the payment is recorded `SUCCESS`, the booking is left alone, and the payment goes to `REVIEW_REQUIRED` with an OWNER alert for a refund.

**C5. Payments whose callback never arrives are never reconciled, and they lock the booking.**
`initialize-payment.ts:73-82`; no cron exists
- **Wrong:** If the guest pays and closes the tab, or verify times out, the row stays `INITIATED` forever with the money taken. The next initialize refuses with "A Nagad payment is already in progress" **forever**, so the guest can't retry, and no process ever calls verify.
- **Correct:** A reconciliation cron (§7; every 5 min, `isCronRequestAuthorized`, `CronHeartbeat`). It verifies `INITIATED` rows older than 10 minutes and `VERIFY_PENDING`/`VERIFYING` rows older than 2 minutes. `Success` fulfils through the same guarded path. `Aborted`, `Cancelled` or `Failed` become `FAILED`. A session still open after 2 hours becomes `ABANDONED`. Initialize re-verifies a blocking attempt with Nagad before refusing (D5). Heartbeat alert after 2 hours of silence.

### High

**H1. The initialize response signature is checked over the ciphertext; a genuine Nagad response is rejected (unconfirmed without a sandbox).**
`src/lib/payments/nagad/client.ts:102-115`
- **Wrong:** `verifyWithPublicKey(resObj.sensitiveData, …)` checks the signature over the base64 ciphertext. Nagad's integration guide says the signature covers the decrypted `sensitiveData`. With Nagad-style signing, the current check returns `false` and the plaintext check returns `true` (Evidence). If the guide is right, **every** Nagad payment has failed at phase 1 since the integration was written.
- **Correct:** decrypt with the merchant private key → verify the signature over the exact decrypted bytes with `crypto.verify("sha256", …)` → `JSON.parse` → strict schema (`merchantId` must equal ours). All failures map to one `NAGAD_SIGNATURE_INVALID` log event (correlation ID, endpoint, body hash; never the signature) and one generic guest error. Confirm in a sandbox (D10).

**H2. Decrypted phase-1 data is used without validation.**
`initialize-payment.ts:123-133`
- **Wrong:** It is cast to `{ paymentReferenceId, challenge }` with no check. Missing fields become `undefined` and the row is written with `paymentId: null`. The decrypted `merchantId` isn't compared. Parse errors reach the guest verbatim.
- **Correct:** A Zod schema: `paymentReferenceId` matches the reference format (D3), `challenge` is bounded, `merchantId` equals ours, and `acceptDateTime` has the `yyyyMMddHHmmss` format.

**H3. Nagad failures sent as HTTP 200 flow on as data, and verify turns them into final `FAILED`.**
`client.ts:86-100`, `verify-payment.ts:39-40,131-170`
- **Wrong:** `nagadFetch` throws only on `!res.ok`. A non-JSON body becomes `{ rawText }` and is returned as `T`. Nagad reports errors as 200 with `reason`, `message` or `devMessage`. In verify, such a body has no `status`, so `isSuccess` is false and the payment is written `FAILED` (or `CANCELLED`) and the booking left unpaid. A transient Nagad problem during verify is therefore recorded as a final failure. Unknown or in-progress statuses (a session the guest hasn't finished) are also final `FAILED`.
- **Correct:** Each call's response is parsed against a discriminated schema: a success shape, or a Nagad error shape. The client returns `ok | rejected | unavailable | unknown` (as bKash `bkashCall` does). Verify treats only an explicit `Aborted`/`Cancelled`/`Failed` as final. Errors, timeouts and unknown or pending states leave the row for the cron (`VERIFY_PENDING`).

**H4. Verify's success test and field checks are loose.**
`verify-payment.ts:39-51,85`
- **Wrong:** `status === "Success" || statusCode === "000"` (either alone passes). If `amount` is missing, the payment's own stored amount is used (fail open). The amount is compared with the live booking total, not the amount we sent to Nagad. `orderId`, `merchantId` and `paymentRefId` in the response aren't compared with our record. If `issuerPaymentRefNo` is missing, the reference ID stands in as the transaction ID.
- **Correct:** Strict schema. Success needs `status === "Success"` **and** `statusCode === "000"`. `amount` is required and must equal the attempt's `amountPoisha` (snapshot at initialize) **and** the booking total (mismatch → `REVIEW_REQUIRED`, `NAGAD_AMOUNT_MISMATCH` audit event with both values). `orderId` must equal the stored per-attempt order ID, `merchantId` ours, and `paymentRefId` the row's. `issuerPaymentRefNo` is required for `SUCCESS` and is unique per Nagad payment (DB index).

**H5. Create is authenticated by a raw booking UUID and accepts client contact data.**
`create/route.ts:11-21,55-56`
- **Wrong:** Anyone with a booking UUID can open sessions for it. The 404 reveals existence. `customerPhone` and `customerEmail` come from the client.
- **Correct:** The same pattern as bKash and BanglaQR: `POST /api/payments/nagad/token` with `{ bookingId, bookingCode }` returns a 60-minute HS256 booking token (`NAGAD_TOKEN_SECRET`, purpose `nagad-pay`), and `POST /api/payments/nagad/initialize` takes `{ bookingToken, amount }` with `.strict()`. Contact data only ever comes from the booking.

**H6. No DB-level idempotency; concurrent creates open several payable sessions.**
`initialize-payment.ts:73-82`, `complete-initialization.ts:86-94`
- **Wrong:** A check-then-act in the app, and the row is inserted after both Nagad calls. Two concurrent requests (double click, two tabs) both get checkout URLs, and the guest can pay both. There's no unique index on the Nagad reference, the order ID or the issuer transaction ID.
- **Correct:**
  - Claim first: insert an `INITIALIZING` row before any Nagad call.
  - Add a partial unique index "one live Nagad attempt per booking" (`INITIALIZING`, `INITIATED`, `VERIFYING`, `VERIFY_PENDING`, `SUCCESS`, `PARTIALLY_REFUNDED`, `REVIEW_REQUIRED`), plus unique indexes on the Nagad `paymentId` and on `transactionId`, all filtered on `provider = 'NAGAD'`.
  - The loser of a race gets `PAYMENT_IN_PROGRESS`.
  - Verify claims `INITIATED → VERIFYING` with `updateMany` before calling Nagad.

**H7. Refunds call an endpoint that doesn't match Nagad's API, fabricate IDs, and have no ledger.**
`src/lib/payments/nagad/refund.ts:43-110`, `src/app/api/admin/payments/refund/route.ts:15-82`
- **Wrong:** The code posts a plaintext, unsigned body to `/api/dfs/refund/payment`. The public SDKs use `POST {base}/purchase/cancel?paymentRefId={ref}&orderId={orderId}` with `sensitiveDataCancelRequest` (encrypted `{merchantId, originalRequestDate, originalAmount, cancelAmount, referenceNo, referenceMessage}`) plus a `signature`, and decrypt an encrypted response. On top of that:
  - a missing refund transaction ID is replaced with `REF_${Date.now()}`;
  - a partial refund marks the payment `REFUNDED`;
  - there's no over-refund check, idempotency or minimum reason;
  - there's no MFA;
  - raw errors are returned;
  - it's a JSON route where §3.5 asks for a Server Action;
  - a timeout leaves no record.
- **Correct:** A `NagadRefund` ledger (append-only trigger, one in-flight refund per payment, as `BkashRefund`) and `Payment.refundedAmountPoisha` (already exists, additive). A Server Action with OWNER + MFA, a reason of at least 10 characters, the exact amount retyped, and an explicit "additional refund" flag for a second refund. Amount ≤ paid − refunded. The request is RSA-encrypted and signed; the response is decrypted, signature-checked and schema-checked. Timeout → `UNKNOWN`, which blocks further refunds and is resolved as described in D7. The refund window comes from settings. The shared refund route returns 400 for `NAGAD`, pointing to the booking page.

**H8. Internal errors are returned to clients; there are no correlation IDs.**
`create/route.ts:60-75`, `test-connection/route.ts:27-76`, `refund/route.ts:78-81`, `callback/route.ts:86`
- **Wrong:** Env var names, Nagad `reason`/`devMessage` text, RSA failure wording, `merchantId`, `baseUrl` and `NEXT_HTTP_ERROR_FALLBACK;403` all reach browsers.
- **Correct:** A `NagadError(code, …)` class with an HTTP status map and bilingual guest messages (§10.1), `{ code, correlationId }` responses only, and correlation IDs `NG-YYYY-MM-DD-xxxxxx` logged with `component: "nagad"`.

**H9. Test connection is inverted, MANAGER-accessible and leaky.**
`src/app/api/admin/payments/nagad/test-connection/route.ts:19,48-70`
- **Wrong:** It reports failure for a correct key pair and success for a misconfigured one (see E4). It's MANAGER, not OWNER; `requireRole` sits inside `try`; there's no rate limit; and it returns `merchantId` and `baseUrl`.
- **Correct:** D9. OWNER + MFA outside `try`, and 10 per admin per hour. Returns only `{ success, environment, keySizeBits }`.

**H10. Keys and environment aren't validated; production can silently run against the sandbox.**
`client.ts:4-40`, `crypto.ts:13-28`
- **Wrong:**
  - Readiness is "non-empty string". A 1024-bit key, a garbage key or a swapped pair is accepted.
  - `NAGAD_MERCHANT_ID` falls back to `""`, and the callback URL to `http://localhost:3000`.
  - `NAGAD_IS_SANDBOX` defaults to **sandbox**, and `NAGAD_BASE_URL` is free text: `http:`, any host.
- **Correct:**
  - `config.ts` parses both keys once per process with `crypto.createPrivateKey` / `createPublicKey` (PKCS#8 or PKCS#1, after `\n` normalisation), requires RSA with a modulus ≥ 2048 bits, and checks that the PG public key isn't the merchant's own public key. It logs the parse error class only.
  - The base URL must be one of the known Nagad hosts, and in production the production host over `https`. Sandbox in production is refused unless `NAGAD_ALLOW_SANDBOX_IN_PRODUCTION=true` (as bKash).
  - `NAGAD_CALLBACK_URL` is required and must be `https` in production.
  - Any failure makes readiness `configured: false` with a reason code, so Nagad isn't offered to guests.

**H11. Logs store encrypted payloads, signatures and Nagad responses unredacted; there's no append-only audit.**
`initialize-payment.ts:136-144`, `complete-initialization.ts:97-124`, `verify-payment.ts:59,71-80,94,112-121`, `refund.ts:81-120`, `callback/route.ts:38-46`
- **Wrong:** `PaymentLog.requestPayload` stores the full request, including `sensitiveData` (ciphertext carrying the challenge) and `signature`. Responses are stored verbatim, including `merchantMobileNo` in full and Nagad's partly masked `clientMobileNo`. `rawWebhookPayload` stores the whole verify body. `PaymentLog` isn't append-only.
- **Correct:** Write to `PaymentAuditLog` (provider `NAGAD`, append-only trigger already in place) with the §8.1 events and whitelisted, masked fields only:
  - `challengeHash` (sha256), never the challenge;
  - never `sensitiveData`, signatures or PEM material;
  - trxID shown as first 2 + last 2;
  - phone numbers as the last 3 digits.

  Stop writing Nagad bodies to `PaymentLog` and `rawWebhookPayload`; keep a whitelisted summary instead.

**H12. Rate limiting is partial, and absent on callback, test-connection and refund.**
`create/route.ts:27-43`
- **Wrong:** Only successful initiations are counted, per booking; the check is racy; there's no per-IP limit.
- **Correct:** The shared `PaymentRateLimitHit` limiter (bKash D6), with the §9 table:
  - initialize: 5 per booking per hour and 20 per IP per hour;
  - token: per IP;
  - callback: 60 per IP per minute;
  - refund: 10 per admin per day;
  - test-connection: 10 per admin per hour.

  Failed-decryption events count against the calling IP (§1.7). Responses are 429 with `Retry-After`.

### Medium

**M1. `X-KM-IP-V4` is hardcoded to `127.0.0.1`.** `client.ts:69`. Nagad expects the customer's IPv4. The SDKs pass the real client IP, and one replaces loopback with a public address because Nagad rejects it. **Correct:** pass the guest's IP from the trusted proxy header (same extraction as the rate limiter), falling back to a configured `NAGAD_SERVER_IPV4`. Never forward an IPv6 or loopback value. Unconfirmed without a sandbox.

**M2. The complete request sends `merchantCallbackUrl`; every SDK sends `merchantCallbackURL`.** `complete-initialization.ts:65`. Nagad may ignore our field and use the merchant's default whitelisted callback, or use only the `X-KM-Merchant-Callback` header. **Correct:** `merchantCallbackURL`, confirmed in a sandbox; the header is kept.

**M3. The callback accepts `POST` and three parameter aliases, has no schema, and writes a log row on every hit.** `callback/route.ts:7-12,38-46,95-97`. **Correct:** `GET` only (§3.3). A strict schema per D3. Rate limit. An unknown reference gets 400 plus a correlation ID (§4). `assertPaymentProviderAvailable` is not applied to the callback, deliberately: a disabled gateway must still settle payments already in flight. This is documented as intended.

**M4. Failure redirects carry a `paymentStatus` nothing reads, so the guest never learns what happened.** `callback/route.ts:63-65,79-81,87-89`; `grep -rn "paymentStatus" src/app/book src/components/travel` finds no reader. **Correct:** a `/payment/nagad/result` page (as bKash) with bilingual states: pending verification, failed, cancelled, expired. Codes only, never Nagad's text.

**M5. Base URLs are probably wrong for the sandbox and aren't pinned.** `client.ts:4-12`. The default sandbox is `https://sandbox-ssl.mynagad.com:10060` with paths `/api/dfs/…`. The SDKs use `http://sandbox.mynagad.com:10080/remote-payment-gateway-1.0/api/dfs/…` for the sandbox and `https://api.mynagad.com/api/dfs/…` for production. **Correct:** an allow-list of hosts and path prefixes, with production pinned to `https://api.mynagad.com`, confirmed in a sandbox (D10).

**M6. `orderId` is the booking code, reused for every attempt.** `initialize-payment.ts:91`, `complete-initialization.ts:50`. **Correct:** D4: a per-attempt order ID stored on the row with a DB uniqueness guarantee, and checked in verify and in the callback's `order_id`.

**M7. The amount is compared with a MANAGER-editable live total.** `verify-payment.ts:45-51`. A MANAGER edit during checkout makes a genuine payment look like a mismatch (money taken, booking unconfirmed), or the reverse. **Correct:** snapshot `amountPoisha` on the attempt; require both equalities (H4). `updateBooking` refuses total edits while a Nagad attempt is live (bKash H8 pattern).

**M8. There is no payment window or attempt TTL.** Nothing checks booking age at initialize, or attempt age and Nagad's `payment_dt` at fulfilment. **Correct:** booking age ≤ `paymentWindowMinutes` at initialize. An attempt older than the TTL is never *started* again. A late `Success` still fulfils if the booking is `PENDING` and payable, otherwise it goes to `REVIEW_REQUIRED` (C4).

**M9. MANAGER can rewrite Nagad payment status or record a refund that never happened.** `admin-actions.ts:490-495,564-596`. **Correct:** the same guards bKash received: `updateBooking` refuses status changes on Nagad rows, and `cancelBookingWithRefundDecision` refuses "refund recorded" for a Nagad `SUCCESS` payment and points to the Nagad refund dialog. This is a shared file; the change is limited to a Nagad branch and the bKash tests are re-run.

**M10. No notifications on the normal path.** The callback path sends no confirmation email; only the insecure webhook router did (C2). No failure or expiry emails, and no admin alerts. **Correct:** §12. Guest: confirmed, failed, expired. Admin: refund issued, cron auto-fulfilment, `REVIEW_REQUIRED`, and signature invalid (rate-limited to 1 per hour). Sent through `after()` so they never block a redirect.

**M11. No reconciliation heartbeat or alerting.** It would alert if the cron hasn't run in 2 hours (BanglaQR pattern). Tracked with C5 but listed so it isn't lost.

### Low

**L1. `console.error` on production paths** (`crypto.ts:78`, `callback/route.ts:86`). Replace with the structured `nagadLog` using a redacted error class name.

**L2. The barrel `index.ts` re-exports key getters and crypto helpers.** Remove the barrel (as bKash did). Key access lives only in `config.ts`; the other modules receive `KeyObject`s.

**L3. `formatPemKey` runs on every RSA operation.** Parse once per process into cached `KeyObject`s (also cheaper per request). The cache resets only by process restart, which is the documented key-rotation step (§11.4).

**L4. `generateRandomString` gives only 80 bits via hex slicing.** That's adequate for a nonce, but use `randomBytes(16)` for 128 bits (the SDKs use 20 hex characters; confirm length limits in a sandbox).

**L5. `hour12: false` instead of `hourCycle: "h23"`.** Correct on Node 24's ICU (checked at Dhaka midnight), but `"24"` on older ICU. Add `hourCycle: "h23"` plus a midnight-boundary test with a mocked clock (§11.5).

**L6. The docs overstate the controls.** See [Corrections](#corrections-to-existing-documentation).

---

## Decisions Needed Before Section 1

These change the design the brief assumes. Each has a recommendation; approving this document means approving the recommendations unless you note otherwise.

| # | Question | Recommendation |
|---|---|---|
| **D1** | **Unsigned responses.** §1.4 and §3.4 require an RSA signature on every Nagad response, including verify. Nagad signs only the initialize response, and (per the SDKs) the encrypted refund response. Complete and verify are plain JSON over TLS. | Verify the signature wherever Nagad signs, and **reject** those responses when it's missing or invalid. For unsigned responses, "never trust an unsigned response" becomes "never trust a response that isn't **authenticated**":<br>• TLS to a pinned host allow-list (production: `https://api.mynagad.com` only)<br>• a strict schema<br>• every identifying field cross-checked against our stored attempt (`merchantId`, `orderId`, `paymentRefId`, `amount`)<br>• fulfilment only through verify, never through anything the browser carries<br>The residual trust in TLS and Nagad's DNS is documented in the security controls. |
| **D2** | **No public `/complete` endpoint.** §3.2 and §2.2 define `POST /api/payments/nagad/complete` taking `{ paymentReferenceId, challenge }` from the client. That would hand Nagad's challenge to the browser, which today never sees it. | Keep both phases server-side inside `POST /api/payments/nagad/initialize`, and persist phase state:<br>• `INITIALIZING` row claimed first<br>• after phase 1: `paymentId` and `challengeHash` (sha256; the challenge itself is never stored)<br>• after phase 2: `INITIATED`<br>Phase 2 runs at most once per reference by construction, via a guarded `updateMany`. The brief's §3.2 checks (belongs to this booking, correct state, not twice, 5/booking/hour) and its §13 "Complete" tests apply to this internal step. |
| **D3** | **Callback schema.** §2.3 allows only `payment_ref_id`, `status` ∈ {Success, Failure, Cancel} and `status_code`. Real callbacks carry eight parameters, with values like `Aborted` and `00_0000_000`. The reference is base64 (can include `=`), about 88 characters, not "alphanumeric". | `.strict()` with the eight known parameters, each bounded:<br>• `payment_ref_id` `^[A-Za-z0-9+/=_-]{20,200}$`<br>• `status` a bounded string (used only to pick a redirect page)<br>• `order_id` must equal the attempt's stored order ID, and `merchant` must equal ours; otherwise 400 plus a correlation ID, and verify isn't called<br>Unknown extra parameters → 400. |
| **D4** | **Order ID.** §6.2 says `merchantOrderId = bookingCode` and "unique across all payments". That conflicts with retries, and Nagad rejects duplicate order IDs. | Per attempt: `{bookingCode without the hyphen}{4 random hex}` (e.g. `RES123456A1B2`: alphanumeric, ≤ 20 characters), stored in the existing `Payment.merchantInvoiceNumber` column. It is already globally `@unique`, which gives §6.2's uniqueness at DB level; the bKash partial indexes are filtered on `provider = 'BKASH'` and aren't affected. Verify and the callback must match it. The readable prefix keeps it searchable in Nagad's merchant portal. |
| **D5** | **An existing `INITIATED` attempt.** §3.1 says to reject. bKash chose to supersede. Nagad differs: **the guest can still pay an old session on Nagad's page**, since no merchant call is needed to capture. | Before refusing, **verify the blocking attempt with Nagad**. If terminal (`Aborted`/`Cancelled`/`Failed`): mark it `FAILED` and allow the new one. If still open and younger than the attempt TTL (15 min): refuse with `PAYMENT_IN_PROGRESS`. If older: mark it `SUPERSEDED`, keep it on the cron's list until the 2-hour abandon point, and allow the new one. A late `Success` on a superseded attempt fulfils only if the booking is still `PENDING` with no other success; otherwise it goes to `REVIEW_REQUIRED` with an OWNER alert. |
| **D6** | **Where the booking guard runs.** With bKash we could lock the booking before capture. With Nagad the capture has happened by the time we're told. | Guard at initialize (payable, within the window, no live payment on any provider) **and** at fulfilment, under `SELECT … FOR UPDATE` on the booking. If fulfilment is refused (booking cancelled, paid elsewhere, amount changed), the payment is recorded as captured, the booking is untouched, and the payment goes to `REVIEW_REQUIRED` with an OWNER email to refund. Never auto-cancel or auto-confirm around a capture. |
| **D7** | **Refund API.** Nagad's refund API isn't publicly documented. The current endpoint doesn't match the SDKs, and there's **no public refund-status query**, so an ambiguous outcome can't be reconciled automatically. | Implement `purchase/cancel` in the SDK shape (encrypted and signed request; decrypted and verified response) behind the `NagadRefund` ledger. A timeout or undecodable reply becomes `UNKNOWN`, which blocks further refunds on that payment. The OWNER (+ MFA) resolves it from the booking page after checking Nagad's merchant portal (`COMPLETED` with the portal refund ID, or `FAILED`), and that resolution is audited. If the sandbox shows a different shape, it's adjusted and recorded in the verification report. **Please confirm the refund window in your Nagad merchant agreement** (7 days assumed, editable in settings). |
| **D8** | **Amount cap and settings.** §2.1 hardcodes ৳500,000. bKash moved its limits to owner settings (bKash D8). | A `NagadSettings` singleton (OWNER + MFA) on `/admin/settings/payments`: `maxAmountPoisha` (৳500,000), `paymentWindowMinutes` (60), `attemptTtlMinutes` (15), `refundWindowDays` (7, to confirm), `notifyEmail`. |
| **D9** | **Test connection semantics.** §3.6's "encrypt with Nagad's public key, decrypt with our private key, verify round-trip" can't succeed with correct keys: they're different key pairs. | Run key checks: both keys parse; RSA ≥ 2048 bits; the merchant private key signs and its **own** derived public key verifies (proves the private key is intact); the PG public key is **not** our own public key (catches the most common paste mistake); the base URL is on the allow-list for the environment. Then run one harmless reachability probe: `GET verify/payment/{random ref}` must return a well-formed Nagad error JSON. That proves network access and IP whitelisting without creating a session. Returns only `{ success, environment, keySizeBits }`, or `{ code, correlationId }` on failure. |
| **D10** | **Sandbox access.** No Nagad credentials exist locally. Nagad's sandbox needs merchant onboarding and **whitelisting of our server IP and callback URL**. The keys in public SDK READMEs are truncated placeholders, not working credentials. | Either you provide your merchant's **sandbox** credentials and have Nagad whitelist a test IP and callback (never committed), or §16.2 steps 1, 4 and 7 are marked **NOT RUN**. In that case every Nagad call is tested against a local fake that follows the SDK-documented shapes, with real RSA key pairs. H1, M1, M2, M5 and D7 would then stay **unconfirmed** in the verification report. |
| **D11** | **Entry points.** A Nagad webhook route exists with no Nagad webhook behind it; the brief names both `/create` and `/initialize`; refunds must be a Server Action. | Delete `/api/webhooks/payment/nagad`; the generic router refuses `NAGAD`. Add `/api/payments/nagad/token` and `/api/payments/nagad/initialize`, and delete `/create` (its only caller is `NagadPaymentButton`, which is updated). The callback is `GET` only. Refunds are a Server Action; the shared `/api/admin/payments/refund` returns 400 for `NAGAD`, and **its SSLCommerz branch is unchanged**. The cron is `POST /api/cron/nagad-reconcile`. |
| **D12** | **Abandoned sessions.** §7.1 marks `Pending > 2h` as `ABANDONED`. | The payment becomes `ABANDONED`; the **booking stays `PENDING`** (the guest can still pay within the window by another method), consistent with bKash D12. |

---

## Outcome of the decisions (added after approval)

| # | As implemented |
|---|---|
| D1 | As recommended. Signed responses (initialize, refund) are opened by `openNagadSealedPayload`: decrypt, then verify Nagad's signature over the decrypted bytes, then parse. Unsigned ones (complete, verify) come only from allow-listed hosts, with redirects refused, strict schemas and field cross-checks |
| D2 | As recommended. No public `/complete`; the challenge is stored as a domain-separated sha256 and checked with `timingSafeEqual` before phase 2 |
| D3 | As recommended. `order_id` and `merchant` are checked when present (Nagad's cancel redirects may omit them) |
| D4 | As recommended. `{bookingCode without hyphen}{4 hex}`, ≤ 20 characters, in `merchantInvoiceNumber` |
| D5 | As recommended; hold configurable (`attemptTtlMinutes`, default 15) |
| D6 | As recommended. REVIEW_REQUIRED reasons: MERCHANT_MISMATCH, PAYMENT_REF_MISMATCH, ORDER_MISMATCH, AMOUNT_MISMATCH, BOOKING_TOTAL_CHANGED, MISSING_TRX_ID, TRX_ID_REUSED, ALREADY_PAID, BOOKING_NOT_PENDING |
| D7 | As recommended; request shape from the SDKs, unconfirmed against Nagad |
| D8, D9, D11, D12 | As recommended |
| D10 | No sandbox credentials were provided, so every Nagad call is tested against a local fake doing real RSA; H1, M1, M2, M5 and D7 remain unconfirmed against Nagad (see the verification report) |

**Found during implementation (Section 5):** the single "one live payment per booking" index from the Section 3 migration also covered VERIFYING, VERIFY_PENDING and REVIEW_REQUIRED. Two consequences:

- A second payment Nagad had captured couldn't be recorded (500 instead of REVIEW_REQUIRED).
- A superseded window couldn't be verified while a newer attempt was open.

Migration `20260930120200_nagad_live_index_split` replaces it with one-open-attempt and one-confirmed-payment indexes.

## Adjacent Findings (documented, not fixed in this phase)

| # | Location | Finding |
|---|---|---|
| A1 | `src/app/api/webhooks/payment/route.ts` (SSLCommerz path) | The C2 behaviour (new payment row per call, inventory decrement, booking `CANCELLED` on any non-success) still applies to `provider: "SSLCOMMERZ"`, depending on how strong the SSLCommerz adapter's `verifyWebhook` is. Carries over bKash A5 |
| A2 | `src/app/api/admin/payments/refund/route.ts` (SSLCommerz branch) | Same gaps as H7 for SSLCommerz: `requireRole` inside `try`, no ceiling, no idempotency, raw errors. Carries over bKash A3 |
| A3 | `src/app/actions/admin-actions.ts:490-495` | `updateBooking` lets a MANAGER set any status string on **SSLCommerz** payments (bKash is guarded; Nagad will be under M9). Carries over bKash A7 |
| A4 | `src/lib/payments/availability.ts:65` | `assertPaymentProviderAvailable` puts missing env var names in its error message; any route that returns `err.message` (the SSLCommerz create route) leaks them. Nagad's routes will stop returning it (H8) |
| A5 | `prisma/schema.prisma` `PaymentLog` | Not append-only, and stores raw gateway bodies for SSLCommerz, with a "redacted" comment that isn't true. bKash and Nagad move to `PaymentAuditLog` |
| A6 | `src/app/booking/confirmation/[id]/page.tsx`, `src/app/api/bookings/route.ts` | bKash A1 (public confirmation page shows full PII) and A6 (unthrottled booking creation, `Math.random` booking code) are still open. Nagad redirects to the same page |

---

## Corrections to Existing Documentation

| Document | Claim | Reality |
|---|---|---|
| `PAYMENTS-NAGAD.md` title | "Nagad API v4" | The code sends `X-KM-Api-Version: v-0.2.0`; no "v4" appears anywhere |
| `PAYMENTS-NAGAD.md` §1 | Complete "with challenge, orderId, and callback URL" | Also amount and currency; the callback field name likely doesn't match Nagad's (M2) |
| `PAYMENTS-NAGAD.md` §5 | "All incoming response `sensitiveData` signatures are verified" | Only initialize, and over the wrong bytes (H1); the webhook path skips it (C2) |
| `PAYMENTS-NAGAD.md` §5 | "Idempotency: checks for existing SUCCESS or INITIATED payments" | Racy app-level check, Nagad-only, and it locks the booking forever (C5, H6) |
| `PAYMENTS-NAGAD.md` §5 | "Amount check rejects payments where verified amount ≠ booking total" | Fail open when `amount` is absent; compares with the live, editable total (H4, M7) |
| `PAYMENTS-NAGAD.md` §5 | "Audit Trail: all phases… logged" | Mutable `PaymentLog` with unredacted bodies (H11) |
| `PAYMENTS-NAGAD.md` §6 | Connection test checks "RSA key integrity" | Inverted: fails for correct keys (H9) |
| `PAYMENTS-NAGAD.md` §7 | "Every `/api/payments/nagad/*` route calls `assertPaymentProviderAvailable`" | The callback doesn't (by design going forward; M3) |
| `PAYMENTS-NAGAD.md` §2 | Sandbox base URL `https://sandbox-ssl.mynagad.com:10060` | The SDKs use `http://sandbox.mynagad.com:10080/remote-payment-gateway-1.0` (M5) |

### Evidence commands (re-runnable)

```bash
# Brief §16.3 greps against the current code
grep -rn "NAGAD_MERCHANT_PRIVATE_KEY\|NAGAD_PG_PUBLIC_KEY\|NAGAD_PUBLIC_KEY\|NAGAD_PRIVATE_KEY" src/ | grep -v "process.env"
# → test-connection/route.ts:39   error string naming the vars (not a value)
# → crypto.ts:7-10                doc comment
grep -rn "timingSafeEqual" src/lib/payments/nagad/
# → (no output)   nothing compares secrets today; the booking token (H5) will be the first
grep -rn "RSA-OAEP\|RSA_PKCS1\|createVerify\|createSign" src/lib/payments/nagad/
# → crypto.ts:37,52  RSA_PKCS1_PADDING (encrypt, decrypt)   crypto.ts:62,72  createSign / createVerify("RSA-SHA256")

# C1: the success status code the callback misreads
grep -n 'statusCode !== "000"' src/app/api/payments/nagad/callback/route.ts
# → 54:    (statusCode && statusCode !== "000")
# Nagad's success callback (SDK sample): ...&status=Success&status_code=00_0000_000&message=Successful%20Transaction&...

# M4: nothing reads paymentStatus
grep -rn "paymentStatus" src/app/book src/components/travel
# → (no output)

# 0.6: test files
find src -path "*nagad*" -name "*.test.ts" | wc -l      # → 0
```

H1, the key-size and garbage-key checks (run with `pnpm exec tsx`, using the repo's own `crypto.ts`):

```ts
// Nagad signs the plaintext sensitiveData with its PG private key (integration guide)
const sensitiveData = encryptWithPublicKey(plaintext, merchantPublicPem);
const signature = createSign("RSA-SHA256").update(plaintext).sign(pgPrivatePem, "base64");
verifyWithPublicKey(sensitiveData, signature, pgPublicPem); // what client.ts does
verifyWithPublicKey(plaintext, signature, pgPublicPem);     // what the guide describes
```
```
current client.ts check (signature over encrypted sensitiveData): false
spec check (signature over decrypted plaintext): true
1024-bit key accepted by encryptWithPublicKey: true
garbage key → formatPemKey output starts: -----BEGIN PRIVATE KEY-----
```

T14 / 0.2, PKCS#1 v1.5 implicit rejection on Node 24.16.0 / OpenSSL 3.5.6 (50 single-byte-tampered ciphertexts):
```
{ tamperedThatThrew: 0, tamperedReturningRandomBytes: 50 }
```

L5 / 0.3, the Dhaka midnight boundary with the current formatter:
```
2026-09-29T18:00:05Z 20260930000005
2026-09-29T18:30:00Z 20260930003000
2026-09-29T17:59:59Z 20260929235959
```

### External references

Nagad doesn't publish an open developer portal; its integration guide is shared with onboarded merchants. The API shapes above come from:

- Community write-up of Nagad's integration guide (endpoints, headers, PKCS#1 padding, SHA256withRSA, **signature over decrypted `sensitiveData`**, `merchantCallbackURL`): https://github.com/theshakhawat/nagad-payment-gateway-documentation
- `arif98741/nagadApi` (PHP SDK: sandbox `http://sandbox.mynagad.com:10080/remote-payment-gateway-1.0/api/dfs/`, production `https://api.mynagad.com/api/dfs/`, callback parameters incl. `status_code=00_0000_000`, verify response sample with `statusCode: "000"`, IP/callback whitelisting): https://github.com/arif98741/nagadApi
- `shahriar-shojib/nagad-payment-gateway` (Node SDK: decrypted initialize fields `paymentReferenceId`, `challenge`, `acceptDateTime`; verify response interface; errors as `reason`/`devMessage` in 200 bodies; loopback IP substitution): https://github.com/shahriar-shojib/nagad-payment-gateway
- `codeboxrcodehub/nagad` (Laravel: refund via `purchase/cancel` with `sensitiveDataCancelRequest` and an encrypted response): https://github.com/codeboxrcodehub/nagad
- Scribd copies of the guide (v3.3, v1.5 MFI-M2C), cited for the same facts: https://www.scribd.com/document/684746071/Nagad-Online-Payment-API-Integration-Guide-v3-3

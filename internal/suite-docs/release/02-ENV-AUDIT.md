# Section 2: Environment & Secrets Audit — 2026-10-09

## 2.1 Env var inventory

The task's literal command (`grep -rnoP 'process\.env\.[A-Z_][A-Z0-9_]*'`) finds 70 distinct
variables, but **misses variables read through destructuring or a passed-in `env` parameter**
(e.g. `src/lib/email/sender.ts` takes `env: Env = process.env` and reads `env.RESEND_FROM_EMAIL`,
`src/lib/payments/sslcommerz/config.ts` builds a lookup table keyed by `"SSL_CALLBACK_SUCCESS"`
and reads it indirectly). A supplementary targeted search found these: `RESEND_FROM_EMAIL`,
`SEED_TEST_USERS`, `SSL_CALLBACK_SUCCESS/FAIL/CANCEL/IPN`. Confirmed **not** read anywhere:
`BKASH_WEBHOOK_SECRET` — correctly absent from `.env.example` and from `docs/DEPLOYMENT.md`'s
bKash section (which explicitly notes "no longer used"); this is intentional cleanup, not a gap.

**Read but not in `.env.example` — fixed this pass:**

| Variable | Why it was missing | Fix |
|---|---|---|
| `BANGLAQR_TOKEN_SECRET` | Required even for **static**-mode BanglaQR (signs guest booking tokens) — simply omitted from the template | Added to `.env.example` |
| `R2_RECEIPTS_BUCKET_NAME`, `R2_RECEIPTS_ACCESS_KEY_ID`, `R2_RECEIPTS_SECRET_ACCESS_KEY` | BanglaQR receipts are required to live in a **separate private bucket** from the general R2 bucket (owner decision, `docs/DATA-RETENTION.md`) — the dedicated bucket's variables were never added to the template | Added to `.env.example` |

**Read but not in `.env.example` — left as-is, low priority:** `ZHMS_API_KEY`,
`ZHMS_HOTEL_ID` — these back a PMS adapter `src/lib/pms/README.md` itself labels "Future PMS,"
not yet a real integration; adding env-template entries for an unbuilt adapter would be
premature.

**Documented but not read directly in app code:** `PORT` — read by Next.js/`next start`
itself, not by application source. Not a gap.

## 2.2 Production env template

Created `docs/release/.env.production.template`, grouped Required / Recommended / Optional,
covering every variable from §2.1 (including the two gaps just fixed) plus every payment
gateway's block gated on "only required if that gateway is enabled."

## 2.3 Secrets scan

```
grep -rnP '(sk-[a-zA-Z0-9]|re_[a-zA-Z0-9]|AIza[a-zA-Z0-9]|AKIA[a-zA-Z0-9]|-----BEGIN|BANGLAQR_WEBHOOK_SECRET\s*=|BKASH_APP_SECRET\s*=|NAGAD_MERCHANT_PRIVATE_KEY\s*=|SSL_STORE_PASSWORD\s*=)' \
  --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git .
```

**Zero real secrets found.** Every match is one of:
- A placeholder in `.env.example`, `README.md`, `docs/DEPLOYMENT.md` or `CLIENT-ONBOARDING.md`
  (`"your_bkash_app_secret"`, `"AIzaSy...Your_Google_Maps_API_Key"`, `re_123456789_abcdef`, etc.)
  — all obviously templates, not live values.
- Test fixtures (`BANGLAQR_TOKEN_SECRET="test-token-secret-..."` in `package.json`'s DB-test
  scripts, Nagad's committed test-only RSA keys under `src/lib/payments/nagad/__tests__/keys/`
  with their own README stating they're locally generated and never registered with Nagad).
- Extensive prose in `docs/PAYMENTS-SSLCOMMERZ-SECURITY-REVIEW.md` *discussing* the
  `store_passwd` field name and SSLCommerz's own **publicly published** demo-store credential
  (`store_id=testbox`, `store_passwd=qwerty` — published in SSLCommerz's own developer docs,
  not a secret of ours).
- `.env` itself is correctly gitignored (`git check-ignore -v .env` confirms) and not tracked
  (`git ls-files` shows no `.env`/`.env.local`/`.env.production`). Its contents were not
  printed as part of this audit — presence/absence of each variable was checked without
  revealing values.

## 2.4 Cron route auth

```
for f in src/app/api/cron/*/route.ts; do echo "== $f"; grep -cE 'CRON_SECRET|isCronRequestAuthorized' "$f"; done
```

All 10 cron routes (`banglaqr-release`, `banglaqr-retention`, `bkash-reconcile`,
`blog-attempts-cleanup`, `fetch-google-reviews`, `ledger-posting`, `nagad-reconcile`,
`night-audit`, `pms-sync`, `sslcommerz-reconcile`) return a **nonzero** count. No release
blocker here.

## 2.5 Webhook fail-closed

Every webhook route either delegates to a `verifyWebhook()` that fails closed (bKash, BanglaQR,
and the generic router — confirmed in the prior production-finalization pass this session) or
checks a secret directly:

- `src/app/api/webhooks/pms/[provider]/route.ts`: `isAuthorized = !!configuredSecret && (...)`
  — correctly fails closed when no secret is configured (same rule as cron auth). **Two minor
  findings, not blockers:**
  1. The secret comparison uses plain `===`, not a timing-safe compare, unlike every payment
     webhook verifier (which use `timingSafeEqual`). A network-timing attack against this is
     impractical in practice, but it's an inconsistency worth closing for defense in depth.
  2. It accepts `?secret=` in the query string, which `docs/DEPLOYMENT.md` explicitly warns
     against for other endpoints because query strings land in access logs — the PMS webhook
     route wasn't updated to match that rule.

Neither was fixed this pass (both are hardening, not blockers) — flagged for a follow-up.

---

## Fixed this pass (production-dangerous defaults found during §2.1)

Two defaults fail **silently** in a way that specifically matches what this section was
designed to catch:

1. **`prisma/seed-admin.ts`** fell back to `admin@demo.resort` / `ChangeMe123!` / `"Resort
   Owner"` with no production guard. Those exact defaults are printed in this repo's own
   `.env.example` and `README.md` — publicly documented. Any production deployment run without
   explicitly setting `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`/`SEED_ADMIN_NAME` would create
   the first OWNER account with a **known** password. **Fixed**: the script now throws in
   production if any of the three aren't explicitly set, rather than silently using the default.
2. **`src/lib/auth.ts`**'s `baseURL` fell back to `http://localhost:3000` in every environment
   including production, with no warning at all (unlike `BETTER_AUTH_SECRET`, which at least
   warned). A wrong `baseURL` in production silently corrupts cookie/callback-URL construction
   rather than failing loudly. **Fixed**: now throws at boot in production if
   `BETTER_AUTH_URL` is unset, matching the `BETTER_AUTH_SECRET` pattern already in place.

Both verified: `pnpm build` (which runs under `NODE_ENV=production`) and `pnpm exec tsc
--noEmit` both still pass clean with `.env`'s existing `BETTER_AUTH_URL` set.

---

**Section 2 verdict: no release blocker found in the secrets scan, cron auth, or webhook
auth.** Two production-dangerous defaults were found and fixed. Two low-severity webhook
hardening items (timing-safe compare, query-string secret) are flagged but not fixed this pass.
Two `.env.example` gaps (BanglaQR token secret, receipts bucket vars) are fixed.

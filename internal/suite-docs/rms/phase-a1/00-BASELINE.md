# Phase A1 — 00 Baseline

> State of `main` @ `528e109` (PR #75 merge, F1 hotfix), taken 2026-09-28 on branch `phase-a1-foundation` before any Phase A1 change.
> Every claim below comes with the raw command output it rests on. It re-verifies [00-CURRENT-STATE.md](../00-CURRENT-STATE.md) and corrects it where the evidence differs.

## Summary

| Check | Result | Matches 00-CURRENT-STATE? |
|---|---|---|
| F1 hotfix in place: every `src/app/api/admin/**/route.ts` calls a guard | ✅ 7 routes, all call `requireRole` | ✅ |
| F2 `provider = "sqlite"` | ✅ `schema.prisma:6` | ✅ |
| F3 Float money fields | ⚠️ **3 money fields**, not "4+": `Room.pricePerNight`, `Booking.totalAmount`, `Payment.amount`. The other two `Float`s (`Destination.rating`, `GoogleReviewCache.rating`) are ratings, not money, and are out of scope | ✅ (00 listed exactly these three) |
| F4 build uses `db push` | ✅ `package.json:10`, plus a `db:push` script at `:8` | ✅ |
| F4 3 tracked migrations; blog models + ProcessedWebhook have none | ✅. The migration SQL creates no `Blog*`, `_BlogPostTags` or `ProcessedWebhook` table | ✅ |
| F4 extra drift evidence | ⚠️ New finding: the local `prisma/dev.db` records a 4th applied migration `20260927224214_add_blog_models` whose SQL is **not in git**. Only an empty, untracked folder of that name exists locally. Environments disagree about migration history. | New |
| Self-signup enabled (`emailAndPassword.enabled: true`, no `disableSignUp`) | ✅ `src/lib/auth.ts:18-20` | ✅ |
| No Sentry | ⚠️ No SDK installed. A placeholder in `src/components/analytics/AnalyticsScripts.tsx:64-71` sets `window.__SENTRY_DSN__` when `NEXT_PUBLIC_SENTRY_DSN` is set, but nothing reads it | Refines 00 |
| No test runner, no test files | ✅ | ✅ |
| No backup script | ✅ | ✅ |
| Existing `User.role` values fit the new enum | ✅ Only `OWNER` (2) and `STAFF` (1) in local data | — |
| Existing money values have ≤ 2 decimals (lossless ×100) | ✅ 0 rows with sub-poisha precision in any table | — |

## Model migration coverage (0.4)

| Model | Has a migration? | Where |
|---|---|---|
| User, Session, Account, Verification, TwoFactor | ✅ | `20260922195219_init` |
| Destination, Room, Guest, Booking, BookingLog, Payment, Lead, GoogleReviewCache, AuditLog | ✅ | `init` |
| Payment.paymentId | ✅ | `20260924080358_add_payment_id_to_payment` |
| PaymentLog, Booking.guestCount | ✅ | `20260924112006_add_guest_count_to_booking` |
| BlogPost, BlogImage, BlogCategory, BlogTag, _BlogPostTags, BlogSettings, BlogSubmissionAttempt | ❌ | none: schema drift (F4) |
| ProcessedWebhook | ❌ | none: schema drift (F4) |
| Enums BlogPostStatus, BlogPostSource | ❌ | none |

---

## Raw output

### 0.1 F1 hotfix and 0.2 audit findings / 0.4 migration history
```
$ find src/app/api/admin -name "route.ts" | sort
src/app/api/admin/payments/bkash/test-connection/route.ts
src/app/api/admin/payments/nagad/test-connection/route.ts
src/app/api/admin/payments/refund/route.ts
src/app/api/admin/payments/sslcommerz/test-connection/route.ts
src/app/api/admin/payments/status/route.ts
src/app/api/admin/pms/test-connection/route.ts
src/app/api/admin/reports/payments/route.ts

$ for f in $(find src/app/api/admin -name route.ts | sort); do printf "%s: " $f; grep -oE "require(Role|Auth)\([^)]*\)" $f | head -1; done
src/app/api/admin/payments/bkash/test-connection/route.ts: requireRole("MANAGER")
src/app/api/admin/payments/nagad/test-connection/route.ts: requireRole("MANAGER")
src/app/api/admin/payments/refund/route.ts: requireRole("OWNER")
src/app/api/admin/payments/sslcommerz/test-connection/route.ts: requireRole("MANAGER")
src/app/api/admin/payments/status/route.ts: requireRole("MANAGER")
src/app/api/admin/pms/test-connection/route.ts: requireRole("OWNER")
src/app/api/admin/reports/payments/route.ts: requireRole("MANAGER")

$ grep -n "provider" prisma/schema.prisma | head -5
2:  provider = "prisma-client-js"
6:  provider = "sqlite"
48:  providerId           String
166:  provider          String   // BKASH, NAGAD, SSLCOMMERZ
180:  provider        String   // "BKASH"

$ grep -n "Float" prisma/schema.prisma
91:  rating        Float    @default(4.8)
105:  pricePerNight  Float
141:  totalAmount    Float
169:  amount            Float
207:  rating                  Float

$ grep -n "db push\|migrate deploy" package.json
8:    "db:push": "prisma db push",
10:    "build": "prisma generate && prisma db push && next build",

$ ls prisma/migrations/
20260922195219_init
20260924080358_add_payment_id_to_payment
20260924112006_add_guest_count_to_booking
20260927224214_add_blog_models
migration_lock.toml

$ ls src/app/api/cron/
banglaqr-release
fetch-google-reviews
pms-sync

$ grep -rn "emailAndPassword" src/lib/auth.ts
src/lib/auth.ts:18:  emailAndPassword: {
src/lib/auth.ts-19-    enabled: true,
src/lib/auth.ts-20-  },

$ cat prisma/migrations/*/migration.sql | grep -E "CREATE TABLE|ALTER TABLE" | head -40
CREATE TABLE "User" (
CREATE TABLE "Session" (
CREATE TABLE "Account" (
CREATE TABLE "Verification" (
CREATE TABLE "TwoFactor" (
CREATE TABLE "Destination" (
CREATE TABLE "Room" (
CREATE TABLE "Guest" (
CREATE TABLE "Booking" (
CREATE TABLE "BookingLog" (
CREATE TABLE "Payment" (
CREATE TABLE "Lead" (
CREATE TABLE "GoogleReviewCache" (
CREATE TABLE "AuditLog" (
ALTER TABLE "Payment" ADD COLUMN "paymentId" TEXT;
CREATE TABLE "PaymentLog" (
CREATE TABLE "new_Booking" (
ALTER TABLE "new_Booking" RENAME TO "Booking";

$ grep -rniE "sentry" package.json src | head; echo "exit: $?"
src/components/analytics/AnalyticsScripts.tsx:64:  const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
src/components/analytics/AnalyticsScripts.tsx:68:      {/* Sentry DSN Logger Placeholder */}
src/components/analytics/AnalyticsScripts.tsx:69:      {sentryDsn && (
src/components/analytics/AnalyticsScripts.tsx:70:        <Script id="sentry-dsn-init" strategy="afterInteractive">
src/components/analytics/AnalyticsScripts.tsx:71:          {`window.__SENTRY_DSN__ = "${sentryDsn}";`}

$ grep -nE "vitest|jest|playwright|mocha" package.json; find . -path ./node_modules -prune -o \( -name "*.test.ts" -o -name "*.spec.ts" \) -print

$ ls scripts/ ; grep -rliE "pg_dump|backup" scripts/
check-admin-api-guards.sh
check-faq.ts
check-i18n-parity.ts
check-internal-links.ts
check-nap.ts
check-seo-metadata.ts
extract-jsonld.py
test-banglaqr-hardening.ts
```

### Migration folder tracking
```
$ git ls-files prisma/migrations
prisma/migrations/20260922195219_init/migration.sql
prisma/migrations/20260924080358_add_payment_id_to_payment/migration.sql
prisma/migrations/20260924112006_add_guest_count_to_booking/migration.sql
prisma/migrations/migration_lock.toml

$ git status --short --ignored prisma/
!! prisma/dev.db

$ ls -la prisma/migrations/20260927224214_add_blog_models/
total 0
drwxr-xr-x  2 mdamirhossain  staff   64 Sep 28 04:44 .
drwxr-xr-x  7 mdamirhossain  staff  224 Sep 28 04:42 ..

$ grep -n "prisma\|\.db" .gitignore
46:/src/generated/prisma
49:prisma/dev.db
50:prisma/dev.db-journal
```

### Local SQLite data (`prisma/dev.db`, opened read-only)
```
$ sqlite3 -readonly prisma/dev.db ".tables"
Account                Booking                ProcessedWebhook     
AuditLog               BookingLog             Room                 
BlogCategory           Destination            Session              
BlogImage              GoogleReviewCache      TwoFactor            
BlogPost               Guest                  User                 
BlogSettings           Lead                   Verification         
BlogSubmissionAttempt  Payment                _BlogPostTags        
BlogTag                PaymentLog             _prisma_migrations   

$ row counts per table
Account                  3
AuditLog                 8
BlogCategory             1
BlogImage                0
BlogPost                 1
BlogSettings             1
BlogSubmissionAttempt    0
BlogTag                  0
Booking                  4
BookingLog               5
Destination              6
GoogleReviewCache        4
Guest                    4
Lead                     1
Payment                  2
PaymentLog               0
ProcessedWebhook         0
Room                     8
Session                  9
TwoFactor                0
User                     3
Verification             0
_BlogPostTags            0
_prisma_migrations       4

$ sqlite3 -readonly prisma/dev.db "SELECT role, COUNT(*) FROM User GROUP BY role"
'OWNER'|2
'STAFF'|1

$ money precision check (values with >2 decimals)
Room|0
Booking|0
Payment|0

$ money ranges
Room|6500.0|28000.0
Booking|8500.0|17000.0
Payment|17000.0|17000.0

$ sqlite3 -readonly prisma/dev.db "select migration_name, finished_at is not null from _prisma_migrations"
20260922195219_init|1
20260924080358_add_payment_id_to_payment|1
20260924112006_add_guest_count_to_booking|1
20260927224214_add_blog_models|1
```

### 0.3 Float fields by model
| Line | Model.field | Money? |
|---|---|---|
| 91 | `Destination.rating` | No, a star rating |
| 105 | `Room.pricePerNight` | **Yes** |
| 141 | `Booking.totalAmount` | **Yes** |
| 169 | `Payment.amount` | **Yes** |
| 207 | `GoogleReviewCache.rating` | No, a review rating |

## Environment notes (affect what later sections can verify)
- Node `v24.16.0`, which includes the built-in `node:sqlite` module, so the SQLite → Postgres script needs no new dependency.
- Docker CLI is installed. The daemon was not running at baseline time.
- `psql`, `pg_dump` and `pg_restore` are not installed on the host. Postgres tooling is run inside the `postgres:16-alpine` container.
- `sqlite3` CLI is available at `/usr/bin/sqlite3`.
- A copy of `prisma/dev.db` was taken before any change, for the row-count comparison in Section 2.

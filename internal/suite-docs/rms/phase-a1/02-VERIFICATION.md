# Phase A1 — 02 Verification

> Raw evidence for the Phase A1 checklist. Items 1–6, 8–11, 14–16 and 19 were captured at the final code state (`5159cf7`). The rest (the 2FA runs, the data copy, the backfill, backup/restore, and the runtime checks A–D) were captured while each section was built, against code that did not change afterwards except for the two verification fixes listed in [01-COMPLETION.md](01-COMPLETION.md#commits).
> Environment: macOS, Node 24.16, PostgreSQL 16.15 in `docker-compose.dev.yml`. Passwords in commands are masked as `***`, and the scratch directory is shown as `<scratch>`.

## Checklist

| # | Item | Result |
|---|---|---|
| 1 | F1 hotfix confirmed in place | ✅ |
| 2 | Middleware matches /api/admin/* | ✅ |
| 3 | Session forgery test returns 401 | ✅ |
| 4 | Self-signup disabled | ✅ |
| 5 | User.role is a Prisma enum | ✅ |
| 6 | AuditLog has new columns | ✅ |
| 7 | 2FA enforced for OWNER | ✅ |
| 8 | Postgres migration applied cleanly | ✅ |
| 9 | Migration drift check passes | ✅ |
| 10 | pnpm build uses migrate deploy | ✅ |
| 11 | No db push references remain | ✅ |
| 12 | SQLite data migrated to Postgres | ✅ |
| 13 | *Poisha columns added and backfilled | ✅ |
| 14 | Every Float money read updated | ✅ |
| 15 | Money library tests pass | ✅ |
| 16 | Roundtrip tests pass | ✅ |
| 17 | Backup script runs successfully | ✅ |
| 18 | Restore procedure tested once | ✅ |
| 19 | Documentation updated | ✅ |

Nothing on the checklist is ❌. Things that could **not** be verified in this environment (the production VPS, live gateways, a rollback rehearsal, cron and R2) are listed in [01-COMPLETION.md](01-COMPLETION.md#not-verified-here).

## 1. F1 hotfix confirmed in place — ✅

All 7 remaining `/api/admin` routes call a guard, and the extended guard checks pass.

```
$ find src/app/api/admin -name "route.ts" | sort | xargs grep -lE "require(Role|Auth|Mfa)\(" | wc -l; find src/app/api/admin -name route.ts | wc -l
       7
       7

$ for f in $(find src/app/api/admin -name route.ts | sort); do printf "%s: " $f; grep -oE "require(Role|Auth|Mfa)\([^)]*\)" $f | head -1; done
src/app/api/admin/payments/bkash/test-connection/route.ts: requireRole("MANAGER")
src/app/api/admin/payments/nagad/test-connection/route.ts: requireRole("MANAGER")
src/app/api/admin/payments/refund/route.ts: requireRole("OWNER")
src/app/api/admin/payments/sslcommerz/test-connection/route.ts: requireRole("MANAGER")
src/app/api/admin/payments/status/route.ts: requireRole("MANAGER")
src/app/api/admin/pms/test-connection/route.ts: requireRole("OWNER")
src/app/api/admin/reports/payments/route.ts: requireRole("MANAGER")

$ pnpm check:guards
$ bash scripts/check-admin-api-guards.sh && bash scripts/check-admin-actions-guards.sh
✓ All admin, cron and webhook route handlers are guarded
✓ Every exported Server Action in src/app/actions/admin-actions.ts calls a guard
```

## 2. Middleware matches /api/admin/* — ✅

The session is validated server-side on the Node.js runtime.

```
$ cat src/middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";

/**
 * Validates the Better Auth session server-side for every admin page and
 * admin API route. A cookie merely being present is not enough — a forged
 * or expired token must be rejected here, before any handler runs.
 *
 * Page and action guards (requireRole / requireAuth) still run; this is the
 * outer layer, not a replacement.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/admin/login") {
    return NextResponse.next();
  }

  const session = await auth.api
    .getSession({ headers: request.headers })
    .catch(() => null);

  if (session) {
    return NextResponse.next();
  }

  // API clients expect JSON, not a redirect to an HTML login page.
  if (pathname.startsWith("/api/admin")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/admin/login", request.url);
  loginUrl.searchParams.set("redirect", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
  // Session validation reads the database through Prisma, which needs Node.js.
  runtime: "nodejs",
};
```

## 3. Session forgery test returns 401 — ✅

Final build. Includes the page redirect, PMS webhook and cron checks.

```
# Production build of 5159cf7, next start -p 3100, DATABASE_URL=resort_dev

# Session forgery test
$ curl -i -X POST http://localhost:3100/api/admin/pms/test-connection -H "Cookie: better-auth.session_token=fake-token-12345" -H "Content-Type: application/json"
HTTP/1.1 401 Unauthorized
content-type: application/json

{"error":"Unauthorized"}


# Forged cookie on an admin page
$ curl -s -o /dev/null -w "%{http_code} %{redirect_url}" http://localhost:3100/admin/bookings -H "Cookie: better-auth.session_token=fake-token-12345"
307 http://localhost:3100/admin/login?redirect=%2Fadmin%2Fbookings

# Self-signup test (the brief's path — not a Better Auth route, so 404)
$ curl -i -X POST http://localhost:3100/api/auth/sign-up -H "Content-Type: application/json" -d '{"email":"test@test.com","password":"password123","name":"Test"}'
HTTP/1.1 404 Not Found

# Self-signup test (Better Auth's real endpoint)
$ curl -i -X POST http://localhost:3100/api/auth/sign-up/email -H "Content-Type: application/json" -d '{"email":"attacker@example.com","password":"hunter2hunter2","name":"Attacker"}'
HTTP/1.1 400 BAD_REQUEST
content-type: application/json

{"message":"Email and password sign up is not enabled","code":"EMAIL_PASSWORD_SIGN_UP_DISABLED"}


# PMS webhook, no PMS_WEBHOOK_SECRET configured
$ curl -i -X POST http://localhost:3100/api/webhooks/pms/gyoroom -H "Content-Type: application/json" -d '{"event":"booking.created","data":{}}'
HTTP/1.1 401 Unauthorized
content-type: application/json

{"error":"Unauthorized PMS webhook request"}


# Cron route without the cron secret
$ curl -s -o /dev/null -w "%{http_code}" http://localhost:3100/api/cron/pms-sync
401

$ psql resort_dev -c "select count(*) from \"User\" where email in (...)"   # no accounts created
0
```

## 4. Self-signup disabled — ✅

See item 3. The brief's URL `/api/auth/sign-up` is not a Better Auth route, so it 404s whatever the setting. The real endpoint `/api/auth/sign-up/email` returns `400 EMAIL_PASSWORD_SIGN_UP_DISABLED`. No accounts were created.

## 5. User.role is a Prisma enum — ✅

Native PostgreSQL enum. Unknown and NULL roles are rejected by the copy script (item 12).

```
$ grep -n "role " prisma/schema.prisma; sed -n "/^enum UserRole/,/^}/p" prisma/schema.prisma
16:  role             UserRole    @default(STAFF)
enum UserRole {
  OWNER
  MANAGER
  STAFF
  FRONT_DESK
  HOUSEKEEPING
  KITCHEN
  STOREKEEPER
  ACCOUNTANT
  HR
  AUDITOR
}

$ grep -nE "UserRole|\"role\"" prisma/migrations/*_init_postgres/migration.sql
2:CREATE TYPE "UserRole" AS ENUM ('OWNER', 'MANAGER', 'STAFF', 'FRONT_DESK', 'HOUSEKEEPING', 'KITCHEN', 'STOREKEEPER', 'ACCOUNTANT', 'HR', 'AUDITOR');
17:    "role" "UserRole" NOT NULL DEFAULT 'STAFF',
```

## 6. AuditLog has new columns — ✅

13 standalone writes use `logAudit()`. The 7 remaining direct writes sit inside `prisma.$transaction` and stay atomic, by design.

```
$ sed -n "/^model AuditLog/,/^}/p" prisma/schema.prisma
model AuditLog {
  id        String   @id @default(uuid())
  userId    String?
  user      User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  action    String
  entity    String
  entityId  String?
  metadata  String?  // JSON string
  createdAt DateTime @default(now())
  module    String?  // e.g. "BOOKING", "PAYMENT", "INVENTORY"
  ipAddress String?
  userAgent String?
  diff      Json?    // before/after snapshot

  @@index([entity, entityId])
  @@index([createdAt])
  @@index([userId, createdAt])
}

$ migration SQL for AuditLog
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "module" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "diff" JSONB,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);
414:CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");
417:CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
420:CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

$ grep -rn "logAudit(" src --include=*.ts --include=*.tsx | wc -l;  grep -rn "auditLog.create" src | grep -v src/lib/audit.ts
      13
src/app/actions/admin-actions.ts:133:      await tx.auditLog.create({
src/app/actions/admin-actions.ts:213:      prisma.auditLog.create({
src/app/actions/admin-actions.ts:609:        await tx.auditLog.create({
src/app/actions/admin-actions.ts:703:      await tx.auditLog.create({
src/lib/payments/banglaqr/manual-verifier.ts:74:    prisma.auditLog.create({
src/lib/payments/banglaqr/manual-verifier.ts:173:    prisma.auditLog.create({
src/lib/payments/banglaqr/manual-verifier.ts:239:    prisma.auditLog.create({
```

## 7. 2FA enforced for OWNER — ✅

Enforcement points, then an HTTP run: OWNER without 2FA → settings answer with a streamed redirect to `/admin/setup-2fa` and no settings content; after enrolment → settings render. Then a browser login with a live TOTP code (fix `0bf28de`).

```
$ grep -rn "requireMfa" src
src/app/admin/settings/page.tsx:1:import { requireRole, requireMfa } from "@/lib/auth-helpers";
src/app/admin/settings/page.tsx:8:  await requireMfa();
src/app/admin/settings/payments/page.tsx:1:import { requireRole, requireMfa } from "@/lib/auth-helpers";
src/app/admin/settings/payments/page.tsx:11:  await requireMfa();
src/app/admin/settings/integrations/page.tsx:1:import { requireRole, requireMfa } from "@/lib/auth-helpers";
src/app/admin/settings/integrations/page.tsx:12:  await requireMfa();
src/app/admin/setup-2fa/page.tsx:6:// Deliberately guarded by requireAuth only — requireMfa redirects here, so
src/app/actions/admin-actions.ts:5:import { requireRole, requireMfa } from "@/lib/auth-helpers";
src/app/actions/admin-actions.ts:238:  await requireMfa();
src/lib/auth-helpers.ts:58:export async function requireMfa(): Promise<SessionUser> {

$ grep -n "disableSignUp" src/lib/auth.ts
20:    disableSignUp: true, // Users are created via invitation only
```

OWNER without 2FA, `GET /admin/settings` (status 200 because the page streams; the redirect is embedded and no settings content is sent):
```
NEXT_REDIRECT;replace;/admin/setup-2fa;307;
http-equiv="refresh" content="1;url=/admin/setup-2fa"
settings content markers: 0
```

```
$ POST /api/auth/two-factor/enable {password}
totpURI present: true | backup codes: 10
$ POST /api/auth/two-factor/verify-totp {code: <computed TOTP>}
200
$ psql: twoFactorEnabled
owner-test@example.com|t

# After enrolment: settings render (no redirect, settings content present)
GET /admin/settings -> 200
NEXT_REDIRECT to setup-2fa: 0  |  settings content markers: 1
```

## 8. Postgres migration applied cleanly — ✅

Applied to a brand-new empty database (the brief's "fresh Postgres instance" check).

```
# Brand-new empty database resort_verify_fresh
$ DATABASE_URL=postgresql://resort:***@localhost:5432/resort_verify_fresh pnpm prisma migrate deploy
Loaded Prisma config from prisma.config.ts.
Prisma config detected, skipping environment variable loading.
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "resort_verify_fresh", schema "public" at "localhost:5432"
3 migrations found in prisma/migrations
Applying migration `20260929033828_init_postgres`
Applying migration `20260929034709_add_money_poisha_columns`
Applying migration `20260929034816_backfill_money_poisha`
The following migration(s) have been applied:
migrations/
  └─ 20260929033828_init_postgres/
    └─ migration.sql
  └─ 20260929034709_add_money_poisha_columns/
    └─ migration.sql
  └─ 20260929034816_backfill_money_poisha/
    └─ migration.sql
All migrations have been successfully applied.

$ DATABASE_URL=.../resort_verify_fresh pnpm prisma migrate status
3 migrations found in prisma/migrations
Database schema is up to date!
$ psql resort_verify_fresh -c "\dt"  (table count)
24
```

## 9. Migration drift check passes — ✅

Then the drift *test* proven to catch drift, plus its skip and CI modes.

```
$ pnpm prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url "postgresql://resort:***@localhost:5432/resort_shadow" --exit-code
No difference detected.
exit code: 0
```

```
# 1. Drift: add Guest.driftProbe to schema.prisma with no migration
     × match schema.prisma with no drift 904ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  prisma/migrations.test.ts > prisma migrations > match schema.prisma with no drift
AssertionError: prisma migrate diff reported drift or failed:
  [+] Added column `driftProbe`
      Tests  1 failed (1)
exit: 1

# 2. No SHADOW_DATABASE_URL (local default): skipped
 Test Files  1 skipped (1)
      Tests  1 skipped (1)

# 3. REQUIRE_DB_TESTS=1 without SHADOW_DATABASE_URL (CI misconfigured): fails
     × has SHADOW_DATABASE_URL set 2ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: REQUIRE_DB_TESTS=1 but SHADOW_DATABASE_URL is not set
     20|       expect.fail("REQUIRE_DB_TESTS=1 but SHADOW_DATABASE_URL is not s…
exit: 1
```

## 10. pnpm build uses migrate deploy — ✅

```
$ git diff 528e109 -- package.json  (scripts)
   "scripts": {
     "postinstall": "prisma generate",
     "dev": "next dev",
-    "db:push": "prisma db push",
-    "db:seed": "tsx prisma/seed.ts",
-    "build": "prisma generate && prisma db push && next build",
+    "db:migrate": "prisma migrate dev",
+    "db:deploy": "prisma migrate deploy",
+    "db:seed": "prisma db seed",
+    "db:reset": "prisma migrate reset --force --skip-seed && prisma db seed",
+    "build": "prisma generate && prisma migrate deploy && next build",
     "start": "next start",
-    "check:admin-api": "bash scripts/check-admin-api-guards.sh",
-    "lint": "eslint . && pnpm check:admin-api"
+    "check:guards": "bash scripts/check-admin-api-guards.sh && bash scripts/check-admin-actions-guards.sh",
+    "check:money": "bash scripts/check-no-float-money.sh",
+    "lint": "eslint . && pnpm check:guards && pnpm check:money",
+    "test": "vitest run",
+    "test:watch": "vitest",
+    "test:coverage": "vitest run --coverage"
   },
```

## 11. No db push references remain — ✅

The only matches are the two `docs/rms` records of the pre-A1 state.

```
$ grep -rn "db push" package.json docs/ README.md
docs/rms/00-CURRENT-STATE.md:22:| **F4** `db push` / drifted migrations | ✅ Resolved | One re-baselined PostgreSQL init migration plus two additive money migrations. The build runs `prisma migrate deploy`. A test fails on schema/migration drift. | same |
docs/rms/00-CURRENT-STATE.md:46:| F4 | `pnpm build` runs **`prisma db push`**, not `migrate deploy` (`package.json:10`). `main` has only **3 migrations**, and the blog models (`BlogPost`, `BlogImage`, `BlogCategory`, `BlogTag`, `BlogSettings`, `BlogSubmissionAttempt`) and `ProcessedWebhook` exist in the schema **with no migration**. | High | Migration history no longer matches the schema. It must be re-baselined as part of the Postgres move. The build must switch to `migrate deploy`. |
docs/rms/00-CURRENT-STATE.md:197:| Prisma migrations | ⚠️ | 3 migrations (`init`, `add_payment_id_to_payment`, `add_guest_count_to_booking`). The build uses `db push` instead (F4). |
docs/rms/phase-a1/00-BASELINE.md:13:| F4 build uses `db push` | ✅ `package.json:10`, plus a `db:push` script at `:8` | ✅ |
docs/rms/phase-a1/00-BASELINE.md:73:$ grep -n "db push\|migrate deploy" package.json
docs/rms/phase-a1/00-BASELINE.md:74:8:    "db:push": "prisma db push",
docs/rms/phase-a1/00-BASELINE.md:75:10:    "build": "prisma generate && prisma db push && next build",
docs/rms/phase-a1/01-COMPLETION.md:11:| Database | PostgreSQL 16. One re-baselined init migration plus two additive money migrations. The build runs `prisma migrate deploy`, and no `db push` remains. SQLite data is copied by a checked script. |
(the only hits are docs/rms/00-CURRENT-STATE.md and docs/rms/phase-a1/00-BASELINE.md, which record the pre-A1 state)

$ grep -rn "db push\|db:push" --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git --exclude-dir=rms .
exit: 1 (1 = no matches)
```

## 12. SQLite data migrated to Postgres — ✅

Row counts for all 23 tables, field-level fidelity, then the refusal and abort paths, including a copy from the untouched pre-A1 file.

```
$ DATABASE_URL="postgresql://resort:***@localhost:5432/resort_dev" pnpm exec tsx scripts/migrate-sqlite-to-postgres.ts --sqlite prisma/dev.db

Table                    SQLite  Postgres
User                          3         3
Session                       9         9
Account                       3         3
Verification                  0         0
TwoFactor                     0         0
Destination                   6         6
Room                          8         8
Guest                         4         4
Booking                       4         4
BookingLog                    5         5
Payment                       2         2
PaymentLog                    0         0
Lead                          1         1
GoogleReviewCache             4         4
AuditLog                      8         8
BlogCategory                  1         1
BlogTag                       0         0
BlogSettings                  1         1
BlogPost                      1         1
BlogImage                     0         0
BlogSubmissionAttempt         0         0
ProcessedWebhook              0         0
_BlogPostTags                 0         0

✓ All rows copied; counts match.
exit: 0
```

```
# Booking: bookingCode | checkInDate (epoch ms) | totalAmount | status
## SQLite
RES-219031|1793491200000|17000.0|CANCELLED
RES-396944|1791590400000|17000.0|CANCELLED
RES-460838|1791590400000|17000.0|CANCELLED
RES-943999|1790640000000|8500.0|PENDING
## Postgres
RES-219031|1793491200000|17000|CANCELLED
RES-396944|1791590400000|17000|CANCELLED
RES-460838|1791590400000|17000|CANCELLED
RES-943999|1790640000000|8500|PENDING

# User: email | role | emailVerified
## SQLite
admin@demo.resort|OWNER|1
owner@clientresort.com|OWNER|1
staff@demo.resort|STAFF|1
## Postgres
admin@demo.resort|OWNER|1
owner@clientresort.com|OWNER|1
staff@demo.resort|STAFF|1

# Room: slug | pricePerNight | isActive
## SQLite
coxs-bazar-oceanfront-deluxe|12500.0|1
coxs-bazar-sunset-royal-villa|22000.0|1
kuakata-horizon-sunrise-room|6500.0|1
saint-martins-coral-view-cottage|9500.0|1
sajek-cloud-view-wooden-cottage|8500.0|1
sreemangal-executive-tea-view|10500.0|1
sreemangal-presidential-golf-suite|28000.0|1
sundarbans-mangrove-safari-cabin|7500.0|1
## Postgres
coxs-bazar-oceanfront-deluxe|12500|1
coxs-bazar-sunset-royal-villa|22000|1
kuakata-horizon-sunrise-room|6500|1
saint-martins-coral-view-cottage|9500|1
sajek-cloud-view-wooden-cottage|8500|1
sreemangal-executive-tea-view|10500|1
sreemangal-presidential-golf-suite|28000|1
sundarbans-mangrove-safari-cabin|7500|1
```

```
# Negative test 1: re-run into the now-populated resort_dev (must refuse)
$ pnpm exec tsx scripts/migrate-sqlite-to-postgres.ts --sqlite prisma/dev.db

❌ Target is not empty: User (3), Session (9), Account (3), Destination (6), Room (8), Guest (4), Booking (4), BookingLog (5), Payment (2), Lead (1), GoogleReviewCache (4), AuditLog (8), BlogCategory (1), BlogSettings (1), BlogPost (1). Refusing to copy into existing data.
exit: 1

# Negative test 2: unexpected role values in the source (must abort, write nothing)
Error: stepping, NOT NULL constraint failed: User.role (19)
$ sqlite3 badroles.db "select email, quote(role) from User"
admin@demo.resort|'OWNER'
owner@clientresort.com|'OWNER'
staff@demo.resort|'SUPERADMIN'
The following migration(s) have been applied:
All migrations have been successfully applied.
$ DATABASE_URL=.../resort_negtest pnpm exec tsx scripts/migrate-sqlite-to-postgres.ts --sqlite badroles.db

❌ Source data does not fit the target schema. Nothing was written:
   - User.role (id=Vq6c27HgCOSxDDaPOUH96iRvsVLicl6j): "SUPERADMIN" is not a UserRole value (OWNER, MANAGER, STAFF, FRONT_DESK, HOUSEKEEPING, KITCHEN, STOREKEEPER, ACCOUNTANT, HR, AUDITOR)
exit: 1
$ psql resort_negtest -c "select count(*) from \"User\""  # nothing written
0
```

```
# Test 3: full copy from the untouched pre-A1 SQLite file (production-shaped: role String?, no AuditLog context columns)
$ sqlite3 dev.db.pre-a1.bak "select name, \"notnull\" from pragma_table_info('User') where name='role'"
role|0
$ pnpm exec tsx scripts/migrate-sqlite-to-postgres.ts --sqlite dev.db.pre-a1.bak
BlogImage                     0         0
BlogSubmissionAttempt         0         0
ProcessedWebhook              0         0
_BlogPostTags                 0         0

✓ All rows copied; counts match.
exit: 0

# Test 4: NULL role in a pre-A1 file (must abort, write nothing)
admin@demo.resort|'OWNER'
owner@clientresort.com|'OWNER'
staff@demo.resort|NULL
$ pnpm exec tsx scripts/migrate-sqlite-to-postgres.ts --sqlite nullrole.db

❌ Source data does not fit the target schema. Nothing was written:
   - User.role (id=Vq6c27HgCOSxDDaPOUH96iRvsVLicl6j): null, but UserRole is required
exit: 1
User rows written: 0
```

```
$ docker compose -f docker-compose.dev.yml up -d
 Container travelwebtemplate-postgres-1 Recreate 
 Container travelwebtemplate-postgres-1 Recreated 
 Container travelwebtemplate-postgres-1 Starting 
 Container travelwebtemplate-postgres-1 Started 

$ DATABASE_URL=.../resort_dev pnpm prisma migrate deploy
Loaded Prisma config from prisma.config.ts.
Prisma config detected, skipping environment variable loading.
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "resort_dev", schema "public" at "localhost:5432"
1 migration found in prisma/migrations
No pending migrations to apply.

# Row counts: Postgres (resort_dev, after data copy) vs SQLite source
$ psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"Booking\";"
 count 
-------
     4
(1 row)

$ psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"Room\";"
 count 
-------
     8
(1 row)

$ sqlite3 -readonly prisma/dev.db "SELECT COUNT(*) FROM Booking; SELECT COUNT(*) FROM Room;"
4
8

# Seed check on a separate scratch database (the seed deletes rooms/bookings/payments first, so it is never run on resort_dev)
$ DATABASE_URL=.../resort_seedtest pnpm db:deploy
1 migration found in prisma/migrations
Applying migration `20260929033828_init_postgres`
The following migration(s) have been applied:
migrations/
    └─ migration.sql
All migrations have been successfully applied.
$ DATABASE_URL=.../resort_seedtest pnpm db:seed
Imported markdown blog post to database: sajek-valley-cloud-season-guide
Imported markdown blog post to database: top-5-things-to-do-in-sreemangal
Imported markdown blog post to database: ultimate-coxs-bazar-travel-guide
Blog system seeding completed!
Seeding completed successfully!
🌱  The seed command has been executed.
exit: 0
$ psql resort_seedtest -c counts
 destinations | rooms | blog_posts 
--------------+-------+------------
            6 |     8 |          3
(1 row)
```

## 13. *Poisha columns added and backfilled — ✅

On `resort_dev`, then the migration's guard against sub-poisha values, then the repair script's rollback-drift handling.

```
$ pnpm db:deploy
3 migrations found in prisma/migrations
Applying migration `20260929034816_backfill_money_poisha`
The following migration(s) have been applied:
migrations/
    └─ migration.sql
All migrations have been successfully applied.

$ pnpm exec tsx scripts/backfill-poisha.ts
Table     rows  lossy  null->filled  mismatched  (after)
Room         8      0             0           0  
Booking      4      0             0           0  
Payment      2      0             0           0  

✓ Every *Poisha column is filled and equals ROUND(float * 100).
exit: 0

$ psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"Room\" WHERE \"pricePerNightPoisha\" IS NULL;"
 count 
-------
     0
(1 row)

$ ... Booking / Payment NULL counts
 booking_nulls | payment_nulls 
---------------+---------------
             0 |             0
(1 row)

$ psql $DATABASE_URL -c "SELECT \"totalAmount\", \"totalAmountPoisha\" FROM \"Booking\" LIMIT 5;"
 totalAmount | totalAmountPoisha | exact 
-------------+-------------------+-------
       17000 |           1700000 | t
       17000 |           1700000 | t
       17000 |           1700000 | t
        8500 |            850000 | t
(4 rows)

 pricePerNight | pricePerNightPoisha 
---------------+---------------------
          6500 |              650000
          7500 |              750000
          8500 |              850000
          9500 |              950000
         10500 |             1050000
         12500 |             1250000
         22000 |             2200000
         28000 |             2800000
(8 rows)

 amount | amountPoisha 
--------+--------------
  17000 |      1700000
  17000 |      1700000
(2 rows)
```

```
applied 20260929033828_init_postgres
applied 20260929034709_add_money_poisha_columns
# Planted: Room.pricePerNight = 100.005 (half a poisha)
$ psql resort_negtest < backfill_money_poisha/migration.sql
ERROR:  Money backfill aborted: values finer than one poisha (Room: 1, Booking: 0, Payment: 0). Inspect and correct them before deploying.
CONTEXT:  PL/pgSQL function inline_code_block line 15 at RAISE
exit: 3
$ select "pricePerNightPoisha" from "Room"   # untouched
NULL

# Corrected to 100.05 and re-run
UPDATE 1
UPDATE 0
UPDATE 0
exit: 0
100.05|10005
```

```
# Simulated rollback: old code created a booking (Poisha NULL) and edited another booking's Float
$ pnpm exec tsx scripts/backfill-poisha.ts --check
Table     rows  lossy  null->filled  mismatched  (after)
Room         8      0             0           0  
Booking      4      0             0           1  1 NULL (check only)
❌ Booking: 1 row(s) where totalAmountPoisha <> ROUND(totalAmount * 100). Confirm which value is right; rerun with --resync-from-float to copy the Float.
Payment      2      0             0           0  
exit: 1

$ pnpm exec tsx scripts/backfill-poisha.ts            # fills the NULL, refuses to guess on the mismatch
Table     rows  lossy  null->filled  mismatched  (after)
Room         8      0             0           0  
Booking      4      0             1           1  
❌ Booking: 1 row(s) where totalAmountPoisha <> ROUND(totalAmount * 100). Confirm which value is right; rerun with --resync-from-float to copy the Float.
Payment      2      0             0           0  
exit: 1

$ pnpm exec tsx scripts/backfill-poisha.ts --resync-from-float
Table     rows  lossy  null->filled  mismatched  (after)
Room         8      0             0           0  
Booking      4      0             0           0  
Payment      2      0             0           0  

✓ Every *Poisha column is filled and equals ROUND(float * 100).
exit: 0
```

## 14. Every Float money read updated — ✅

```
$ grep -rn "pricePerNight\|totalAmount\|\.amount" src/ --include="*.ts" --include="*.tsx" | grep -v "Poisha"   (the brief's command)
src/app/admin/bookings/BookingsView.tsx:211:                <th className="p-3.5">{b.totalAmountLabel}</th>
src/app/admin/bookings/[id]/BookingDetailView.tsx:404:                  {d.amountChangeReason}
src/app/admin/bookings/[id]/BookingDetailView.tsx:409:                  placeholder={d.amountChangeReasonPlaceholder}
src/app/admin/bookings/[id]/BookingDetailView.tsx:539:                  {d.pricePerNightLabel}
src/app/admin/bookings/new/NewBookingView.tsx:205:              <label className="font-medium text-foreground">{n.totalAmountLabel}</label>
src/app/admin/rooms/RoomsView.tsx:107:                      {t.adminBookingDetail.pricePerNightLabel}
src/app/api/webhooks/pms/[provider]/route.ts:42:        const { bookingCode, roomId, guestName, guestEmail, guestPhone, checkInDate, checkOutDate, totalAmount: pmsTotalTaka } = data || {}; // legacy-money-ok: external PMS field
src/content/bn.ts:541:    totalAmountLabel: "মোট পরিমাণ",
src/content/bn.ts:569:    pricePerNightLabel: "প্রতি রাতের ভাড়া",
src/content/bn.ts:613:    totalAmountLabel: "মোট পরিমাণ (টাকা)",
src/content/bn.ts:661:    pricePerNightLabel: "প্রতি রাতের মূল্য (টাকা)",
src/content/en.ts:539:    totalAmountLabel: "Total Amount",
src/content/en.ts:567:    pricePerNightLabel: "Price Per Night",
src/content/en.ts:611:    totalAmountLabel: "Total Amount (BDT)",
src/content/en.ts:659:    pricePerNightLabel: "Price per Night (BDT)",
src/components/travel/BanglaQRPaymentPanel.tsx:269:            {labels?.amountLabel || "Amount to pay"}
src/components/admin/RoomForm.tsx:188:              {e.pricePerNightLabel}
src/lib/payments/bkash/execute-payment.ts:46:    if (isSuccess && res.amount) {
src/lib/payments/bkash/execute-payment.ts:85:            note: `Payment confirmed via bKash. trxID: ${res.trxID}, Amount: BDT ${res.amount}`,
src/lib/payments/sslcommerz/validate-payment.ts:170:          amount: valRes.amount,
src/lib/pms/types.ts:16:  totalAmount?: number; // legacy-money-ok: external PMS contract, taka
src/lib/pms/types.ts:33:  pricePerNight?: number; // legacy-money-ok: external PMS contract, taka
src/lib/pms/adapters/gyoroom-adapter.ts:64:      pricePerNight: 8500, // legacy-money-ok: external PMS contract, taka
src/lib/payments/bkash/refund-payment.ts:87:        amount: res.amount,

None of these is a read of a Prisma money field. They are: translation label keys and their uses (`totalAmountLabel`, `pricePerNightLabel` — the brief's pattern has no word boundary, so it also matches `amountChangeReason` and `amountLabel`); the external PMS contract (lines marked `legacy-money-ok`); and gateway responses (`res.amount`, `valRes.amount` from bKash/SSLCommerz). The type-aware rule below is the authoritative check:

$ pnpm exec eslint src prisma scripts | grep -c no-deprecated   (0 = no read of a deprecated Prisma money field)
0

$ pnpm check:money
$ bash scripts/check-no-float-money.sh
✓ No legacy Float money field names outside src/lib/money-legacy.ts
```

## 15. Money library tests pass — ✅

Full suite, verbose, with `REQUIRE_DB_TESTS=1`.

```

 RUN  v4.1.11 /Users/mdamirhossain/ViveScript-Solutions/projects/TravelWebTemplate

 ✓ src/lib/auth-helpers.test.ts > requireAuth > redirects to login without a session 14ms
 ✓ src/lib/auth-helpers.test.ts > requireRole > forbids STAFF from a MANAGER-only resource 0ms
 ✓ src/lib/auth-helpers.test.ts > requireRole > forbids STAFF from a OWNER-only resource 0ms
 ✓ src/lib/auth-helpers.test.ts > requireRole > forbids MANAGER from a OWNER-only resource 0ms
 ✓ src/lib/auth-helpers.test.ts > requireRole > allows STAFF into a STAFF resource 0ms
 ✓ src/lib/auth-helpers.test.ts > requireRole > allows MANAGER into a STAFF resource 0ms
 ✓ src/lib/auth-helpers.test.ts > requireRole > allows MANAGER into a MANAGER resource 0ms
 ✓ src/lib/auth-helpers.test.ts > requireRole > allows OWNER into a STAFF resource 0ms
 ✓ src/lib/auth-helpers.test.ts > requireRole > allows OWNER into a MANAGER resource 0ms
 ✓ src/lib/auth-helpers.test.ts > requireRole > allows OWNER into a OWNER resource 0ms
 ✓ src/lib/auth-helpers.test.ts > requireRole > treats an unknown role as the lowest level 1ms
 ✓ src/lib/auth-helpers.test.ts > requireRole > treats a missing role as STAFF 0ms
 ✓ src/lib/auth-helpers.test.ts > requireMfa > sends an OWNER without 2FA to /admin/setup-2fa 0ms
 ✓ src/lib/auth-helpers.test.ts > requireMfa > lets an OWNER with 2FA through 0ms
 ✓ src/lib/auth-helpers.test.ts > requireMfa > does not require 2FA for other roles 0ms
 ✓ src/lib/money.test.ts > toPoisha > converts whole taka 1ms
 ✓ src/lib/money.test.ts > toPoisha > converts a decimal string 0ms
 ✓ src/lib/money.test.ts > toPoisha > rounds sub-poisha input to the nearest poisha 0ms
 ✓ src/lib/money.test.ts > toPoisha > is not fooled by binary floating point 0ms
 ✓ src/lib/money.test.ts > toPoisha > rejects NaN 0ms
 ✓ src/lib/money.test.ts > toPoisha > rejects Infinity 0ms
 ✓ src/lib/money.test.ts > toPoisha > rejects -Infinity 0ms
 ✓ src/lib/money.test.ts > toPoisha > rejects abc 0ms
 ✓ src/lib/money.test.ts > toPoisha > rejects  0ms
 ✓ src/lib/money.test.ts > fromPoisha > converts back to taka 0ms
 ✓ src/lib/money.test.ts > roundtrip > fromPoisha(toPoisha(x)) === x for 100 random whole-taka integers 1ms
 ✓ src/lib/money.test.ts > roundtrip > toPoisha(fromPoisha(p)) === p for 100 random poisha integers 1ms
 ✓ src/lib/money.test.ts > formatBdt > formats whole taka without decimals 15ms
 ✓ src/lib/money.test.ts > formatBdt > formats poisha with two decimals 0ms
 ✓ src/lib/money.test.ts > formatBdt > formats zero 0ms
 ✓ src/lib/money.test.ts > formatBdt > uses Bengali digits for bn 0ms
 ✓ src/lib/money.test.ts > poishaToTakaString (gateway payloads) > 450000 -> 4500.00 0ms
 ✓ src/lib/money.test.ts > poishaToTakaString (gateway payloads) > 123456 -> 1234.56 0ms
 ✓ src/lib/money.test.ts > poishaToTakaString (gateway payloads) > 5 -> 0.05 0ms
 ✓ src/lib/money.test.ts > poishaToTakaString (gateway payloads) > 0 -> 0.00 0ms
 ✓ src/lib/money.test.ts > poishaToTakaString (gateway payloads) > -150 -> -1.50 0ms
 ✓ src/lib/money.test.ts > poishaToTakaString (gateway payloads) > rejects non-integers 0ms
 ✓ src/lib/money.test.ts > poishaMatches > accepts a one-poisha difference, as the Float comparison did 0ms
 ✓ src/lib/money.test.ts > poishaMatches > rejects anything larger 0ms
 ✓ src/lib/money.test.ts > requirePoisha > passes integers through 0ms
 ✓ src/lib/money.test.ts > requirePoisha > fails loudly on null or undefined 0ms
 ✓ src/lib/money.test.ts > sumPoisha > adds integers exactly 0ms
 ✓ src/lib/money.test.ts > AmountSchema > accepts non-negative integer poisha up to 100 crore taka 0ms
 ✓ src/lib/money.test.ts > AmountSchema > rejects -1 0ms
 ✓ src/lib/money.test.ts > AmountSchema > rejects 1.5 0ms
 ✓ src/lib/money.test.ts > AmountSchema > rejects 10000000001 0ms
 ✓ src/lib/money.test.ts > AmountSchema > rejects 100 0ms
 ✓ prisma/migrations.test.ts > prisma migrations > match schema.prisma with no drift 899ms

 Test Files  3 passed (3)
      Tests  48 passed (48)
   Start at  10:26:38
   Duration  1.03s (transform 90ms, setup 0ms, import 129ms, tests 939ms, environment 0ms)
```

## 16. Roundtrip tests pass — ✅

```
 ✓ src/lib/money.test.ts > roundtrip > fromPoisha(toPoisha(x)) === x for 100 random whole-taka integers 1ms
 ✓ src/lib/money.test.ts > roundtrip > toPoisha(fromPoisha(p)) === p for 100 random poisha integers 1ms
```

## 17. Backup script runs successfully — ✅

The host has no PostgreSQL client, so `pg_dump` 16 from the dev container was put on `PATH`. The script ran unchanged.

```
# Test environment: pg_dump resolves to the PostgreSQL 16 client inside the dev container (shim on PATH)
$ pg_dump --version
pg_dump (PostgreSQL) 16.15

# 1. Backup resort_dev (DATABASE_URL carries Prisma's ?schema=public)
before: db-20260801T000000Z.dump db-20260920T000000Z.dump 
$ DATABASE_URL="postgresql://resort:***@localhost:5432/resort_dev?schema=public" BACKUP_DIR=... scripts/backup-postgres.sh
✓ Backup written: <scratch>/backups/db-20260929T041133Z.dump ( 56K)
exit: 0
after:  db-20260920T000000Z.dump db-20260929T041133Z.dump 
(60-day-old dummy removed by 30-day retention; 9-day-old one kept)
-rw-r--r-- 0 db-20260920T000000Z.dump
-rw------- 55278 db-20260929T041133Z.dump

# 2. Failure leaves nothing behind
$ DATABASE_URL="postgresql://resort:wrong@localhost:5432/does_not_exist" scripts/backup-postgres.sh
pg_dump: error: connection to server at "localhost" (::1), port 5432 failed: FATAL:  database "does_not_exist" does not exist
exit: 1
files before: 2, after: 2, partial files: 0
```

## 18. Restore procedure tested once — ✅

```
# Restore drill: db-20260929T041133Z.dump -> fresh database resort_restore_test
$ pg_restore --no-owner --exit-on-error --dbname=resort_restore_test < db-...dump
exit: 0

source   resort_dev:          AuditLog=8 BlogPost=1 Booking=4 Destination=6 Guest=4 Payment=2 Room=8 Session=9 User=3 _prisma_migrations=3
restored resort_restore_test: AuditLog=8 BlogPost=1 Booking=4 Destination=6 Guest=4 Payment=2 Room=8 Session=9 User=3 _prisma_migrations=3
Booking totalAmountPoisha sum: source 5950000 / restored 5950000

$ DATABASE_URL=.../resort_restore_test pnpm exec prisma migrate status
3 migrations found in prisma/migrations
Database schema is up to date!
```

## 19. Documentation updated — ✅

```
$ git diff --stat 528e109 -- "*.md" README.md docs
 CLIENT-ONBOARDING.md               |  14 +--
 README.md                          |  29 ++++-
 docs/DEPLOYMENT.md                 | 147 +++++++++++++++++++++---
 docs/PAYMENTS-NAGAD.md             |   2 +-
 docs/blog/DATA-MODEL.md            |   2 +-
 docs/rms/00-CURRENT-STATE.md       |  24 ++++
 docs/rms/phase-a1/00-BASELINE.md   | 229 +++++++++++++++++++++++++++++++++++++
 docs/rms/phase-a1/01-COMPLETION.md | 117 +++++++++++++++++++
 8 files changed, 534 insertions(+), 30 deletions(-)
```

---

# Additional runtime verification (beyond the checklist)

## A. Admin Server Actions through the real UI

Browser (Playwright), production build, OWNER signed in with 2FA: create an offline booking → edit its amount → cancel with a cash refund.

```
# UI run (Playwright, production build, OWNER with 2FA): create offline booking 12,345 -> edit to 13,000 -> cancel with 5,000 cash refund
$ psql: booking
 bookingCode |  status   | totalAmount | totalAmountPoisha 
-------------+-----------+-------------+-------------------
 RES-692557  | CANCELLED |       13000 |           1300000
(1 row)

$ psql: payments
 provider |     status     | transactionId | amount | amountPoisha 
----------+----------------+---------------+--------+--------------
 CASH     | PAY_AT_CHECKIN |               |  12345 |      1234500
 CASH     | REFUNDED       | A1-UI-REFUND  |   5000 |       500000
(2 rows)

$ psql: booking log
OFFLINE_BOOKING_CREATED | Entered by Seed Test (OWNER) — source: WALK_IN, payment: PAY_AT_CHECKIN via CASH
BOOKING_EDITED | Edited by Seed Test (OWNER). Changes: amount: ৳12,345 -> ৳13,000 (reason: A1 UI verification: rate correction)
STATUS_CHANGED_TO_CANCELLED | Cancelled by Seed Test (OWNER). Refund recorded: ৳5,000 via CASH (ref: A1-UI-REFUND).
$ psql: audit rows
OFFLINE_BOOKING_CREATED | {"source":"WALK_IN","paymentStatus":"PAY_AT_CHECKIN"}
BOOKING_EDITED | {"diffs":["amount: ৳12,345 -> ৳13,000 (reason: A1 UI verification: rate correction)"]}
BOOKING_CANCELLED | {"refund":true,"refundAmountPoisha":500000}
$ pnpm exec tsx scripts/backfill-poisha.ts --check   (every row written by the UI is consistent)
Room         8      0             0           0  
Booking      2      0             0           0  
Payment      2      0             0           0  

✓ Every *Poisha column is filled and equals ROUND(float * 100).
```

## B. Public pages, booking API and admin pages

Production build on the seeded scratch database.

```
# Public pages (room coxs-bazar-oceanfront-deluxe, 12500 taka = 1250000 poisha)
GET /                                              200  ৳12,500 on page: 0
GET /destinations                                  200  ৳12,500 on page: 1
GET /destinations/coxs-bazar                       200  ৳12,500 on page: 2
GET /book/b875c9ae-6650-463e-a30a-13170c928918     200  ৳12,500 on page: 2
GET /press-kit                                     200  ৳12,500 on page: 0
GET /faq                                           200  ৳12,500 on page: 0

# schema.org Offer price on the destination page (must stay taka)
"price":12500
"price":22000
```

```
# press kit price range (seed min 6500, max 28000)
   4 ৳28,000
   4 ৳6,500

# Booking API: 3 nights x ৳12,500 = ৳37,500 = 3750000 poisha
$ curl -X POST /api/bookings -d {roomId, 2026-11-01 -> 2026-11-04, guest...}
{"success":true,"booking":{"id":"1dddc2d0-9b17-4b87-8077-42950efe4525","bookingCode":"RES-847031","totalAmountPoisha":3750000}}
$ psql: the stored booking
 bookingCode | totalAmount | totalAmountPoisha 
-------------+-------------+-------------------
 RES-847031  |       37500 |           3750000
(1 row)
```

```
$ POST /api/auth/sign-in/email (owner-test@example.com, OWNER, 2FA not enabled)
200

# Admin pages with a valid session
GET /admin                                                 200  ৳37,500: 1  ৳12,500: 0
GET /admin/bookings                                        200  ৳37,500: 1  ৳12,500: 0
GET /admin/bookings/1dddc2d0-9b17-4b87-8077-42950efe4525   200  ৳37,500: 1  ৳12,500: 1
GET /admin/rooms                                           200  ৳37,500: 0  ৳12,500: 1
GET /admin/guests                                          200  ৳37,500: 0  ৳12,500: 0
GET /admin/payments/banglaqr-verification                  200  ৳37,500: 0  ৳12,500: 0

# 2FA enforcement for OWNER without 2FA
GET /admin/settings -> 200 
GET /admin/settings/payments -> 200 
GET /admin/settings/integrations -> 200 
GET /admin/setup-2fa -> 200

# /api/admin with a valid session (guard lets OWNER through; JSON not 401)
{"success":true,"breakdown":[{"provider":"BKASH","totalAttempts":0,"successCount":0,"failedCount":0,"successRate":0,"totalRevenuePoisha":0},{"provider":"NAGAD","totalAttempts":0,"successCount":0,"failedCount":0,"successRate":0,"totalRevenuePoisha":0},{"provider":"SSLCOMMERZ","totalAttempts":0,"succe
```

## C. Docker image

`docker build --build-arg DATABASE_URL=...` after fix `adc8fdc`, then the image run.

```
docker build exit: 0 (214s)
#17 2.568 3 migrations found in prisma/migrations
#17 2.623 No pending migrations to apply.
#17 19.01 ✓ Compiled successfully in 15.7s
#17 53.07 ✓ Generating static pages using 7 workers (74/74) in 2.1s
```

```
$ docker run -p 3200:3000 -e DATABASE_URL=...host.docker.internal.../resort_dev resort-app:a1-verify
GET / -> 200  ৳12,500 on page: 0
GET /destinations -> 200  ৳12,500 on page: 1
GET /admin/login -> 200  ৳12,500 on page: 0
GET /admin/bookings (no session) -> 307 http://localhost:3200/admin/login?redirect=%2Fadmin%2Fbookings
{"error":"Unauthorized"}  (401)
$ docker logs (tail)
2026-09-29T04:23:09.929Z WARN [Better Auth]: [better-auth] Warning: your BETTER_AUTH_SECRET should be at least 32 characters long for adequate security. Generate one with `npx auth secret` or `openssl rand -base64 32`.
2026-09-29T04:23:09.930Z WARN [Better Auth]: [better-auth] Warning: your BETTER_AUTH_SECRET appears low-entropy. Use a randomly generated secret for production.
2026-09-29T04:23:10.109Z WARN [Better Auth]: [better-auth] Warning: your BETTER_AUTH_SECRET should be at least 32 characters long for adequate security. Generate one with `npx auth secret` or `openssl rand -base64 32`.
2026-09-29T04:23:10.110Z WARN [Better Auth]: [better-auth] Warning: your BETTER_AUTH_SECRET appears low-entropy. Use a randomly generated secret for production.
```

## D. Seeds with self-signup disabled

```
$ DATABASE_URL=.../resort_seedtest SEED_ADMIN_EMAIL=owner-test@example.com SEED_ADMIN_PASSWORD=*** pnpm exec tsx prisma/seed-admin.ts
prisma:query SELECT "public"."User"."id", "public"."User"."name", "public"."User"."email", "public"."User"."emailVerified", "public"."User"."image", "public"."User"."role"::text, "public"."User"."banned", "public"."User"."banReason", "public"."User"."banExpires", "public"."User"."twoFactorEnabled", "public"."User"."createdAt", "public"."User"."updatedAt" FROM "public"."User" WHERE ("public"."User"."email" = $1 AND 1=1) LIMIT $2 OFFSET $3
prisma:query SELECT "public"."User"."id", "public"."User"."name", "public"."User"."email", "public"."User"."emailVerified", "public"."User"."image", "public"."User"."role"::text, "public"."User"."banned", "public"."User"."banReason", "public"."User"."banExpires", "public"."User"."twoFactorEnabled", "public"."User"."createdAt", "public"."User"."updatedAt" FROM "public"."User" WHERE "public"."User"."email" = $1 LIMIT $2 OFFSET $3
prisma:query INSERT INTO "public"."User" ("id","name","email","emailVerified","role","banned","twoFactorEnabled","createdAt","updatedAt") VALUES ($1,$2,$3,$4,CAST($5::text AS "public"."UserRole"),$6,$7,$8,$9) RETURNING "public"."User"."id", "public"."User"."name", "public"."User"."email", "public"."User"."emailVerified", "public"."User"."image", "public"."User"."role"::text, "public"."User"."banned", "public"."User"."banReason", "public"."User"."banExpires", "public"."User"."twoFactorEnabled", "public"."User"."createdAt", "public"."User"."updatedAt"
prisma:query INSERT INTO "public"."Account" ("id","accountId","providerId","userId","password","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING "public"."Account"."id", "public"."Account"."accountId", "public"."Account"."providerId", "public"."Account"."userId", "public"."Account"."accessToken", "public"."Account"."refreshToken", "public"."Account"."idToken", "public"."Account"."accessTokenExpiresAt", "public"."Account"."refreshTokenExpiresAt", "public"."Account"."scope", "public"."Account"."password", "public"."Account"."createdAt", "public"."Account"."updatedAt"
prisma:query UPDATE "public"."User" SET "role" = CAST($1::text AS "public"."UserRole"), "emailVerified" = $2, "updatedAt" = $3 WHERE ("public"."User"."email" = $4 AND 1=1) RETURNING "public"."User"."id", "public"."User"."name", "public"."User"."email", "public"."User"."emailVerified", "public"."User"."image", "public"."User"."role"::text, "public"."User"."banned", "public"."User"."banReason", "public"."User"."banExpires", "public"."User"."twoFactorEnabled", "public"."User"."createdAt", "public"."User"."updatedAt"
Created OWNER admin user: owner-test@example.com / ***
Log in at /admin/login, then change this password immediately.
exit: 0
$ psql resort_seedtest: user + credential account
         email          | role  | emailVerified | providerId | has_password_hash 
------------------------+-------+---------------+------------+-------------------
 owner-test@example.com | OWNER | t             | credential | t
(1 row)
```

```
$ DATABASE_URL=.../resort_seedtest pnpm db:deploy
Applying migration `20260929034709_add_money_poisha_columns`
Applying migration `20260929034816_backfill_money_poisha`
The following migration(s) have been applied:
All migrations have been successfully applied.
$ DATABASE_URL=.../resort_seedtest pnpm db:seed
Blog system seeding completed!
Seeding completed successfully!
🌱  The seed command has been executed.
$ DATABASE_URL=.../resort_seedtest pnpm exec tsx scripts/backfill-poisha.ts --check
Table     rows  lossy  null->filled  mismatched  (after)
Room         8      0             0           0  
Booking      0      0             0           0  
Payment      0      0             0           0  

✓ Every *Poisha column is filled and equals ROUND(float * 100).
exit: 0
```

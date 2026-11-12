# Phase A2 §3: all ten roles active, and test users

Section 3 of the Phase A2 brief. The permissions themselves are in [01-ROLES-AND-PERMISSIONS.md](../01-ROLES-AND-PERMISSIONS.md). This file covers the STAFF → FRONT_DESK migration, the role labels, and one test sign-in per role.

## 1. Test users

`pnpm db:seed` creates one user per assignable role. It skips any user that already exists.

| Role | Email | Lands on after sign-in |
|---|---|---|
| OWNER | `test-owner@demo.resort` | `/admin` (must set up 2FA before Settings unlocks) |
| MANAGER | `test-manager@demo.resort` | `/admin` |
| FRONT_DESK | `test-front-desk@demo.resort` | `/admin/bookings` |
| HOUSEKEEPING | `test-housekeeping@demo.resort` | `/admin/housekeeping` (Phase B2; `/admin/rooms` before) |
| KITCHEN | `test-kitchen@demo.resort` | `/admin/room-service` (Phase C; `/admin/welcome` before) |
| STOREKEEPER | `test-storekeeper@demo.resort` | `/admin/inventory` (Phase D; `/admin/welcome` before) |
| ACCOUNTANT | `test-accountant@demo.resort` | `/admin` |
| HR | `test-hr@demo.resort` | `/admin/welcome` |
| AUDITOR | `test-auditor@demo.resort` | `/admin` |

**Password for all nine:** `Test-Role-2026!`. Set `SEED_TEST_USERS_PASSWORD` before seeding to use a different one.

- **Email format.** Emails follow `test-<role>@demo.resort`, with the role in lower case and `_` written as `-`.
- **STAFF has no test user.** STAFF is deprecated and never assigned (§2).
- **Display names** are "Test <label>", for example "Test Front Desk".
- **Re-seeding** keeps each user's password and resets their role if it has been changed. A test user therefore always has the role its email names.
- **HR** lands on the "modules not switched on yet" page, because the hr module is still off by default (`rms.modules` in `brand.config.ts`). KITCHEN and STOREKEEPER used to land there too, before the room-service (Phase C) and inventory (Phase D) modules shipped — they now land on their own boards (table above).

### When they are created

Code: `prisma/seed-test-users.ts` (`shouldSeedTestUsers`).

| `NODE_ENV` | `SEED_TEST_USERS` | Test users created? |
|---|---|---|
| not `production` (unset, `development`, `test`) | unset | yes |
| `production` | unset, or anything except `true` | **no** |
| `production` | `true` | yes (explicit opt-in, for example on a staging server) |
| anything | `false` | **no**: this always wins, to switch it off for good |

**A client VPS never gets these users by default:**
- Its `.env` sets `NODE_ENV="production"`, as [DEPLOYMENT.md](../../DEPLOYMENT.md) §2 requires.
- `prisma/seed.ts` loads `.env` itself, through `prisma/load-env.ts` using Node's built-in `process.loadEnvFile`, and shell variables take precedence. The gate therefore applies whether the seed is started by `pnpm db:seed` or directly with `tsx`.
- Tested: with `NODE_ENV=production` only in `.env`, and unset in the shell, `shouldSeedTestUsers()` returned `false` (see §5).

**If `NODE_ENV` is missing from a server's `.env`,** the seed treats it as a development machine. For that case the seed also prints every test user it creates, and `SEED_TEST_USERS=false` is available as a permanent off switch.

## 2. STAFF → FRONT_DESK

STAFF and FRONT_DESK have identical grants in the matrix, so the migration changes nobody's access. The legacy payment code is not affected either: the payment controls receive `toLegacyRole(role)`, which maps FRONT_DESK back to STAFF.

### The one-shot script

It runs by hand, not as a Prisma migration, so the operator sees who will change before anything is written.

```bash
pnpm users:staff-to-front-desk            # dry run: lists who would change, writes nothing
pnpm users:staff-to-front-desk --apply    # changes them
```

`scripts/migrate-staff-to-front-desk.ts`:
- **Prints the target database first** (`host/dbname`), so the operator can confirm it is the intended one.
- **Updates each user in its own transaction.** The update is conditional on the role still being STAFF. A user whose role an OWNER changed after the listing is skipped, not overwritten.
- **Writes one AuditLog row per changed user, in the same transaction.** The row is: `module "USERS"`, `action "USER_ROLE_CHANGED"`, `entity "User"`, `entityId` set to the user's id, and `diff {"before":{"role":"STAFF"},"after":{"role":"FRONT_DESK"}}`. There is no signed-in actor, so `userId` is null. `userAgent` and `metadata.actor` are `system:migrate-staff-to-front-desk`, and `metadata` also records the email and the reason.
- **Is safe to run again:** a second run prints "No STAFF users. Nothing to do." and writes nothing.

### Rollout on an existing deployment

1. **Deploy** the release as usual. `pnpm db:deploy` applies `20261001120000_user_role_default_front_desk`, which changes only the column default and no rows.
2. **Dry run:** `pnpm users:staff-to-front-desk`. Check the list.
3. **Apply:** `pnpm users:staff-to-front-desk --apply`. Sessions stay valid, because the role is read from the database on each request.

### Can new users be created as STAFF?

No. The enum value stays so that old rows and old sessions still parse, but nothing hands it out:

- **The role pickers** (Section 4's invite and change-role UI) use `ASSIGNABLE_ROLES`, which excludes STAFF.
- **The column default** is now `FRONT_DESK`, set by migration `20261001120000_user_role_default_front_desk` (schema default only; no row is touched).
- **Better Auth's `defaultRole`** is now `FRONT_DESK`. This covers `auth.api.createUser` without a role, for example `prisma/seed-admin.ts` before it promotes the user to OWNER.
- **A test** creates a user without a role and checks that it gets FRONT_DESK.

## 3. Role labels and descriptions

These are in `src/content/en.ts` and `bn.ts` under `roles`, keyed by the enum value (`t.roles[role].label` / `.description`).

| Role | Label (EN) | Label (BN) | Description (EN) | Description (BN) |
|---|---|---|---|---|
| OWNER | Owner | মালিক | Full access to all modules and settings | সব মডিউল ও সেটিংসে পূর্ণ অ্যাক্সেস |
| MANAGER | Manager | ম্যানেজার | Day-to-day operations, no financial admin | দৈনন্দিন কার্যক্রম, আর্থিক প্রশাসন নয় |
| FRONT_DESK | Front Desk | ফ্রন্ট ডেস্ক | Bookings, check-in/out, daily sheet | বুকিং, চেক-ইন/চেক-আউট, দৈনিক শিট |
| HOUSEKEEPING | Housekeeping | হাউসকিপিং | Room status, cleaning queue | রুমের অবস্থা, পরিষ্কারের তালিকা |
| KITCHEN | Kitchen | কিচেন | Room service tickets, kitchen inventory | রুম সার্ভিস টিকিট, কিচেনের মজুত |
| STOREKEEPER | Storekeeper | স্টোরকিপার | Inventory and purchase receipts | মজুত ও ক্রয়ের প্রাপ্তি |
| ACCOUNTANT | Accountant | হিসাবরক্ষক | Expenses, purchases, ledgers, reports | খরচ, ক্রয়, খতিয়ান, রিপোর্ট |
| HR | HR | এইচআর | Staff records, attendance, shifts | কর্মীদের রেকর্ড, হাজিরা, শিফট |
| AUDITOR | Auditor | নিরীক্ষক | Read-only access to all modules | সব মডিউলে শুধু দেখার অনুমতি |
| STAFF | (Deprecated) | (বাতিল) | Legacy role, do not assign | পুরোনো ভূমিকা, কাউকে দেবেন না |

**Where they show now:**
- the role badge in the admin sidebar and the mobile drawer, which used to show the raw enum, for example `FRONT_DESK`;
- the `/admin/welcome` message.

Section 4's user management UI will show the descriptions as well.

`src/content/roles.test.ts` checks three things:
- every role has a non-empty label and description in both languages;
- every Bengali description is actually in Bengali script;
- STAFF is marked deprecated.

The EN/BN key parity check (`pnpm lint`) covers the new keys.

## 4. Files

| File | What |
|---|---|
| `scripts/migrate-staff-to-front-desk.ts` | One-shot script (`pnpm users:staff-to-front-desk`) |
| `scripts/migrate-staff-to-front-desk.db.test.ts` | Tests, run with `pnpm test:db` (`*_test` database only): dry run, apply with audit rows, re-run no-op, race skip, default role |
| `prisma/migrations/20261001120000_user_role_default_front_desk/` | `ALTER COLUMN "role" SET DEFAULT 'FRONT_DESK'` |
| `prisma/seed-test-users.ts`, `.test.ts` | Test users and their gate |
| `prisma/seed.ts` | Calls `seedTestUsers()`; loads `.env` |
| `prisma/load-env.ts` | Loads `.env` without `dotenv` (see §6) |
| `src/lib/auth.ts` | Better Auth `defaultRole: "FRONT_DESK"` |
| `src/content/en.ts`, `bn.ts`, `roles.test.ts` | Labels and descriptions |
| `src/components/admin/AdminShell.tsx`, `src/app/admin/welcome/WelcomeView.tsx` | Show the label instead of the enum |

## 5. Evidence

All of this was run on a scratch database (`resort_a2s3_test`, created fresh, all 23 migrations deployed, then dropped).

**Seed with `NODE_ENV` unset:**
```
Created test user test-owner@demo.resort (OWNER)
Created test user test-manager@demo.resort (MANAGER)
Created test user test-front-desk@demo.resort (FRONT_DESK)
Created test user test-housekeeping@demo.resort (HOUSEKEEPING)
Created test user test-kitchen@demo.resort (KITCHEN)
Created test user test-storekeeper@demo.resort (STOREKEEPER)
Created test user test-accountant@demo.resort (ACCOUNTANT)
Created test user test-hr@demo.resort (HR)
Created test user test-auditor@demo.resort (AUDITOR)
Test users are ready. Password: see docs/rms/phase-a2/03-TEST-USERS.md.
```

**Re-seed** after setting `test-hr` to MANAGER by hand. All nine were kept ("Kept test user …"), there were still 9 users, and `test-hr@demo.resort|HR` showed the role reset. Each user has 1 credential account (9 `Account` rows).

**Gate:**
```
## NODE_ENV=production
Skipping test users (NODE_ENV=production; set SEED_TEST_USERS=true to create them).
## NODE_ENV=production SEED_TEST_USERS=true
9            (lines "Kept test user …")
## SEED_TEST_USERS=false (dev)
Skipping test users (SEED_TEST_USERS=false).
## NODE_ENV only in .env (cwd has .env with NODE_ENV=production)
NODE_ENV=production shouldSeedTestUsers=false
```

**Sign-in** on a production build (`next start -p 3100`) against the scratch database, following `/admin`'s redirect:
```
EMAIL                          SIGNIN LANDS_ON           ROLE BADGE
test-owner@demo.resort         200    /admin             Owner
test-manager@demo.resort       200    /admin             Manager
test-front-desk@demo.resort    200    /admin/bookings    Front Desk
test-housekeeping@demo.resort  200    /admin/rooms       Housekeeping
test-kitchen@demo.resort       200    /admin/welcome     Kitchen
test-storekeeper@demo.resort   200    /admin/welcome     Storekeeper
test-accountant@demo.resort    200    /admin             Accountant
test-hr@demo.resort            200    /admin/welcome     HR
test-auditor@demo.resort       200    /admin             Auditor
```
The landing pages match 01-ROLES-AND-PERMISSIONS.md §6.

**At 360px** (signed in as test-housekeeping), the drawer badge reads "Housekeeping" (101px wide) in English and "হাউসকিপিং" (69px) in Bengali. The page `scrollWidth` is 345, so there is no horizontal overflow.

**STAFF script,** with two STAFF users inserted into the scratch database:
```
## dry run
Database: localhost:5432/resort_a2s3_test
would change  STAFF -> FRONT_DESK  karim@legacy.test  (Karim (legacy), legacy-2)
would change  STAFF -> FRONT_DESK  rahim@legacy.test  (Rahim (legacy), legacy-1)
2 user(s) would change. Dry run: nothing written. Re-run with --apply.
## --apply
changed  STAFF -> FRONT_DESK  karim@legacy.test  (Karim (legacy), legacy-2)
changed  STAFF -> FRONT_DESK  rahim@legacy.test  (Rahim (legacy), legacy-1)
2 user(s) changed; one USER_ROLE_CHANGED audit row each.
## again
No STAFF users. Nothing to do.
## audit rows (entityId|module|action|system|diff|metadata)
legacy-2|USERS|USER_ROLE_CHANGED|t|{"after": {"role": "FRONT_DESK"}, "before": {"role": "STAFF"}}|{"actor":"system:migrate-staff-to-front-desk","email":"karim@legacy.test","reason":"Phase A2 §3.1: STAFF is deprecated and maps to FRONT_DESK (identical permissions)."}
legacy-1|USERS|USER_ROLE_CHANGED|t|{"after": {"role": "FRONT_DESK"}, "before": {"role": "STAFF"}}|{"actor":"system:migrate-staff-to-front-desk","email":"rahim@legacy.test","reason":"Phase A2 §3.1: STAFF is deprecated and maps to FRONT_DESK (identical permissions)."}
```

**Dry run on `resort_dev`** (not applied; that is the owner's call):
```
Database: localhost:5432/resort_dev
would change  STAFF -> FRONT_DESK  staff@demo.resort  (Staff Tester, Vq6c27HgCOSxDDaPOUH96iRvsVLicl6j)
1 user(s) would change. Dry run: nothing written. Re-run with --apply.
```

## 6. Found while doing this

`prisma/seed-admin.ts` began with `import "dotenv/config"`, but `dotenv` is not a dependency of this project. On a clean `pnpm install`, the documented first-deploy step `pnpm exec tsx prisma/seed-admin.ts` therefore failed with `ERR_MODULE_NOT_FOUND`. This was reproduced here with `tsx`. It now imports `./load-env`, which uses Node's built-in `process.loadEnvFile()`. No dependency was added.

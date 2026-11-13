# Production Deployment & Infrastructure Guide

> **Primary target (CQ-M12, owner decision): BDIX VPS + Docker standalone** (Method B below).
> PM2 on the same VPS (Method A) is a supported alternative. Vercel is
> **demo/preview only** — see [VERCEL-DEMOS.md](VERCEL-DEMOS.md); only
> night-audit is scheduled there, so production cron coverage lives on the VPS.

This guide details step-by-step instructions for deploying the scaffolded travel platform to a **BDIX-connected VPS** in Bangladesh (or any cloud VPS) using **Nginx**, **PM2** (or **Docker**), and **Let's Encrypt SSL**.

---

## Architecture Overview

- **BDIX Optimization**: BDIX (Bangladesh Internet Exchange) VPS provides local <10ms response times across domestic ISPs (Grameenphone, Robi, Banglalink, Teletalk, AmberIT, Dotlines, etc.).
- **Cloudflare DNS**: Cloudflare DNS must remain in **DNS-Only Mode (Gray Cloud)**. Do NOT enable Cloudflare Proxy (Orange Cloud) as it routes traffic through Singapore or regional edge nodes, bypassing BDIX intra-country routing and increasing latency.
- **Reverse Proxy**: Nginx handles SSL termination, gzip/brotli compression, static caching, and HTTP to HTTPS redirection.
- **Node Runtime**: Node.js v20 LTS managed via PM2 process manager or Docker standalone container.

---

## Method A: Standard BDIX VPS Deployment (PM2 + Nginx)

### 1. Server Prerequisites & Environment Setup

Connect to your Ubuntu 22.04 / 24.04 LTS BDIX VPS via SSH:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git nginx certbot python3-certbot-nginx build-essential
```

Install Node.js 20 LTS & pnpm:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo corepack enable
sudo corepack prepare pnpm@12.4.2 --activate
sudo npm install -g pm2
```

Install PostgreSQL 16 from the official PostgreSQL apt repository (Ubuntu 22.04 ships 14; 16 matches local development):

```bash
sudo apt install -y postgresql-common
sudo /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y
sudo apt install -y postgresql-16
```

Create the application role and database. Use a long random password, and keep PostgreSQL listening on `localhost` only (the default) — the app runs on the same VPS:

```bash
sudo -u postgres psql -c "CREATE ROLE resort LOGIN PASSWORD 'REPLACE_WITH_LONG_RANDOM_PASSWORD';"
sudo -u postgres psql -c "CREATE DATABASE resort_prod OWNER resort;"
```

The connection string for the next step is then:
`postgresql://resort:REPLACE_WITH_LONG_RANDOM_PASSWORD@localhost:5432/resort_prod?schema=public`

### 2. Application Deployment

Clone the application repository and configure environment variables:

```bash
cd /var/www
sudo git clone https://github.com/your-org/resort-travel-scaffold.git resort-app
sudo chown -R $USER:$USER /var/www/resort-app
cd /var/www/resort-app

# Configure environment variables.
# The file must be named `.env`: Next.js reads it, and so does the Prisma CLI
# (prisma.config.ts loads `.env` only — a `.env.production` alone leaves
# `prisma migrate deploy` without DATABASE_URL and `pnpm db:deploy` fails).
cat << "EOT" > .env
DATABASE_URL="postgresql://resort:REPLACE_WITH_LONG_RANDOM_PASSWORD@localhost:5432/resort_prod?schema=public"
DIRECT_URL="postgresql://resort:REPLACE_WITH_LONG_RANDOM_PASSWORD@localhost:5432/resort_prod?schema=public"
NODE_ENV="production"
PORT=3000
RESEND_API_KEY="re_your_live_key"          # see docs/EMAIL.md
RESEND_FROM_EMAIL="bookings@yourdomain.com" # on a domain verified in Resend
BKASH_APP_KEY="your_bkash_app_key"         # full gateway blocks: .env.example
NAGAD_MERCHANT_ID="your_nagad_merchant_id"
EOT
# For the complete variable list, start from docs/release/.env.production.template instead.

# Install dependencies, apply migrations, build
pnpm install --frozen-lockfile
pnpm db:deploy       # prisma migrate deploy
pnpm db:seed         # FIRST DEPLOY ONLY, on an empty database — see warning below
pnpm build           # prisma generate && next build (migrations were applied by db:deploy above)
```

Before the first deploy (and after changing which payment methods are enabled in brand
config), check every secret the enabled modules need is actually set:

```bash
set -a && source .env && set +a && pnpm check:env
```

It only checks a gateway (bKash/Nagad/SSLCommerz/BanglaQR/Stripe) when that gateway is
turned on — `brand.config.ts` for the local gateways, the server-side gateway
settings for Stripe — plus the core secrets every deployment needs
(`DATABASE_URL`, `BETTER_AUTH_SECRET`, `CRON_SECRET`, Resend). It does not
replace the per-gateway docs (`docs/PAYMENTS-*.md`) — it only confirms the
variables they require are present.

### Database Migrations & Seeding Workflow in Production

Migrations in `prisma/migrations/` are the only source of truth for the schema; the schema is never synced to the database any other way.

1. **Every deploy** applies pending migrations before the new code starts serving:
   ```bash
   git pull
   pnpm install --frozen-lockfile
   pnpm db:deploy                  # applies pending migrations; no-op if none
   pnpm build                      # pure build; migrations were applied by db:deploy above
   pm2 reload resort-app
   ```
   `migrate deploy` never resets or drops data. If it fails, the old code is still running — fix the cause and re-run; do not reload PM2 until it succeeds.
2. **Seeding** — `pnpm db:seed` **deletes existing guests, bookings, payments and daily notes** before inserting demo data (rooms, units and destinations are upserted and reused). Run it only once, on a brand-new empty database. Never run it on a live resort. (On a development machine, `pnpm db:reset` is the repeatable clean reseed: drop + migrate + seed.)
3. **Admin account** — create the first OWNER with `pnpm exec tsx prisma/seed-admin.ts` (set `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_NAME` first). Self-signup is disabled; every other user is invited from **Settings → Users** (Phase A2 §4). Invitations and password resets are emailed through Resend, so set `RESEND_API_KEY` and `RESEND_FROM_EMAIL` (a bare address on a domain verified in Resend). In production, a missing key makes the invitation fail and roll back instead of pretending to send. The OWNER must enable two-factor authentication at `/admin/setup-2fa` before settings unlock.
4. **Phase A2 upgrade (existing sites only)**: after the deploy, move users off the deprecated STAFF role. Run `pnpm users:staff-to-front-desk` (a dry run that lists them), then `pnpm users:staff-to-front-desk --apply`. Access does not change (STAFF and FRONT_DESK have the same permissions), and each change is written to the audit log. Re-running it is harmless. `pnpm db:seed` never creates the per-role test users on a server whose `.env` has `NODE_ENV="production"`, unless `SEED_TEST_USERS=true` is set (docs/rms/phase-a2/03-TEST-USERS.md).
5. **Schema changes** are made on a development machine (`pnpm db:migrate --name <change>`), committed, and reach production only through `pnpm db:deploy`.

> **What the seed inserts matters as much as what it deletes.** The
> default seeders add demo bookings (a year of fabricated history),
> demo operations data, mock Google reviews, demo promo codes and
> sample blog content. For any client deployment, run the production
> seed profile only — destinations, rooms, units, settings, first
> owner — and verify afterwards that no demo records exist. See
> GO-LIVE-CHECKLIST → "Content provenance & demo-data gate".

### Migrating an Existing SQLite Deployment to PostgreSQL (one time)

Deployments created before Phase A1 store data in a SQLite file (`prisma/prod.db`). This release reads PostgreSQL only, so that data is copied across once. Plan 15–30 minutes of downtime.

The copy script reads SQLite with Node's built-in `node:sqlite` module, which needs **Node.js 22.5 or newer**. If the VPS still runs Node 20, run step 6 with a newer Node (for example via `nvm`), or from a workstation that can reach the database.

1. **Stop the app** so no new bookings are written: `pm2 stop resort-app`.
2. **Back up the SQLite file** and keep it until the new setup has run cleanly for a few weeks:
   ```bash
   mkdir -p ~/backups && sqlite3 prisma/prod.db ".backup '$HOME/backups/prod-$(date -u +%Y%m%dT%H%M%SZ).db'"
   ```
3. **Provision PostgreSQL** (section 1 above) and put the PostgreSQL `DATABASE_URL` in `.env`.
4. **Check out this release**: `git pull && pnpm install --frozen-lockfile`.
5. **Create the empty schema**: `pnpm db:deploy`.
6. **Copy the data** — do **not** run `pnpm db:seed`:
   ```bash
   pnpm exec tsx scripts/migrate-sqlite-to-postgres.ts --sqlite prisma/prod.db
   ```
   The script refuses to write into a non-empty database, stops before writing anything if a value doesn't fit the new schema (for example a `User.role` other than OWNER/MANAGER/STAFF), copies everything in one transaction, and prints row counts for both databases. It must end with `✓ All rows copied; counts match.` If it doesn't, stop — nothing needs undoing on the SQLite side, which is only ever opened read-only.
7. **Build and start**: `pnpm build && pm2 restart resort-app`.
8. **Smoke test**: sign in at `/admin/login`, open a recent booking, check its payments and totals.

**Rollback** (before any new bookings land in PostgreSQL): `pm2 stop resort-app`, check out the previous release, set `DATABASE_URL` back to the SQLite file, `pnpm build`, `pm2 restart resort-app`. The SQLite file is unchanged by the copy. After new bookings have been taken in PostgreSQL, rolling back would lose them — fix forward instead.


### 3. PM2 Process Manager Configuration

Create a PM2 configuration file `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: "resort-app",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      instances: "max",
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
```

Start the application with PM2 and setup startup hooks:

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

**Cluster mode and saved settings.** All workers share revalidations through `cache-handler.cjs` (set in `next.config.ts`). When an OWNER saves Settings › General, every worker serves the new contact details and policies on its next request. This needs:
- **One writable folder:** all workers must run from the same app directory, and the app user must be able to write `.next/cache/shared-tags/`.
- **One host:** several VPSs behind a load balancer would need a shared cache handler instead.

See `docs/rms/phase-a2/10-RUNTIME-SETTINGS.md`.

---

## Method B: Docker Container Deployment

If deploying via Docker on your VPS:

```bash
# Apply pending migrations FIRST. `pnpm build` no longer migrates — the
# deploy pipeline owns that — so run this from any checkout that can reach
# the VPS database (the VPS itself, CI, or a workstation), with the same
# DATABASE_URL the build uses below:
DATABASE_URL="postgresql://resort:REPLACE_WITH_LONG_RANDOM_PASSWORD@localhost:5432/resort_prod?schema=public" pnpm db:deploy

# Build Docker image. `next build` still prerenders pages that read the
# database, so the build needs to reach PostgreSQL.
# --network=host lets the build reach a database on the VPS's localhost (Linux).
docker build --network=host \
  --build-arg DATABASE_URL="postgresql://resort:REPLACE_WITH_LONG_RANDOM_PASSWORD@localhost:5432/resort_prod?schema=public" \
  --build-arg R2_PUBLIC_DOMAIN="https://cdn.yourdomain.com" \
  -t resort-app:latest .

# Run Docker container
docker run -d \
  --name resort-app \
  --restart always \
  -p 3000:3000 \
  --network=host \
  -e DATABASE_URL="postgresql://resort:REPLACE_WITH_LONG_RANDOM_PASSWORD@localhost:5432/resort_prod?schema=public" \
  -e R2_PUBLIC_DOMAIN="https://cdn.yourdomain.com" \
  -e NODE_ENV="production" \
  resort-app:latest
```

### Scheduler on Docker hosts (required — Handover I-6)

A container has no cron daemon and no platform scheduler: skip this step and every job stays at "Never ran", the business day never closes, and holds, reminders and postings pile up. Pick one option; either way the §7.2e crontab stays the single list of jobs and schedules.

**Option 1 — host crontab (simplest).** On the Docker host, `crontab -e` and paste the §7.2e lines, pointed at the property's public URL, with `CRON_SECRET` read from the same env file the container uses:

```cron
0 * * * * curl -fsS -X POST -H "Authorization: Bearer $(grep ^CRON_SECRET= /var/www/resort-app/.env | cut -d= -f2-)" https://yourresort.com/api/cron/night-audit >> /var/log/resort-cron.log 2>&1
# ... plus one line per §7.2e job (pending-expiry, ledger-posting,
# guest-reminders, blog-attempts-cleanup, the gateway reconciles this
# property uses, fetch-google-reviews, PMS sync) and the §7.1 backup lines.
```

**Option 2 — scheduler sidecar.** Add a second compose service that runs a cron daemon (or `supercronic`) with the shared env file and curls the app service on the §7.2e schedules. Keep the schedules identical to §7.2e; do not keep a second schedule list.

Finish with the System Health check in §6 before calling the deploy done. Wiring the crontab on an existing host (demo13 included) is a founder ops step, not part of the app deploy.

---

## 4. Nginx Reverse Proxy Setup

Create an Nginx server block configuration for your domain:

```bash
sudo tee /etc/nginx/sites-available/resort > /dev/null << "EOF"
server {
    listen 80;
    server_name yourresort.com www.yourresort.com;

    # Gzip Compression
    gzip on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;

    # Security headers (01 M3) — same set Next.js serves (next.config.ts),
    # so VPS responses carry them even where Next is bypassed. `always`
    # includes error responses. HSTS is set only on the HTTPS blocks in
    # §5.1 (browsers ignore it over HTTP).
    add_header X-Frame-Options "DENY" always;
    add_header Content-Security-Policy "frame-ancestors 'none'" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # BanglaQR receipt uploads: up to 5 MB image plus form overhead. Nginx's
    # 1 MB default would reject most receipts before they reach the app.
    location = /api/payments/banglaqr/submit-receipt {
        client_max_body_size 6m;
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static Assets Caching
    location /_next/static/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_cache_valid 200 365d;
        access_log off;
    }

    location /public/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_cache_valid 200 30d;
        access_log off;
    }
}
EOF
```

Enable site configuration and restart Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/resort /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

**Keep `proxy_set_header X-Real-IP $remote_addr;`.** The sign-in rate limits (10 attempts per 15 minutes per address, go-live §3) and the IP addresses in the audit log read the client address from `X-Real-IP`. Without it every visitor shares one address, so one person's mistyped passwords could lock everyone out for 15 minutes. Cloudflare stays DNS-only (grey cloud), so nginx's `$remote_addr` is the real client.

## 5. Let's Encrypt SSL Certificate Provisioning

Provision HTTPS certificate using Certbot:

```bash
sudo certbot --nginx -d yourresort.com -d www.yourresort.com
```

Follow the prompts to enable automatic HTTP-to-HTTPS redirect.

Verify automatic renewal:

```bash
sudo certbot renew --dry-run
```

### 5.1 Canonical host: single-hop 301 redirects (SEO)

The site's canonical origin is `https://yourresort.com`: HTTPS, no `www`. It must match
`brand.config.ts → domain`. Every other variant must reach it in **one** permanent (301)
redirect. Certbot's default rewrite sends `http://www` → `https://www` → `https://apex`,
a two-hop chain, so after the certificate is issued, replace its redirect blocks with:

```nginx
# Any host over HTTP → HTTPS apex in one hop
server {
    listen 80;
    server_name yourresort.com www.yourresort.com;
    return 301 https://yourresort.com$request_uri;
}

# HTTPS www → HTTPS apex
server {
    listen 443 ssl http2;
    server_name www.yourresort.com;
    ssl_certificate     /etc/letsencrypt/live/yourresort.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourresort.com/privkey.pem;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "DENY" always;
    add_header Content-Security-Policy "frame-ancestors 'none'" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
    return 301 https://yourresort.com$request_uri;
}

# HTTPS apex → the app (move the location blocks from section 4 here)
server {
    listen 443 ssl http2;
    server_name yourresort.com;
    ssl_certificate     /etc/letsencrypt/live/yourresort.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourresort.com/privkey.pem;
    # ...gzip + location blocks from section 4...
    # Security headers (01 M3): full set including HSTS (HTTPS-only site).
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "DENY" always;
    add_header Content-Security-Policy "frame-ancestors 'none'" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
}
```

Verify that each variant returns exactly one `301` to the apex:

```bash
for u in http://yourresort.com/faq http://www.yourresort.com/faq https://www.yourresort.com/faq; do
  curl -s -o /dev/null -w "$u -> %{http_code} %{redirect_url}\n" "$u"
done
# Each line: 301 https://yourresort.com/faq
```

Trailing slashes are handled by Next.js (`/faq/` → 308 `/faq`). Cloudflare stays in
**DNS-only** mode (gray cloud), so these redirects must live in nginx and not in Cloudflare
page rules.

---

## 6. Verification & Health Checks

1. **Check Application Status**:
   - PM2 status: `pm2 status`
   - Application logs: `pm2 logs resort-app`
2. **Verify BDIX Ping Latency**:
   - Ping domain from a Bangladeshi IP / connection: `ping yourresort.com` (Target <15ms).
3. **Verify SSL**:
   - Visit `https://yourresort.com` in browser and confirm padlock icon.
4. **Verify scheduled jobs** (Handover I-6):
   - Open Admin › System Health (`/admin/system`) as OWNER: every job the property needs must show a recent success — none may sit at "Never ran" past its first scheduled time (hourly jobs: within the hour; daily jobs: the morning after).
   - A job that never reports has a missing or failing schedule line — check `/var/log/resort-cron.log` (and the backup log) on the scheduler host.

---

## 7. Backups

`scripts/backup-postgres.sh` writes a compressed `pg_dump` custom-format file to `/var/backups/resort/db-<UTC timestamp>.dump` and deletes dumps older than 30 days. It writes to a temporary name first, so a failed run never leaves a file that looks like a backup, and it creates dumps readable by their owner only — they contain guest names, phone numbers and NID/passport numbers.

`pg_dump` comes with the `postgresql-16` package installed in section 1; its major version must match the server's.

### 7.1 Nightly cron

Create the backup directory for the user that runs the app, then add the job with `crontab -e` as that user:

```bash
sudo mkdir -p /var/backups/resort && sudo chown $USER:$USER /var/backups/resort
```

```cron
# 02:00 server time, every day. ENV_FILE supplies DATABASE_URL.
0 2 * * * cd /var/www/resort-app && ENV_FILE=/var/www/resort-app/.env scripts/backup-postgres.sh >> /var/log/resort-backup.log 2>&1
```

Check it the morning after: `tail /var/log/resort-backup.log` should end with `✓ Backup written: ...`, and `ls -lh /var/backups/resort` should show a new file.

### 7.2 Off-site copy (Cloudflare R2)

A backup on the same disk as the database does not survive losing the VPS. Copy each night's dump to R2 with `rclone`:

1. Create a private R2 bucket (e.g. `resort-backups`) and an R2 API token scoped to that bucket only. Add a lifecycle rule deleting objects after 90 days.
2. `sudo apt install -y rclone`, then `rclone config` → new remote `r2`, type `s3`, provider `Cloudflare`, with the token's access key, secret and the account's R2 endpoint.
3. Add a second cron line 30 minutes after the backup:
   ```cron
   30 2 * * * rclone copy /var/backups/resort r2:resort-backups/db --max-age 25h >> /var/log/resort-backup.log 2>&1
   ```
4. Confirm with `rclone ls r2:resort-backups/db`.

### 7.2a BanglaQR scheduled jobs

If BanglaQR is enabled, add these to the same crontab. The secret goes in the `Authorization` header; the BanglaQR endpoints refuse `?secret=` in the URL, where it would be written to access logs. See `docs/PAYMENTS-BANGLAQR.md` §3.

```cron
# Release unpaid BanglaQR bookings after the payment window; escalate overdue verifications.
*/5 * * * * curl -fsS -X POST -H "Authorization: Bearer $(grep ^CRON_SECRET= /var/www/resort-app/.env | cut -d= -f2-)" https://yourresort.com/api/cron/banglaqr-release >> /var/log/resort-cron.log 2>&1
# Delete receipt images 90 days after check-out (docs/DATA-RETENTION.md).
30 3 * * * curl -fsS -X POST -H "Authorization: Bearer $(grep ^CRON_SECRET= /var/www/resort-app/.env | cut -d= -f2-)" https://yourresort.com/api/cron/banglaqr-retention >> /var/log/resort-cron.log 2>&1
```

### 7.2b bKash reconciliation job

If bKash is enabled, add this line too. Every 5 minutes it settles bKash payments whose outcome the redirect flow didn't capture: execute timeouts, and sessions the guest never finished. It also settles refunds whose response was lost. The secret goes in the header only. See `docs/PAYMENTS-BKASH.md` §4.3.

```cron
# Settle bKash payments and refunds whose outcome is unknown (Query Payment / refund status).
*/5 * * * * curl -fsS -X POST -H "Authorization: Bearer $(grep ^CRON_SECRET= /var/www/resort-app/.env | cut -d= -f2-)" https://yourresort.com/api/cron/bkash-reconcile >> /var/log/resort-cron.log 2>&1
```

bKash also needs these in `.env`: `BKASH_TOKEN_SECRET` (at least 32 characters), `BKASH_CALLBACK_URL` (required in production), and, for webhooks, `BKASH_WEBHOOK_TOPIC_ARN`. `BKASH_WEBHOOK_SECRET` is no longer used.

### 7.2c Nagad reconciliation job

If Nagad is enabled, add this line too. Nagad takes the guest's money on its own page, so a guest who pays and closes the browser leaves an attempt only this job can confirm. Every 5 minutes it asks Nagad's Verify API about:

- open attempts older than 10 minutes;
- replaced windows (the guest can still pay one);
- payments whose verify timed out.

It closes attempts still unpaid after 2 hours. The secret goes in the header only. See `docs/PAYMENTS-NAGAD.md` §4.3.

```cron
# Settle Nagad payments whose callback never arrived or whose verify timed out.
*/5 * * * * curl -fsS -X POST -H "Authorization: Bearer $(grep ^CRON_SECRET= /var/www/resort-app/.env | cut -d= -f2-)" https://yourresort.com/api/cron/nagad-reconcile >> /var/log/resort-cron.log 2>&1
```

If the job hasn't succeeded for 2 hours, the next admin visit to the payment settings page or a Nagad booking raises a stale-cron alert to the Nagad alert email.

**Night audit fallback (RMS Phase B).** A manager normally closes the business day from Front Desk › Night audit. If nobody has closed it by 04:00 property time, this job closes it. It posts room charges and records unresolved arrivals, and never marks no-shows. Run it hourly; it is safe to run twice. See `docs/rms/phase-b/03-NIGHT-AUDIT.md`.

```cron
0 * * * * curl -fsS -X POST -H "Authorization: Bearer $(grep ^CRON_SECRET= /var/www/resort-app/.env | cut -d= -f2-)" https://yourresort.com/api/cron/night-audit >> /var/log/resort-cron.log 2>&1
```

**Ledger posting (RMS Phase F).** Posts to the books whatever the desk, the store, expenses and the cash drawers recorded since the last run. It does nothing while the `accounting` module is off or before the books start date is set. Run it hourly, after the night audit; it is safe to run twice. A run where some source failed answers 500 and logs which. See `docs/rms/phase-f/02-AUTO-POSTING.md`.

```cron
15 * * * * curl -fsS -X POST -H "Authorization: Bearer $(grep ^CRON_SECRET= /var/www/resort-app/.env | cut -d= -f2-)" https://yourresort.com/api/cron/ledger-posting >> /var/log/resort-cron.log 2>&1
```

Nagad also needs these in `.env`:

- `NAGAD_MERCHANT_ID`.
- `NAGAD_MERCHANT_PRIVATE_KEY` and `NAGAD_PG_PUBLIC_KEY`: RSA ≥ 2048; single-line values with `\n` escapes are fine.
- `NAGAD_TOKEN_SECRET`: at least 32 characters, e.g. `openssl rand -hex 32`.
- `NAGAD_CALLBACK_URL`: https, whitelisted with Nagad.
- `NAGAD_SERVER_IPV4`: this server's public IPv4, whitelisted with Nagad.

Leave `NAGAD_IS_SANDBOX` unset in production; unset now means production. Set `TZ=Asia/Dhaka` in the PM2 environment (`env: { TZ: "Asia/Dhaka" }` in `ecosystem.config.js`). Nagad timestamps are computed for Asia/Dhaka regardless, but logs and cron times then read in local time. Key rotation is a restart with the new values; see `docs/PAYMENTS-NAGAD.md` §8.

### 7.2d SSLCommerz reconciliation job

If SSLCommerz is enabled, add this line too. SSLCommerz takes the guest's money on its own hosted page and tells us through the guest's browser and its IPN; if both are lost, only this job confirms the booking. Every 5 minutes it asks SSLCommerz, by session key, about:

- open sessions older than 10 minutes;
- replaced sessions (the guest can still pay one);
- payments whose validation timed out.

It closes sessions still unpaid after 2 hours, and follows pending refunds (hourly) until SSLCommerz reports them refunded. The secret goes in the header only. See `docs/PAYMENTS-SSLCOMMERZ.md` §4.4.

```cron
# Settle SSLCommerz payments whose redirect and IPN never arrived, and follow pending refunds.
*/5 * * * * curl -fsS -X POST -H "Authorization: Bearer $(grep ^CRON_SECRET= /var/www/resort-app/.env | cut -d= -f2-)" https://yourresort.com/api/cron/sslcommerz-reconcile >> /var/log/resort-cron.log 2>&1
```

If the job hasn't succeeded for 2 hours, the next admin visit to the payment settings page or an SSLCommerz booking raises a stale-cron alert to the SSLCommerz alert email.

SSLCommerz also needs these in `.env`:

- `SSL_STORE_ID` and `SSL_STORE_PASSWORD` from the SSLCommerz merchant panel (the public demo store `testbox` is refused in production).
- `SSLCOMMERZ_TOKEN_SECRET`: at least 32 characters, e.g. `openssl rand -hex 32`.
- `SSL_CALLBACK_SUCCESS`, `SSL_CALLBACK_FAIL`, `SSL_CALLBACK_CANCEL`, `SSL_CALLBACK_IPN`: https, exact paths (or set `NEXT_PUBLIC_APP_URL` and they are derived). The IPN URL must be reachable from SSLCommerz over the internet; if your store has an IPN URL in the SSLCommerz panel, set it to the same value.

Leave `SSL_BASE_URL` and `SSL_IS_SANDBOX` unset in production (unset now means `https://securepay.sslcommerz.com`); the sandbox host is refused in production unless `SSL_ALLOW_SANDBOX=true` (staging only). After the first deploy of the hardened SSLCommerz code, follow the legacy-row check in `docs/PAYMENTS-SSLCOMMERZ.md` §9.

### 7.2e Every scheduled job: the complete crontab

All of the jobs above, plus five that weren't listed before (pending-expiry, stripe-reconcile, blog clean-up, Google reviews, PMS sync), in one place. Paste the lines for what this property uses into `crontab -e` for the user that runs the app. Every job is safe to run twice. The payment and RMS jobs need the secret in the `Authorization` header; none of them accept it in the URL in production.

```cron
# Replace yourresort.com with this property's domain.
# Database backup and off-site copy (§7.1, §7.2). Always.
0 2 * * * cd /var/www/resort-app && ENV_FILE=/var/www/resort-app/.env scripts/backup-postgres.sh >> /var/log/resort-backup.log 2>&1
30 2 * * * rclone copy /var/backups/resort r2:resort-backups/db --max-age 25h >> /var/log/resort-backup.log 2>&1
# RMS: night audit fallback (front desk module) and posting to the books (accounting module).
0 * * * * curl -fsS -X POST -H "Authorization: Bearer $(grep ^CRON_SECRET= /var/www/resort-app/.env | cut -d= -f2-)" https://yourresort.com/api/cron/night-audit >> /var/log/resort-cron.log 2>&1
15 * * * * curl -fsS -X POST -H "Authorization: Bearer $(grep ^CRON_SECRET= /var/www/resort-app/.env | cut -d= -f2-)" https://yourresort.com/api/cron/ledger-posting >> /var/log/resort-cron.log 2>&1
# Bookings: expire stale PENDING holds (always).
0 * * * * curl -fsS -X POST -H "Authorization: Bearer $(grep ^CRON_SECRET= /var/www/resort-app/.env | cut -d= -f2-)" https://yourresort.com/api/cron/pending-expiry >> /var/log/resort-cron.log 2>&1
# Payments: only the gateways this property has turned on (§7.2a–d).
*/5 * * * * curl -fsS -X POST -H "Authorization: Bearer $(grep ^CRON_SECRET= /var/www/resort-app/.env | cut -d= -f2-)" https://yourresort.com/api/cron/bkash-reconcile >> /var/log/resort-cron.log 2>&1
*/5 * * * * curl -fsS -X POST -H "Authorization: Bearer $(grep ^CRON_SECRET= /var/www/resort-app/.env | cut -d= -f2-)" https://yourresort.com/api/cron/nagad-reconcile >> /var/log/resort-cron.log 2>&1
*/5 * * * * curl -fsS -X POST -H "Authorization: Bearer $(grep ^CRON_SECRET= /var/www/resort-app/.env | cut -d= -f2-)" https://yourresort.com/api/cron/sslcommerz-reconcile >> /var/log/resort-cron.log 2>&1
*/5 * * * * curl -fsS -X POST -H "Authorization: Bearer $(grep ^CRON_SECRET= /var/www/resort-app/.env | cut -d= -f2-)" https://yourresort.com/api/cron/banglaqr-release >> /var/log/resort-cron.log 2>&1
*/15 * * * * curl -fsS -X POST -H "Authorization: Bearer $(grep ^CRON_SECRET= /var/www/resort-app/.env | cut -d= -f2-)" https://yourresort.com/api/cron/stripe-reconcile >> /var/log/resort-cron.log 2>&1
30 3 * * * curl -fsS -X POST -H "Authorization: Bearer $(grep ^CRON_SECRET= /var/www/resort-app/.env | cut -d= -f2-)" https://yourresort.com/api/cron/banglaqr-retention >> /var/log/resort-cron.log 2>&1
# Website: blog submission-attempt clean-up (always), Google reviews (when a Maps key and place id are set), PMS sync (when a PMS is configured).
45 3 * * * curl -fsS -H "Authorization: Bearer $(grep ^CRON_SECRET= /var/www/resort-app/.env | cut -d= -f2-)" https://yourresort.com/api/cron/blog-attempts-cleanup >> /var/log/resort-cron.log 2>&1
0 5 * * * curl -fsS -H "Authorization: Bearer $(grep ^CRON_SECRET= /var/www/resort-app/.env | cut -d= -f2-)" https://yourresort.com/api/cron/fetch-google-reviews >> /var/log/resort-cron.log 2>&1
*/15 * * * * curl -fsS -X POST -H "Authorization: Bearer $(grep ^CRON_SECRET= /var/www/resort-app/.env | cut -d= -f2-)" https://yourresort.com/api/cron/pms-sync >> /var/log/resort-cron.log 2>&1
```

**Check it:** Admin › System health (`/admin/system`, OWNER and AUDITOR) lists every job with its last success. Each job, and the backup script, records a heartbeat when it runs. A job the property needs that has never reported, or hasn't succeeded within its window, is shown as a problem. `src/lib/system/jobs.ts` holds this list; a unit test fails if a new `/api/cron/*` route is added without it.

### 7.3 Restoring

Restore into a **new** database, check it, then switch the app over. The damaged database stays untouched until you are sure.

```bash
pm2 stop resort-app

sudo -u postgres psql -c "CREATE DATABASE resort_restore OWNER resort;"
pg_restore --no-owner --exit-on-error \
  --dbname="postgresql://resort:PASSWORD@localhost:5432/resort_restore" \
  /var/backups/resort/db-YYYYMMDDTHHMMSSZ.dump

# Point .env's DATABASE_URL at resort_restore, then:
pnpm exec prisma migrate status                  # must report "Database schema is up to date"
pnpm exec tsx scripts/backfill-poisha.ts --check # money columns consistent
pm2 restart resort-app
```

Anything written after the dump was taken is not in it. With nightly backups, up to a day of bookings can be lost; those can be re-entered from gateway statements and the front-desk register.

To restore from R2, first `rclone copy r2:resort-backups/db/db-YYYYMMDDTHHMMSSZ.dump /var/backups/resort/`.

### 7.4 Quarterly restore test

A backup that has never been restored is not known to work. Once a quarter, restore the latest dump into a scratch database (`resort_restore_test`), compare row counts of `Booking`, `Payment`, `Guest` and `User` with production, run `prisma migrate status` against it, then drop it. Record the date and result.

---

## Payment Gateways & bKash Security Note

> **Security Requirement**: bKash credentials (`BKASH_APP_KEY`, `BKASH_APP_SECRET`, `BKASH_USERNAME`, `BKASH_PASSWORD`, `BKASH_WEBHOOK_SECRET`) must strictly be set as environment variables on the VPS (in `.env.production`). Never commit these credentials to the Git repository or expose them to client-side JS bundles. Rotate credentials annually or immediately if a staff member with access leaves.

> **Nagad keys**: `NAGAD_MERCHANT_PRIVATE_KEY` signs every Nagad request. Anyone holding it can impersonate the merchant to Nagad.
> - Set it only as an environment variable on the VPS, never in a file in the repository, and never with a `NEXT_PUBLIC_` prefix.
> - Restrict `.env` to the app user (`chmod 600`).
> - Rotate it (§7.2c) if a staff member with server access leaves.

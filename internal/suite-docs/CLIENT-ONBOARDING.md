# Client Onboarding Operational Manual (Under 60 Minutes Spin-Up)

This operational manual outlines the exact step-by-step workflow for agency engineers to fork this scaffold and launch a fully functional, branded resort website for a new client in under 60 minutes.

---

## Prerequisites (Checklist Before Starting)

Gather the following details from the client before beginning deployment:
- [ ] Domain name access (Cloudflare / Namecheap / GoDaddy)
- [ ] BDIX VPS Server SSH Access (Ubuntu 22.04/24.04)
- [ ] Payment Gateway Merchant Credentials:
  - bKash Merchant Username, Password, App Key, App Secret
  - Nagad Merchant ID & Public/Private Keys
  - SSLCommerz Store ID & Store Password
- [ ] Resend API Key for transactional emails
- [ ] Client Assets:
  - High-res SVG/PNG Logo (Light & Dark variants)
  - Primary & Accent Brand Hex Color Codes
  - Property Photography (Hero, Rooms, Dining, Grounds)
- [ ] Analytics IDs:
  - Google Analytics 4 Measurement ID (`G-XXXXXXXXXX`)
  - Meta Pixel ID (`XXXXXXXXXXXXXXXX`)

---

## Step 1: Repository Fork & Setup

1. Fork the scaffold repository for the new resort client:
   ```bash
   git clone https://github.com/agency/resort-travel-scaffold.git client-resort-app
   cd client-resort-app
   git remote set-url origin https://github.com/agency/client-resort-app.git
   ```
2. Create `main` and `staging` branches.

---

## Step 2: Brand Configuration & Visual Identity

Edit `src/components/brand/brand.config.ts` to replace placeholder branding strings.

### Diff Example:
```diff
 export const defaultBrandConfig: BrandConfig = {
-  name: "Client Resort & Spa",
-  tagline: "Your Serene Escape in Bangladesh",
-  domain: "clientresort.com",
+  name: "Sayeman Beach Resort",
+  tagline: "Premier Oceanfront Luxury on Cox's Bazar Marine Drive",
+  domain: "sayemanresort.com",
   contact: {
-    phone: "+880 1700-000000",
-    email: "reservations@client.com",
+    phone: "+880 1711-888999",
+    email: "reservations@sayemanresort.com",
     address: "Marine Drive, Kalatoli, Cox's Bazar, Bangladesh",
-    whatsapp: "+8801700000000",
+    whatsapp: "+8801711888999",
   },
   colors: {
-    primary: "#0D5C63",
+    primary: "#0F382C",
-    accent: "#F4E4C1",
+    accent: "#E2C380",
   },
 };
```

Update `src/components/brand/Logo.tsx` with the client's official SVG or PNG logo mark.

---

## Step 3: Content Customization (English & Bangla)

1. Update localized strings in `src/content/en.ts` and `src/content/bn.ts` for property specifics.
2. Update legal markdown files in `src/content/legal/`:
   - `privacy.md` — Custom guest data rules
   - `terms.md` — Property rules, check-in/out times
   - `refund-policy.md` — Cancellation deadlines and refund fees
3. Update sample blog articles in `src/content/blog/` for SEO content marketing.

> **Production rule:** `src/content/en.ts` / `bn.ts` and the legal pages
> are for brand and legal copy only. Rooms, prices, offers, promo codes
> and seasonal rates are NEVER content-file data in production — they
> live in the database and are managed by the owner in the admin.
> The demo theme renders most public pages from
> `src/demo/swiss/data.ts`; for a client launch those pages must read
> the database (see GO-LIVE-CHECKLIST → "Content provenance & demo-data
> gate"), or the file must be replaced wholesale with the client's own
> approved content. Leaving the sample resort's data in place — in any
> file — is a failed launch.

---

## Step 4: Photography & Cloudflare R2 Workflow

1. Replace `src/lib/demo-images.ts` with client-provided photography hosted on Cloudflare R2 or CDN. That covers theme photography; room photos come from the Room records the owner manages in the admin — both must be the client's own photography before launch:
   ```ts
   export const demoImages = {
     hero: "https://cdn.clientresort.com/hero.jpg",
     destinations: { ... },
     rooms: { ... },
   };
   ```
2. Add the client's custom CDN hostname to `remotePatterns` in `next.config.ts`:
   ```ts
   images: {
     remotePatterns: [
       { protocol: "https", hostname: "cdn.clientresort.com" },
     ],
   }
   ```

---

## Step 5: Integration Setup & Environment Variables

Create `.env` on the production server (it must be named `.env` — see
docs/DEPLOYMENT.md §2; start from `docs/release/.env.production.template`,
which lists every variable grouped REQUIRED / RECOMMENDED / OPTIONAL):

```env
# Node & App Runtime
NODE_ENV="production"
NEXT_PUBLIC_ENV="production"
PORT=3000

# Database (PostgreSQL — see docs/DEPLOYMENT.md, section 1)
DATABASE_URL="postgresql://resort:REPLACE_WITH_LONG_RANDOM_PASSWORD@localhost:5432/resort_prod?schema=public"
DIRECT_URL="postgresql://resort:REPLACE_WITH_LONG_RANDOM_PASSWORD@localhost:5432/resort_prod?schema=public"

# Transactional Email (Resend)
RESEND_API_KEY="re_123456789_abcdef"
RESEND_FROM_EMAIL="bookings@yourdomain.com"

# Payment Gateways (bKash, Nagad, SSLCommerz — full blocks in .env.example)
BKASH_APP_KEY="bkash_prod_app_key"
BKASH_APP_SECRET="bkash_prod_app_secret"
BKASH_BASE_URL="https://tokenized.pay.bka.sh/v1.2.0-beta"

NAGAD_MERCHANT_ID="68001"
NAGAD_PG_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----..."

SSL_STORE_ID="resort_store"
SSL_STORE_PASSWORD="resort_store_password"
SSL_IS_SANDBOX="false"

# Analytics & Error Tracking
NEXT_PUBLIC_GA_ID="G-XXXXXXXXXX"
NEXT_PUBLIC_META_PIXEL_ID="123456789012345"
NEXT_PUBLIC_SENTRY_DSN="https://xxxxxx@sentry.io/12345"
```

Then verify: `set -a && source .env && set +a && pnpm check:env`.

---

## Step 6: Database Provisioning & Seed Customization

1. Update `prisma/seed.ts` with the resort's actual rooms, suites, and
   baseline rates.
2. Apply database migrations, then run the seed script **once**, on an
   empty database, using the PRODUCTION seed profile: destinations,
   rooms, units, settings, and the first owner only.
   `pnpm db:deploy`, `pnpm db:seed`.
3. The demo seeders must NOT run for a client: demo bookings,
   demo operations data, mock Google reviews, demo promo codes
   (ROMANCE10 / WELLNESS15 / FAMILY20), sample blog posts presented as
   the client's own, and test users. The seed deletes existing bookings,
   payments, guests and notes before inserting — never run any seed on
   a database that holds real data (see DEPLOYMENT.md).
4. Immediately after seeding, verify the counts in the admin: rooms and
   units match the client's real inventory; bookings, cached reviews
   and promo codes are empty until the owner creates real ones.

---

## Step 7: Deployment to BDIX VPS

Follow the detailed infrastructure steps in [`docs/DEPLOYMENT.md`](./DEPLOYMENT.md):
1. SSH into BDIX VPS.
2. Clone repository & install dependencies (`pnpm install --frozen-lockfile`).
3. Build application (`pnpm build`).
4. Start PM2 cluster (`pm2 start ecosystem.config.js`).
5. Configure Nginx reverse proxy with SSL via Let's Encrypt.
6. **Critical Requirement**: Verify Cloudflare DNS is configured in **DNS-Only Mode (Gray Cloud)** to preserve BDIX <15ms intra-country speed.

---

## Step 8: Post-Launch Quality Audit Checklist

Run through these checks before client sign-off:
- [ ] Verify HTTPS SSL certificate validity on domain.
- [ ] Test mobile responsiveness on **360px viewport width** (no horizontal scrollbar).
- [ ] Verify Bangla script rendering (`src/content/bn.ts`).
- [ ] Test end-to-end booking flow with test payment (bKash / Nagad).
- [ ] Verify floating WhatsApp button opens `wa.me` with prefilled message.
- [ ] Verify Callback Modal submits successfully and logs entry in Admin Portal (`/admin`).
- [ ] Submit sitemap URL (`https://clientdomain.com/sitemap.xml`) to Google Search Console.
- [ ] No demo banner, demo copy, or another property's name anywhere on
      the public site (search the rendered pages, not just the code).
- [ ] Room freshness test: change one room's price in the admin and
      confirm the new price on the homepage, room pages, and a booking
      quote within one request; deactivate the room and confirm it
      vanishes from every public listing.
- [ ] Create a promo code in /admin/rooms/rates and confirm it applies
      in the booking flow; deactivate it and confirm it is rejected.
- [ ] Payments are in live mode (PAYMENT_MODE is not `simulate`).
- [ ] Chatbot check (if Concierge is connected): run the room sync and
      ask the chatbot for a room price — it must match the admin price.

---

## Step 9: Client Handoff & 30-Minute Training Call Agenda

### Deliverables Handed to Client:
- Admin Portal URL (`https://clientdomain.com/admin`)
- Owner & Staff Credentials
- Agency Support Desk WhatsApp contact

### 30-Minute Training Agenda:
1. **00-05 mins**: Overview of Admin Dashboard stats (Revenue, Occupancy, Bookings).
2. **05-15 mins**: How to manage Room Inventory (updating available units, setting seasonal pricing).
3. **15-20 mins**: How to view and filter Bookings and Callback Leads.
4. **20-25 mins**: Exporting monthly CSV reports for accounting.
5. **25-30 mins**: Q&A and emergency escalation procedure.

Train the owner only on what they can truly self-manage in the admin:
rooms and units, seasonal rates, promo codes, and (when shipped) offers.
Be explicit about anything that still requires an agency change order,
and never tell an owner the website reflects their admin edits until
the Step 8 freshness test has passed in front of them.

---

## Step 10: Retainer Setup & Maintenance Scope

### Suggested Monthly Retainer Package ($150 - $300 / month):
- **Hosting & Infrastructure**: BDIX VPS uptime monitoring, Nginx SSL renewal, Cloudflare DNS maintenance.
- **Database & Backups**: Nightly PostgreSQL backups with 30-day retention, copied off-site to Cloudflare R2, plus a quarterly restore test (docs/DEPLOYMENT.md, section 7).
- **Content Updates**: Up to 2 hours of monthly content updates (new blog posts, seasonal packages, photo gallery additions).
- **Security Updates**: Next.js & dependency security patches.

---

## Configuring Premium Features

The scaffold includes modular premium features that can be enabled or upsold to clients. Follow the step-by-step instructions below to configure each feature.

### 1. Enabling Features in `brand.config.ts`

Open `src/components/brand/brand.config.ts` and set the feature flags according to the client's purchased package:

```ts
export const defaultBrandConfig: BrandConfig = {
  // ... core brand details
  features: {
    interactiveMap: true,       // Interactive Google Maps directions ("How to Reach" page)
    googleReviews: true,        // Google Business Profile Reviews integration
    areaGuideMap: true,         // Curated Local Area & Destination Guide
    aiChatbot: true,            // AI Concierge Chatbot
  },
};
```

---

### 2. Obtaining & Configuring API Keys

Update your `.env.production` (or `.env.local`) with the required API keys for each enabled feature:

#### A. Interactive Map (Google Maps API)
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select a project, then navigate to **APIs & Services > Credentials**.
3. Create an API Key and enable the **Maps JavaScript API**.
4. Restrict the API key to your client's domain HTTP referrers (e.g., `*.clientresort.com/*`).
5. Add key to `.env.production`:
   ```env
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="AIzaSyYourGoogleMapsApiKeyHere"
   ```

#### B. Google Business Profile / Places API (Google Reviews)
1. In the Google Cloud Console, enable the **Places API (New)**.
2. Generate an API key (or reuse your restricted Google Maps API key with Places API enabled).
3. Find your Google Place ID using the [Google Place ID Finder](https://developers.google.com/maps/documentation/places/web-service/place-id).
4. Add credentials to `.env.production`:
   ```env
   GOOGLE_MAPS_API_KEY="AIzaSyYourGooglePlacesApiKeyHere"
   GOOGLE_PLACE_ID="ChIJN1t_tDeuEmsRUsoyG83frY4"
   CRON_SECRET="your-secure-random-cron-secret-token"
   ```

#### C. AI Concierge Chatbot (OpenAI API)
1. Create an account on [OpenAI Platform](https://platform.openai.com/).
2. Navigate to **API Keys** and create a new secret key.
3. Set up usage limits / billing alerts to control operational costs.
4. Add key to `.env.production`:
   ```env
   OPENAI_API_KEY="sk-proj-YourOpenAIApiKeyHere"
   ```

---

### 3. Setting Up Cron Job for Google Reviews Caching

To keep Google Business Profile reviews fresh while preventing excessive Google API calls and rate-limiting, the application caches reviews in the database via `/api/cron/fetch-google-reviews`.

#### Setting Up Server Cron (crontab):
1. SSH into the production server.
2. Edit crontab:
   ```bash
   crontab -e
   ```
3. Add a daily or weekly cron entry (e.g., every night at midnight):
   ```bash
   0 0 * * * curl -X POST "https://clientdomain.com/api/cron/fetch-google-reviews" -H "Authorization: Bearer YOUR_CRON_SECRET" > /dev/null 2>&1
   ```
4. Verify the cron run in application logs or query the `GoogleReviewCache` Prisma table.

---

### 4. Training the AI Chatbot (Knowledge Base)

The AI Concierge Chatbot uses an in-memory Retrieval-Augmented Generation (RAG) knowledge pipeline (`src/lib/ai/`) to answer guest questions about resort amenities, check-in policies, local attractions, and dining options. It combines two sources at request time, no build step or ingestion pipeline is required:

1. **Live property data**: `Destination` and `Room` records are pulled directly from the database (via Prisma) each time the knowledge base is built in memory.
2. **Static FAQ entries**: Edit the `siteFAQChunks` array in `src/lib/ai/knowledgeBase.ts` to add or update factual answers regarding:
   - Check-in/check-out rules and early check-in fees
   - Pool timings, spa services, and room service menus
   - Local transport, airport transfers, and nearby attractions

#### Workflow to Update Chatbot Knowledge:
1. Edit `siteFAQChunks` in `src/lib/ai/knowledgeBase.ts` with the client's policies and FAQs.
2. Redeploy the site (see `docs/DEPLOYMENT.md`) so the change ships with the running server.
3. **Test Responses**: Interact with the chatbot on the staging environment to verify answers, tone, and accuracy before deploying to production.

---

### 5. Configuring PMS Integration & Webhooks

The scaffold provides a modular Property Management System (PMS) integration framework supporting real-time webhook listeners and scheduled inventory synchronization.

#### Webhook Endpoint
Configure your client's PMS (e.g. Gyoroom, ZHMS, Aiosell) to dispatch webhooks to:
```
POST https://clientdomain.com/api/webhooks/pms/[provider]
```
For example: `https://clientdomain.com/api/webhooks/pms/gyoroom`

#### Webhook Authentication
Webhooks require authentication via an HTTP header or query parameter:
- Header: `x-pms-secret: <YOUR_PMS_WEBHOOK_SECRET>`
- Bearer: `Authorization: Bearer <YOUR_PMS_WEBHOOK_SECRET>`
- Query string: `?secret=<YOUR_PMS_WEBHOOK_SECRET>`

Set `PMS_WEBHOOK_SECRET` in `.env.production` or inside `src/components/brand/brand.config.ts`.

#### Supported Webhook Events
- `new_booking` / `booking.created`: Automatically creates guest & booking records in the PostgreSQL database. Requires `PMS_WEBHOOK_SECRET`: without it every webhook is rejected.
- `cancellation` / `booking.cancelled`: Marks existing booking status as `CANCELLED`.
- `inventory_update` / `availability.changed`: Updates room `availableUnits` directly.

---

## bKash Tokenized Checkout Integration Setup

1. **Obtain bKash Merchant Credentials** from the client's bKash Merchant Account onboarding portal (App Key, App Secret, Username, Password).
2. **Configure Environment Variables** in `.env.production`:
   ```env
   BKASH_BASE_URL="https://tokenized.pay.bka.sh/v1.2.0-beta"
   BKASH_APP_KEY="client_app_key"
   BKASH_APP_SECRET="client_app_secret"
   BKASH_USERNAME="client_username"
   BKASH_PASSWORD="client_password"
   BKASH_CALLBACK_URL="https://clientdomain.com/api/payments/bkash/callback"
   BKASH_WEBHOOK_SECRET="client_webhook_secret"
   BKASH_IS_SANDBOX="false"
   ```
3. **Sandbox Testing**: First test using bKash Sandbox credentials (`BKASH_IS_SANDBOX="true"`) to verify grant token generation, payment creation, redirect callback execution, status queries, and refunds.
4. **Production Sign-Off**: Switch `BKASH_IS_SANDBOX="false"` and apply live bKash merchant credentials after client sign-off.
5. **Portal Callback Configuration**: Register the callback URL in the bKash Merchant Portal:
   `https://clientdomain.com/api/payments/bkash/callback`

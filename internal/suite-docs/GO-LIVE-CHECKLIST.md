# Go-live checklist (each client)

What has to be done, in order, before a client's guests, money and staff go through a new deployment. Everything here is configuration or a decision; the code is finished. Detail behind each step is linked.

## 1. Server and secrets

- [ ] VPS set up per [DEPLOYMENT.md](DEPLOYMENT.md) §1–5: PostgreSQL 16, Node, PM2 (`TZ=Asia/Dhaka`), nginx with `X-Real-IP $remote_addr`, Let's Encrypt, the canonical-host redirects. Cloudflare DNS-only (grey cloud).
- [ ] `.env` from `.env.example`, with `NODE_ENV=production`. Generate `BETTER_AUTH_SECRET` and `CRON_SECRET` with `openssl rand -hex 32`.
- [ ] `pnpm check:env` passes for every gateway the client uses. Turn the rest off in `brand.config.ts`.
- [ ] `pnpm build` (applies the migrations), `pm2 start`.

## 2. Brand and property

- [ ] `src/components/brand/brand.config.ts`: name, contact, address (must match Google Business Profile), domain, policies, payments on or off, `rms.modules` defaults, `rms.roles.enabledRoles`.
- [ ] SEO: `docs/seo/KEYWORD-MAP.md`, `LOCAL-SEO-CHECKLIST.md`, regenerate `public/llms.txt`.

## 3. People

- [ ] The owner signs in and sets up two-factor sign-in (required before Settings opens).
- [ ] Invite staff from Settings › Users, one role each (`docs/rms/01-ROLES-AND-PERMISSIONS.md`). Test users are never created on a production server (`docs/rms/phase-a2/03-TEST-USERS.md`).

## 4. Modules (Settings › Modules)

Switch on what the client uses:
- Purchasing.
- Accounting, then Finance (Finance needs Accounting).
- HR, then Payroll (Payroll needs HR).

Then:
- [ ] **Rooms:** room types and units (`/admin/rooms`).
- [ ] **Front desk:** confirm the property timezone (Settings › General). The first business day opens itself.
- [ ] **Accounting:** the accountant sets the books start date (Finance), then enters opening balances as a manual journal on that date for someone else to approve. Rename accounts or add the bank's name as needed.
- [ ] **HR:** add every employee, including those without a login. The owner links logins to records.
- [ ] **Payroll:** the first run is for the first full month after the HR records are complete.

## 5. Content provenance & demo-data gate (BLOCKING)

Everything a guest can see, book, or be charged for must come from the
database or Settings and be manageable by the owner/manager in the
admin. Demo content in any form fails this gate.

### Public content reads the database — never a theme file

- [ ] Homepage, /stay and /stay/[slug] render rooms from the Room table
      (title, price, capacity, amenities, photos). No public page imports
      room, offer, experience, dining, gallery, testimonial or FAQ data
      from `src/demo/` or any static data file.
- [ ] The static theme dataset (`src/demo/swiss/data.ts`) no longer
      contains another property's content. If any section still renders
      from a content file (legal pages, brand copy in
      `src/content/en.ts` / `bn.ts`), it holds THIS client's approved
      copy — never demo copy.
- [ ] Offers are database records managed in the admin (active flag,
      validity window, terms), rendered from the DB on the homepage and
      /offers — or, until the Offers module ships, the /offers page and
      the homepage offers section are REMOVED. A client site never
      displays offers labelled or functioning as demonstrations.
- [ ] Promo codes and seasonal rates exist only if the owner created
      them in /admin/rooms/rates. Demo codes (ROMANCE10, WELLNESS15,
      FAMILY20) are absent.
- [ ] FAQs, experiences, dining and gallery content shown to guests is
      the client's own, entered via admin/Settings or an approved
      content file for this client — not the demo property's.

### Admin edits propagate instantly — verified, not assumed

- [ ] Change a room's price in /admin/rooms → the new price appears on
      the homepage, /stay, /destinations, the booking page, and a new
      booking quote, on the next request, with no redeploy and no
      waiting period.
- [ ] Deactivate a room → it disappears from EVERY public listing
      (including /destinations and price-from calculations), the
      booking flow refuses it, and availability returns not-found.
- [ ] Reactivate it → it is visible and bookable again on the next
      request.
- [ ] Toggle a promo code off → the booking flow rejects it
      immediately; toggle on → it applies.
- [ ] After the final room setup, re-run the Concierge room sync
      (Settings → Booking system → Test connection / Sync) so the
      chatbot's catalogue matches production rooms.

### Zero demo data

- [ ] The production database was seeded with the production seed
      profile ONLY (destinations, rooms, units, settings, first owner).
      The demo seeders — demo bookings, demo operations, mock reviews,
      demo promo codes, sample blog posts, test users — did not run.
      Verify by count: bookings not created by real use = 0, cached
      reviews = 0, promo codes = only owner-created, users = owner +
      invited staff only.
- [ ] The DemoBanner component and its layout usage are removed; no
      page shows a demo or hackathon banner.
- [ ] `PAYMENT_MODE` is live (never `simulate`) and the demo payment
      gateway route (`(swiss)/demo-gateway`) is removed or disabled.
- [ ] No test accounts exist (`test-*@demo.resort` or similar); the
      first owner was created via `seed-admin` with explicit
      credentials and has 2FA enabled.
- [ ] Search the public site and the database for the demo property's
      name and content (e.g. the scaffold's sample resort): zero hits
      outside git history.

### Launch prerequisites (code)

The gate above cannot pass on the current scaffold without these code
changes. They are launch prerequisites — deliberately NOT done on the
demo branches — and building them is separate, founder-scheduled work:

- Rewire the (swiss) public pages to the database — homepage, /stay,
  /stay/[slug] (and, following the same pattern, /offers,
  /experiences, /dining, /gallery, /faq, /about, /contact) read
  Room/content data the way /destinations detail already does,
  instead of src/demo/swiss/data.ts.
- Complete the revalidation coverage — both room mutations
  (createOrUpdateRoom, toggleRoomStatus) revalidate every public
  surface that shows rooms (/, /stay, /stay/[slug], /destinations +
  detail, /book), and every public room query filters isActive.
- Build the Offers module on the PromoCode pattern — an Offer model
  (title, terms, validity window, isActive, optional link to a promo
  code), admin CRUD alongside /admin/rooms/rates, public rendering
  from the DB — or formally remove the offers surfaces from client
  builds until it ships.
- Split the seed — a production seed profile that cannot invoke the
  demo seeders (bookings, operations, mock reviews, demo promo codes,
  sample blog, test users), with the demo seeders behind explicit
  opt-in env flags, following the existing SEED_TEST_USERS precedent.

## 6. Scheduled jobs

- [ ] Paste the crontab from [DEPLOYMENT.md §7.2e](DEPLOYMENT.md), only the lines for what this client uses, plus the backup and its off-site copy (§7.1–7.2).
- [ ] The next day, **Admin › System health** says "Everything is working". A job showing "Never ran" is missing from the crontab.
- [ ] Do a restore test into a scratch database (§7.3) before go-live, then quarterly.

## 7. Payment gateways (each one enabled)

- [ ] Confirm the refund window in the merchant agreement (7 days is assumed).
- [ ] **Nagad:** a real sandbox payment before enabling. **SSLCommerz:** confirm real IPN delivery to the public HTTPS URL. **bKash:** confirm the first real SNS webhook arrives. See [PRODUCTION-READINESS-REPORT.md](PRODUCTION-READINESS-REPORT.md) §5.

## 8. Owner decisions still open

- [ ] **VAT and supplementary duty:** the property's registration (BIN), rates and which services carry SD. Until then prices are tax-inclusive and no VAT is posted (Phase F L1).
- [ ] **Leave allowances, festival bonus and tax on salaries:** the defaults are the Labour Act minimums; bonus and tax are entered by hand on each payroll run (Phase G L3).
- [ ] **Performance sprint:** resume `perf-remediation` before launch or not (readiness report §2).

## 9. First week

- [ ] Check System health daily.
- [ ] The accountant runs the trial balance after the first week: it must balance, and guest balances must match the open folios.
- [ ] The auditor reviews the audit log for unexpected sign-in failures (`SIGN_IN_FAILED`).

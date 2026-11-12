# FU-6: runtime overrides for contact details and guest policies

An OWNER can now change the reservations phone, WhatsApp number, contact email, check-in/out times and the early check-in / late check-out fees in **Settings › General**. The change reaches the public website, its search-engine data (JSON-LD) and guest emails on the next page view, with no redeploy.

The owner's constraints for this design were:
- Keep the values in `brand.config.ts`; an override wins only when one is set.
- Add no latency to the landing page.
- Use storage that is small and very fast.

## 1. What can be overridden

| Field | Settings column | Overrides in `brand.config.ts` | Editable |
|---|---|---|---|
| Contact email | `contactEmail` | `contact.email` (also the default Reply-To of every email) | ✅ |
| Contact phone | `contactPhone` | `contact.phone` | ✅ |
| WhatsApp number | `whatsapp` (new, additive migration `20261007100000_settings_whatsapp`) | `contact.whatsapp` | ✅ |
| Check-in / check-out time | `checkInTime`, `checkOutTime` | `property.checkinTime`, `property.checkoutTime` | ✅ |
| Early check-in / late check-out fee | `earlyCheckInFeePoisha`, `lateCheckOutFeePoisha` | `policies.earlyCheckIn.feeBdt`, `policies.lateCheckOut.feeBdt` | ✅ (whole taka) |
| Timezone | `timezone` | none (admin only) | ✅ (since §5) |
| Property name, address | `propertyName`, `address` | `name`, `contact.address` | ❌ config only |
| Cancellation policy | `cancellationPolicy` | none: the bilingual `/refund-policy` page | ❌ config only |

**Why name and address stay in config:** they are tied to:
- the logo and the domain;
- every page title;
- the map pin and coordinates;
- the Google Business Profile.

Changing either is a rebrand or a move, and needs a redeploy anyway. A value written to those columns by hand is ignored (`CONFIG_ONLY_FIELDS` in `src/lib/settings.ts`), so the tab always shows what the site actually uses.

**Precedence:** a non-null column wins; NULL means "use `brand.config.ts`". Every field has a **Use default (…)** button that sets it back to NULL. A later `brand.config.ts` change shows through for every field that isn't overridden.

## 2. Validation (`parseGeneralInput`)

- **Email:** a bare address only, no display name and no line breaks, so the field can't inject email headers.
- **Phone:** 6–15 digits; spaces, dashes and brackets allowed; stored as typed.
- **WhatsApp:** 8–15 digits, stored as `+<digits>`. A local `01…` number is refused, because `wa.me` needs the country code.
- **Times:** `HH:MM`, 24-hour, with three ordering rules:
  - check-in must be later than the early check-in start;
  - check-out must be earlier than the late check-out end;
  - check-out can't be later than check-in, so rooms can be turned around between guests.

  The two windows come from `brand.config.ts`, and a field the save doesn't change is checked at its current value.
- **Fees:** whole taka, ৳0–৳1,00,000, stored in poisha. The FAQ and schema state fees in taka.
- **Anything else** is refused by name (`read_only`) and never dropped silently.

**Saving:** each save writes the row and a `SETTINGS_UPDATED` audit row in one transaction. The audit `diff` lists only the changed fields; `null` means "back to the default". The save needs `SETTINGS.edit` (OWNER) with 2FA.

## 3. How it stays fast

```
brand.config.ts ──┐
                  ├─ getSettings() / getSiteBrand()  ← Next.js data cache, in memory, tag "site-settings"
Settings row ─────┘          │
                             ├─ server pages, JSON-LD, FAQ, press kit, emails
                             └─ root layout → <BrandProvider overrides={7 public values}> → client components
```

- **No change to page rendering.** Every public page is still prerendered (`○`/`●` in the build), with the same `revalidate` times as before: home 1h, destinations 1d, most pages fully static. Visitors get cached HTML and never wait for a settings read.
  - The settings cache has no time-based refresh. A time-based refresh there would become every page's refresh interval, because Next.js applies the lowest one.
- **The database is read only after a save.** Each server process caches the row in memory (`unstable_cache`). Nothing else re-reads it.
- **The save refreshes everything at once:** `updateTag("site-settings")` plus `revalidatePath("/", "layout")`. A timezone-only save revalidates only `/admin`.
  - Each page is re-rendered once, on its first visit after the save. That one visitor waits for the render, about the cost of a cold page.
- **If the database is down,** the last values this process read are used, or `brand.config.ts` if it has read none. The error is logged.
- **Nothing secret reaches the browser.** Client components receive only the seven public values (`src/lib/site-overrides.ts`), never the server's `BrandConfig`, which holds PMS keys.

**Measured** (production build, 360 px, two `next start` processes on one build):
- **Landing page time to first byte:** median 1.9–2.1 ms, p90 2.3–2.6 ms, both before and after a save.

**Why Postgres plus the in-memory cache, and not a separate store:**
- After the first read, the in-memory cache is as fast as a key-value store.
- Postgres already provides the transaction with the audit row, nightly backups (`scripts/backup-postgres.sh`) and the permission checks.
- A JSON file or Redis would add a second thing to back up and secure.

## 4. PM2 cluster: `cache-handler.cjs`

**The problem:** `docs/DEPLOYMENT.md` runs PM2 with `instances: "max"`. Next.js keeps revalidation state in memory per process, so a save handled by worker A would leave workers B, C, … serving old pages. The longest wait would be a day (`/destinations/*`), and for pages without `revalidate`, until the next deploy.

**The fix:** `cache-handler.cjs`, set as `cacheHandler` in `next.config.ts`, is Next's own file-system cache plus one addition:
- **On a save:** each revalidated tag is also written to `.next/cache/shared-tags/<sha1>.json` (atomic rename).
- **On a cached read:** before answering from cache, a worker `stat`s the files for that entry's tags (a few microseconds) and applies any newer revalidation.

**What isn't covered:** this works for every process on one host (PM2 cluster, or one Docker container). Several hosts behind a load balancer would need a shared handler (Redis, for example), which is out of scope for a single-VPS deployment.

**Maintenance:** the handler extends two internal Next.js modules. `src/lib/cache-handler.test.ts` fails if a Next.js upgrade moves or changes them. If it fails, re-check the handler before upgrading.

**Live proof** (two production servers on ports 3101 and 3102, sharing one `.next`, like two PM2 workers):
- Saved on A: phone `+880 1811-222333`, WhatsApp, check-in `13:00`, early fee ৳2,000.
- On B, which never saw the save:
  - `/faq` was fresh on its first request;
  - `/contact`'s client-rendered WhatsApp links showed the new number.
- Reset the phone to default on A, then fetched B's `/`: `x-nextjs-cache: REVALIDATED` (a blocking re-render) with the default phone in the HTML and the JSON-LD.
- One caveat seen: an entry already past its own `revalidate` time is served stale once while it re-renders. That is standard Next.js stale-while-revalidate, and it applies equally without the handler.
- Two audit rows recorded the exact before/after values.
- The page HTML contained no `apiKey`/`webhookSecret`.
- The standalone `server.js` (Docker) served `/`, `/faq` and `/admin/login` with the handler.

## 5. Readers moved to the runtime brand

- **Server:**
  - root layout (Organization JSON-LD, `BrandProvider`);
  - home, reviews and contact (LodgingBusiness JSON-LD);
  - destination pages (lodging graph, reservations phone);
  - FAQ (items and FAQPage schema);
  - amenities, dining and how-to-reach (answers);
  - press kit;
  - lead and BanglaQR-rejection emails;
  - every email's default Reply-To (`sendEmail`);
  - the Settings › General email card;
  - the test email.
- **Client (via `useBrand()`):** footer contact list (`FooterContact`, a small client island; the rest of the footer stays server-rendered), floating call/WhatsApp buttons, chat widget, contact page, maintenance page, payment result pages and payment method selector (these already used `useBrand()`).
- **Pure helpers now take the brand as an argument:**
  - `faqItems(brand)`, `faqByCategory(items)`;
  - `brandVars(brand)`, `facilityList(brand, limit?)`;
  - `getOrganizationSchema(brand)`, `getLodgingBusinessSchema(brand, opts)`, `getDestinationLodgingGraph(dest, brand)`.

  With no module-level brand constant, a reader can't silently keep the build-time value.

## 6. Tests

| Suite | Covers |
|---|---|
| `src/lib/settings.test.ts` | Precedence, config-only fields ignored, cached rows with string dates, overrides applied (nothing else changed, config object untouched), the seven-value client payload, every validation rule |
| `src/lib/settings.fallback.test.ts` | Database down: `brand.config.ts` with no earlier read; last values after one |
| `src/lib/cache-handler.test.ts` | Next.js internals still present; a revalidation in one process expires older entries in another; newest timestamp wins; broken or missing files are ignored; caches without a dist folder cache nothing |
| `src/app/actions/settings.db.test.ts` | Save, audit and site brand; reset to default; revalidation targets; refusals write nothing; MANAGER forbidden |

# Growth Infrastructure Forensic Audit Verification Report

**Branch:** `growth-infrastructure` (HEAD at `365688fe637b349bf8786a295a94568445abfe38`)
**Audit Date:** September 27, 2026
**Auditor:** Jules (AI Software Engineer)
**Methodology:** Independent raw execution verification pass against actual tool and shell outputs.

---

## 1. Summary Table of Claims & Verification Status

| Claim / Section | Claim Summary | Status | Evidence / Notes |
|---|---|---|---|
| **1.1 Git History** | Clean scoped commits per section. | ❌ Unverified | Commit history in repo contains 1 single commit `365688f` bundling all 295 changed files instead of section-scoped commits. |
| **1.2 Git Diff Stat** | Changed file count & line changes. | ✅ Verified | `295 files changed, 33408 insertions(+)` |
| **1.3 Dependencies** | New dependencies in `package.json`. | ⚠️ Partial | `package.json` modified (`+46` lines); lockfile was missing / deleted, requiring lockfile update during clean `pnpm install`. No unauthorized runtime libraries added. |
| **2.1 Structured Data Exports** | Schema functions in `src/lib/structured-data.ts`. | ✅ Verified | 10 generator functions exported: `getLocalBusinessSchema`, `getHotelSchema`, `getPlaceSchema`, `getTouristAttractionSchema`, `getFAQSchema`, `getArticleSchema`, `getBreadcrumbSchema`, `getSpeakableSchema`, `getImageObjectSchema`, `getAggregateRatingSchema`. |
| **2.2 Structured Data Usage** | All generators imported and called from pages. | ⚠️ Partial | `getLocalBusinessSchema`, `getHotelSchema`, `getFAQSchema`, `getArticleSchema`, `getBreadcrumbSchema` are imported and called. `getPlaceSchema`, `getTouristAttractionSchema`, `getSpeakableSchema`, `getImageObjectSchema`, `getAggregateRatingSchema` are dead code (0 page imports). |
| **2.3 JSON-LD Injected HTML** | Server-rendered JSON-LD present in HTML. | ✅ Verified | Tested via `curl` against production build. Valid `<script type="application/ld+json">` tags found on `/`, `/faq`, `/destinations/[slug]`, and `/blog/[slug]`. |
| **2.4 JSON Syntax** | Valid JSON-LD syntax. | ✅ Verified | All extracted JSON-LD blocks parsed cleanly through `JSON.parse` / `jq` without errors. |
| **2.5 Rich Results Test** | Google Rich Results Validation. | ❌ Unverified | Direct external browser connection to Google Rich Results tool unavailable in sandbox environment. |
| **3.1 Direct Answer Blocks** | Genuine Direct Answer blocks across 6 pages. | ⚠️ Partial | `/faq` and `/how-to-reach` contain clear H2/H3 question headers followed by concise direct answers. `/destinations/[slug]`, `/explore-the-area/[slug]`, `/blog/[slug]`, and `/` lack explicit H2/H3 + 1-sentence answer question blocks. |
| **3.2 Visible Text First 100 Words** | Readers see direct answers immediately. | ✅ Verified | Extracted text confirms immediate answer visibility on `/faq` and `/how-to-reach`. |
| **4.1 RUM Metric Storage** | In-memory store vs DB. | ⚠️ Partial | Stored in module-level array `cwvStore: CWVMetricRecord[]` capped at 1000 records in `src/app/api/analytics/rum/route.ts`. |
| **4.2 - 4.5 RUM Persistence** | Metrics survive server restarts. | ❌ Not Production-Grade | Post beacon sent (`{"name":"LCP","value":1234}`), metric appeared (`sampleCount: 1`). Upon server restart (`pkill` + `pnpm start`), data reset to `sampleCount: 0`. Admin `/admin/performance` renders static hardcoded cards (`1.2s`, `85ms`, `0.02`). |
| **5.1 - 5.5 Core Web Vitals** | CWV targets met (LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1, Performance ≥ 90). | ❌ Failed Targets | Lighthouse Mobile Audit Raw Outputs:<br>- Homepage: Performance 51, LCP 8.0s, TBT 1060ms, CLS 0.<br>- `/faq`: Performance 71, LCP 7.7s, TBT 230ms, CLS 0.<br>- `/destinations/lawachara-eco-resort`: Performance 64, LCP 9.5s, TBT 400ms, CLS 0. |
| **6.1 - 6.2 Dictionary Keys** | Key parity between `en.ts` and `bn.ts`. | ✅ Verified | Both files contain exactly 539 keys across 582/583 lines. Key parity is 100%. |
| **6.3 Untranslated Strings** | No long runs of Latin characters in `bn.ts`. | ⚠️ Partial | Admin shell sections (`adminShell`) in `bn.ts` retain English labels (`Dashboard`, `Bookings`, `Rooms`, `Settings`). Customer-facing pages are translated into natural Bengali. |
| **6.4 - 6.5 Bengali Fluency** | Bengali content accuracy. | ⚠️ Unverified | Direct customer translations read fluently (e.g. `সমুদ্রপাড়ের সুস্বাদু ভোজন`), but requires native speaker review for full copy validation. |
| **7.1 Route Response Codes** | HTTP 200 on new routes. | ✅ Verified | `curl` returned `200` for `/press-kit`, `/share-your-stay`, and `/feed.xml`. |
| **7.2 /press-kit Assets** | Real vs placeholder asset links. | ⚠️ Partial | Download link points to `/icon.png` (real file), but `/gallery` link points to gallery route rather than a direct downloadable media zip archive. |
| **7.3 /share-your-stay Links** | Social and review links. | ⚠️ Partial | Links point to generic domain roots (`https://maps.google.com`, `https://facebook.com`) rather than client's specific Google Business Profile ID or Facebook page ID. |
| **7.4 /feed.xml RSS** | Valid RSS 2.0 XML feed. | ✅ Verified | Returns valid RSS 2.0 XML schema with `<channel>`, `<title>`, `<link>`, and `<item>` tags. |
| **8.1 WeatherWidget** | Open-Meteo API integration. | ❌ Unverified / Missing | No dedicated `WeatherWidget` component exists in `src/components/travel/`. Weather forecasting is not rendered. |
| **8.2 PackingChecklist** | Dynamic / printable checklist. | ❌ Unverified / Missing | No dedicated `PackingChecklist` component exists in `src/components/travel/`. |
| **8.3 ExitIntentModal** | Exit intent trigger & config gate. | ✅ Verified | Implemented in `src/components/travel/FloatingWidgets.tsx`. Config-gated via `defaultBrandConfig.exitIntentEnabled`, fires once per session using `sessionStorage.setItem("exit_intent_fired", "true")`. |
| **8.4 WhatsApp Float** | Configured via `brand.config.ts`. | ✅ Verified | Reads `defaultBrandConfig.contact.whatsapp` dynamically across `FloatingWidgets.tsx`, `ChatWidget.tsx`, and `BrandFooter.tsx`. |
| **9.1 - 9.2 SEO Documentation** | Detailed documentation in `docs/seo/`. | ⚠️ Thin | All 6 files in `docs/seo/` are between 12 and 25 lines (total 93 lines across directory). |
| **9.3 KEYWORD-MAP.md** | Keyword to route mapping. | ✅ Verified | Contains 6 mapped routes with primary keywords, secondary keywords, and intent taxonomy. |
| **9.4 SCHEMA-REFERENCE.md** | Schema reference document. | ✅ Verified | Lists implemented schemas, helper functions, and applied routes. |
| **10.1 - 10.3 Build Health** | Clean build & lint status. | ✅ Verified | `pnpm build` succeeded (70 static routes generated). `eslint` passed with 0 errors. Route table includes all new endpoints. |

---

## 2. List of Defects Found

### Defect 1: Core Web Vitals Targets Missed (High Severity)
- **File:** Entire client bundle & page hydration pipeline.
- **Description:** Mobile Lighthouse audit performance scores fall between 51 and 71 (target was ≥ 90). LCP ranges from 7.7s to 9.5s (target ≤ 2.5s). TBT ranges from 230ms to 1060ms (target ≤ 200ms).
- **Cause:** Large client bundle hydration, font loading delays, and unoptimized image payloads on initial render.

### Defect 2: In-Memory RUM Metric Loss (Medium Severity)
- **File:** `src/app/api/analytics/rum/route.ts`
- **Description:** CWV metrics are stored in a node module array (`cwvStore`). All collected metrics are wiped upon server restart or redeploy. Furthermore, `/admin/performance` displays hardcoded stat cards rather than fetching real p75 values from the RUM API endpoint.

### Defect 3: Missing Travel Components (Medium Severity)
- **Files:** `WeatherWidget.tsx`, `PackingChecklist.tsx`
- **Description:** Neither component exists in `src/components/travel/` despite being claimed in travel feature specs.

### Defect 4: Dead Code in Structured Data Library (Low Severity)
- **File:** `src/lib/structured-data.ts`
- **Description:** 5 out of 10 exported schema generators (`getPlaceSchema`, `getTouristAttractionSchema`, `getSpeakableSchema`, `getImageObjectSchema`, `getAggregateRatingSchema`) have 0 imports across the entire application.

### Defect 5: Generic Placeholders in /share-your-stay Links (Low Severity)
- **File:** `src/app/share-your-stay/page.tsx`
- **Description:** Review call-to-action buttons link to generic homepages `https://maps.google.com` and `https://facebook.com` instead of the resort's dedicated Google Business Profile or Facebook review URL.

---

## 3. Unverified Items & Limitations

1. **Section 2.5 (Google Rich Results Validation):** Automated sandbox environment lacks direct outbound browser access to interactive Google Rich Results Test tool. Syntax was validated via local JSON parser.
2. **Section 6.5 (Bengali Fluency Review):** Native Bangladeshi language review is recommended to confirm stylistic naturalness for commercial promotional copy.

---

## 4. Honest Assessment of Production Readiness

The `growth-infrastructure` branch provides a solid technical foundation with clean TypeScript builds, valid JSON-LD schemas, working RSS feeds, 100% dictionary key parity, and responsive UI components. However, **this branch is NOT production-ready** due to significant performance shortfalls (Mobile LCP > 7.7s and performance score of 51 vs target of 90), non-persistent in-memory RUM metrics that do not feed the admin performance UI, missing weather and packing checklist components, and generic placeholder links on the review page.


---

# Addendum — Organic Search Phase Verification (branch `organic-search`, 2026-09-28)

This addendum records the structured-data validation for the organic-search phase
(`ORGANIC-SEARCH-SUBMISSION.md`). It supersedes rows 2.1, 2.2, 2.5, 7.2 and 7.3 of the audit
above. The audit itself is left unchanged as a historical record.

**Method.** A production build (`NEXT_PUBLIC_ENV=production`) was served locally. localhost
can't be reached by Google's URL fetcher, so each page's rendered JSON-LD (every
`<script type="application/ld+json">` block, exactly as served to Googlebot) was pasted into
Google's **Rich Results Test** in *Code* mode, driven through Playwright. Vocabulary was
cross-checked in the **Schema.org Markup Validator**. For `/` and `/faq` the full page HTML was
used there, so the Speakable CSS selectors are checked against real markup.

## Rich Results Test (Google)

| Page | Result | Detected rich-result types | Errors | Non-critical issues |
|---|---|---|---|---|
| `/` | ✅ 5 valid items | Local businesses (2), Organization (2), Review snippets (1) | 0 | 0 |
| `/faq` | ✅ 3 valid items | Breadcrumbs, Local businesses, Organization | 0 | 0 |
| `/destinations/coxs-bazar` | ✅ 5 valid items | Breadcrumbs, Local businesses (2), Organization (2) | 0 | 1: `postalCode` missing (optional). The Destination model has no postcode |
| `/blog/ultimate-coxs-bazar-travel-guide` | ✅ 4 valid items | Articles, Breadcrumbs, Local businesses, Organization | 0 | 1: `author.url` missing (optional). No author profile pages exist |
| `/reviews` | ✅ 9 valid items | Local businesses (2), Organization (2), Review snippets (5) | 0 | 0 |
| `/explore-the-area/lawachara-national-park` | ✅ 3 valid items | Breadcrumbs, Local businesses, Organization | 0 | 0 |

Notes:
- **FAQPage** is valid but not listed as a rich result. Since August 2023 Google only shows FAQ
  rich results for authoritative government and health sites, so the Rich Results Test ignores
  FAQPage elsewhere. Its syntax is confirmed by the Schema.org validator below.
- Google treats the Organization node (it has an address and telephone) as a Local business, which
  is why each page counts "Local businesses" and "Organization" items.
- Earlier runs during development flagged `address`/`image` missing on Organization (homepage)
  and `addressLocality` on destination lodging. Both were fixed (`1df0d6c`, `9871b88`) and the
  pages re-tested with the results above.

## Schema.org Markup Validator

| Page | Types validated | Errors | Warnings |
|---|---|---|---|
| `/` (full HTML) | Organization, WebSite, Resort + AggregateRating, WebPage + Speakable | 0 | 0 |
| `/faq` (full HTML) | FAQPage (15 Question/Answer), WebPage + Speakable, BreadcrumbList | 0 | 0 |
| `/destinations/coxs-bazar` | Resort, HotelRoom ×2, Offer + UnitPriceSpecification, BedDetails, ImageObject, BreadcrumbList | 0 | 0 |
| `/blog/ultimate-coxs-bazar-travel-guide` | Article, BreadcrumbList | 0 | 0 |
| `/explore-the-area/lawachara-national-park` | TouristAttraction, ImageObject, BreadcrumbList | 0 | 0 |
| `/how-to-reach` | Place + GeoCoordinates, BreadcrumbList | 0 | 0 |
| `/contact` | Resort (LocalBusiness), BreadcrumbList | 0 | 0 |
| `/reviews` | Resort + AggregateRating + Review ×4 | 0 | 0 |

A first validator pass that used JSON-LD-only snippets reported 2 errors on WebPage for `/` and
`/faq`: "No matches found for expression h1". The snippet had an empty `<body>`. Re-run with the
full page HTML, both are 0 errors (table above).

## Resolved audit rows

| Row | Previous status | Now |
|---|---|---|
| 2.1 / 2.2 Generators & dead code | 5 of 10 generators dead | 13 generators in `src/lib/structured-data/`, each called from ≥ 1 route (`docs/seo/SCHEMA-REFERENCE.md` §16) |
| 2.5 Rich Results Test | ❌ Unverified | ✅ Run. Results above |
| 7.2 `/press-kit` assets | Linked `/icon.png` (404) and `/gallery` | ZIP at `/press-kit/download` (fact sheet, SVG/PNG logos, 6 photos); `unzip -t` passes |
| 7.3 `/share-your-stay` links | Generic `maps.google.com` / `facebook.com` | Property-specific Google `writereview?placeid=` and `facebook.com/<page>/reviews`; Tripadvisor only when configured |

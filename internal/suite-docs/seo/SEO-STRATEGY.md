# SEO Strategy

This is the organic-search strategy every client deployment of the travel scaffold inherits. It
covers the approach, the keyword model, the content pillars and the technical decisions behind
them, with the reason for each. The other documents in `docs/seo/` cover the details:

| Document | Scope |
|---|---|
| `CONVENTIONS.md` | Binding technical rules (metadata, URLs, robots, environments) |
| `CONTENT-GUIDE.md` | How to write headings, paragraphs, FAQs, alt text, links |
| `AEO-GEO-GUIDE.md` | Direct answers, entity authority, citation readiness |
| `SCHEMA-REFERENCE.md` | Every JSON-LD type with full examples |
| `KEYWORD-MAP.md` | Per-client keyword → page template |
| `LOCAL-SEO-CHECKLIST.md` | NAP, Google Business Profile, citations, go-live |
| `PERFORMANCE-BUDGET.md` | Core Web Vitals and bundle budget |

---

## 1. Approach: three overlapping disciplines

Travellers find a resort in three ways, and the site is built for all three:

1. **Classic search (SEO).** A ranked link on a results page. Levers: crawlable static HTML,
   unique metadata, internal links, performance.
2. **Answer engines (AEO).** Featured snippets, "People also ask", voice assistants and
   Google's FAQ-style answers. Levers: direct answer blocks, question headings, FAQPage
   schema, tables and lists that can be extracted.
3. **Generative engines (GEO).** Being cited inside an AI-written answer (Google AI Overviews,
   ChatGPT search, Perplexity, Claude). Levers: self-contained factual passages, consistent
   entity names linked to Wikidata, fresh dates, and third-party corroboration (reviews, press).

All three read the same foundation: **accurate, machine-readable facts** that match the
visible page. So the scaffold holds property facts in **one place** (`brand.config.ts`) and
generates the visible copy, the FAQ and the JSON-LD from it. A policy changed in config
changes everywhere at once, and markup cannot drift from the page.

### What this strategy does not do

- It does not invent facts to fill schema. Unknown values (Wikidata ID, TripAdvisor URL, star
  rating) are omitted until the client supplies them.
- It does not mark up reviews that don't come from a real source. `AggregateRating` and
  `Review` come only from the Google review cache.
- It does not promise rich results. Google decides eligibility. For example, it does not
  show review stars for a business's own reviews of itself (LocalBusiness/Organization), and
  FAQ rich results are limited to a small set of sites. The markup is still valid and still
  read by search and AI systems.

---

## 2. Target keyword model

Each client's keywords live in `KEYWORD-MAP.md`. The model has four tiers:

| Tier | Intent | Example (Cox's Bazar client) | Primary page |
|---|---|---|---|
| Brand | Navigational | "client resort and spa" | Homepage |
| Destination + lodging | Commercial | "cox's bazar beach resort", "sea view hotel cox's bazar" | Homepage, `/destinations/[slug]` |
| Trip-planning questions | Informational | "how to go cox's bazar from dhaka", "best time to visit sajek" | `/how-to-reach`, `/explore-the-area/[slug]`, blog |
| Policy questions | Transactional pre-booking | "check in time", "is breakfast included", "pets allowed" | `/faq` |

Bangladeshi searchers mix English, Bengali and Banglish ("coxs bazar hotel vara"). Each
client's keyword map records both scripts, and the Bengali meta copy in `bn.ts → seo` is
written for Bengali queries rather than translated.

Rules:

- One primary keyword per page. It appears in the title (first 30 characters), the `<h1>`
  and the first paragraph.
- No two pages target the same primary keyword. `scripts/check-seo-metadata.ts` enforces
  unique titles and descriptions.
- The location (`property.locationLabel`) is part of every title suffix, giving every
  page a local signal.

---

## 3. Content pillars

| Pillar | Pages | Purpose |
|---|---|---|
| **The property** | Homepage, `/amenities`, `/dining`, `/offers`, `/gallery`, `/reviews` | Brand and commercial queries |
| **Stay & book** | `/destinations/[slug]`, `/book/[roomId]` | Room-level commercial intent, prices, availability |
| **Getting here** | `/how-to-reach` | High-volume "how to go" questions and local transit entities |
| **The area** | `/explore-the-area/[slug]` | Informational attraction queries that bring travellers in early |
| **Policies & answers** | `/faq` | Pre-booking objections, voice queries |
| **Stories** | `/blog/[slug]` | Seasonal and long-tail informational content; freshness |
| **Citation assets** | `/press-kit`, `/share-your-stay`, `/feed.xml` | Earn third-party mentions and reviews |

The content hierarchy and internal-linking rules are in `CONTENT-GUIDE.md` §8.

---

## 4. Technical decisions

| Decision | Why |
|---|---|
| Static generation + ISR (24h for destinations and blog, 1h for review-driven pages) | Fast first byte; content refreshes without redeploys; freshness for GEO |
| `buildMetadata()` is the only metadata builder | Titles, canonicals, OG and hreflang can't diverge between routes |
| Root layout sets **no** canonical | A layout canonical is inherited by every page that lacks one, and before this phase about 20 pages canonicalized to `/` |
| JSON-LD as one `@graph` per page with stable `@id`s | Entities (Organization → Resort → HotelRoom) link instead of duplicating |
| Schema generated from the same data as the visible page | Google requires markup to reflect visible content, and answer engines penalize mismatches |
| `htmlLimitedBots` covers all crawlers | Next.js otherwise streams dynamic-route metadata into `<body>`; Bing, AI crawlers and link previews read only the initial HTML |
| Environment gate on `NEXT_PUBLIC_ENV` | Staging can never be indexed; the default is noindex |
| Single-hop 301s in nginx (see `DEPLOYMENT.md` §5.1) | No redirect chains; Cloudflare stays DNS-only |
| Wikidata-verified entity registry | A wrong `sameAs` is worse than none. The previous scaffold linked the resort to a 14th-century composer |

---

## 5. Measurement

| Signal | Tool | Cadence |
|---|---|---|
| Index coverage, queries, CTR | Google Search Console (submit `/sitemap.xml`) | Weekly |
| Bing and Copilot visibility | Bing Webmaster Tools (submit the sitemap) | Monthly |
| Rich result validity | GSC Enhancements + Rich Results Test on changed templates | Every release |
| Core Web Vitals (field data) | GSC Core Web Vitals report | Monthly |
| AI citations | Manually ask ChatGPT, Perplexity, Gemini and Claude the top 10 questions from `KEYWORD-MAP.md`; record whether the site is cited | Monthly |
| Review velocity | Google Business Profile insights | Monthly |

---

## 6. Sitemap priorities

| Route type | Priority | changefreq | lastModified source |
|---|---|---|---|
| Homepage | 1.0 | daily | build time |
| Destination detail | 0.9 | weekly | latest of destination/room `updatedAt` |
| Booking flow (`/book/[roomId]`) | 0.8 | weekly | room `updatedAt` |
| Blog posts, attraction guides | 0.7 | monthly | `BlogPost.updatedAt`, guide `lastReviewed` |
| Static pages | 0.5 | monthly | build time |
| Legal pages | 0.3 | yearly | build time |

Search engines treat `priority` and `changefreq` as hints at most. Accurate `lastModified`
matters more, which is why dynamic routes use real edit dates.

---

## 7. Multilingual (English / Bengali)

Current implementation:

- `hreflang="en"`, `hreflang="bn-BD"` and `hreflang="x-default"` on every indexable page via
  `buildMetadata()`. Bengali is always `bn-BD`, never bare `bn`.
- The Bengali alternate is `?lang=bn`. `LanguageContext` reads it on load and renders Bengali
  (without overwriting the visitor's stored preference), and sets `<html lang="bn">`.
- **Blog posts** are rendered in Bengali **on the server** at `?lang=bn` when the post has
  Bengali content. Their `?lang=bn` URL self-canonicalizes and uses `metaTitleBn` /
  `metaDescriptionBn`, so the hreflang pair is fully valid. Posts without Bengali emit no
  `bn-BD` alternate.
- Every public string has a Bengali counterpart (`scripts/check-i18n-parity.ts`), and Bengali
  meta copy is written separately in `bn.ts → seo`.

**Known limitation (all non-blog pages):** Bengali is applied on the client, so the server HTML
at `?lang=bn` is English, and its canonical points to the English URL. Google renders
JavaScript and may index the Bengali render, but an alternate whose canonical points elsewhere
can be ignored, and non-rendering crawlers (most AI crawlers) see English only. For clients
whose Bengali search volume matters, plan the migration below.

---

## 8. Future: server-side Bengali (`/bn/` path routing)

When Bengali organic search becomes a business requirement, move from client-side toggling to
server-rendered locale paths.

**Target URL structure**

| English | Bengali |
|---|---|
| `/` | `/bn` |
| `/faq` | `/bn/faq` |
| `/destinations/coxs-bazar` | `/bn/destinations/coxs-bazar` |

Slugs stay English in both locales (`CONVENTIONS.md` §3).

**Migration steps**

1. Add `next-intl` (the standard App Router i18n library, needed for locale-aware routing and
   server translations). Move `src/app/*` under `src/app/[locale]/` with
   `generateStaticParams` returning `en` and `bn`, and keep `en` unprefixed with
   `localePrefix: "as-needed"`.
2. Convert pages that import `en as t` statically to server translations
   (`getTranslations`), so the Bengali HTML is rendered on the server. Reuse the existing
   `en.ts` / `bn.ts` dictionaries as next-intl messages.
3. Replace `LanguageContext` state with the locale segment. The language switcher becomes a
   link to the other locale's URL.
4. Update `buildMetadata()`: canonical = the locale's own URL, and `languages` = `{ en: "/x",
   "bn-BD": "/bn/x", "x-default": "/x" }`. Set `<html lang>` on the server from the locale.
5. Add every `/bn/*` URL to the sitemap, ideally with `xhtml:link` alternates.
6. 301-redirect legacy `?lang=bn` URLs to their `/bn/*` equivalents in middleware.
7. Move blog Bengali from `?lang=bn` to `/bn/blog/[slug]`, and 301 the old URLs.
8. Re-run `scripts/check-seo-metadata.ts` against both locales and the performance budget.
   Doubling the statically generated pages roughly doubles build time.

**Cost and risk:** this touches every route file. Budget it as its own phase, ship it behind a
feature branch with a full crawl comparison, and monitor Search Console for canonical and
hreflang errors for four weeks after launch.

---

## 9. Per-client launch sequence

1. Fill `brand.config.ts` (`property`, `policies`, `profiles`, `google.placeId`) with verified facts.
2. Replace sample content: amenities list, dining menu, nearby attractions, testimonials, FAQ facts.
3. Build `KEYWORD-MAP.md` for the client.
4. Run the verification commands in `CONVENTIONS.md` §9 against a production build.
5. Complete `LOCAL-SEO-CHECKLIST.md` (NAP consistency, GBP, citations, go-live).
6. Set `NEXT_PUBLIC_ENV=production`, rebuild, and submit the sitemap to Google and Bing.

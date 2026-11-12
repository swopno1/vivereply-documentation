# Organic Search Foundation: Submission Report

**Branch:** `organic-search` (from `main` @ `9731feb`)
**Date:** 2026-09-28
**Scope:** SEO / AEO / GEO infrastructure for the white-label travel scaffold (brief Sections 0–11)

All verification below was run against a **production build** (`NEXT_PUBLIC_ENV=production pnpm build && pnpm start`)
of the sample configuration ("Client Resort & Spa", Cox's Bazar). Raw outputs are quoted, not summarized.

> ⚠️ **Hard dependency not met.** The brief requires homepage Lighthouse mobile ≥ 90 before this phase starts.
> Measured at the start: **80**. The owner chose to proceed and record the gap. Measured at the end: **81**.
> See §5 and `docs/seo/PERFORMANCE-BUDGET.md`.

---

## 1. Sections, files and commits

| # | Section | Commit | Files changed |
|---|---|---|---|
| 0 | Conventions & standards | `b0d6089` | `docs/seo/CONVENTIONS.md`, `scripts/check-i18n-parity.ts` |
| 1 | Structured data foundation | `e73c01f` | `src/lib/structured-data/*` (15 files, replaces `src/lib/structured-data.ts`), `src/lib/reviews.ts`, `src/components/seo/JsonLd.tsx`, `src/app/brand/logo.{png,svg}`, `brand.config.ts` (`property`, `profiles`), `entities.ts`, layout / home / reviews / faq / destination / attraction / how-to-reach / blog pages, `GoogleReviews.tsx`, `api/reviews/google`, `scripts/extract-jsonld.py` (36 files) |
| 2 | AEO: FAQ, direct answers, snippet formats | `8adb6a0` | `src/content/faq.ts`, `src/content/answers.ts`, `DirectAnswer` / `FaqList` / `StepList` / `RoomComparisonTable`, `brand.config.ts` (`policies`), `en.ts` / `bn.ts`, 8 pages, `scripts/check-faq.ts` (19 files) |
| 3 | GEO: freshness, entity authority, citation infrastructure | `7fcaad4` | `LastUpdated`, `PressKitView`, `src/lib/press-kit.ts`, `src/lib/zip.ts`, `src/lib/review-links.ts`, `press-kit/download` route, `feed.xml`, `share-your-stay`, `admin-actions.ts` (revalidation), `nearby-destinations.ts` (17 files) |
| 4 | Sitemap, robots, canonicals, per-route metadata | `cf705d4` | `src/lib/seo/{env,metadata,pages}.ts`, `sitemap.ts`, `robots.ts`, `next.config.ts`, 30 route files / layouts, `BrandFooter`, `docs/DEPLOYMENT.md`, `scripts/check-seo-metadata.ts` (43 files) |
| 5 | Multilingual SEO (hreflang) | `4d37013` | `metadata.ts`, `LanguageContext.tsx`, blog post page, `docs/seo/SEO-STRATEGY.md` |
| 6 | Local SEO & NAP | `9b8a813` | `brand.config.ts`, `contact/layout.tsx`, destination view, `scripts/check-nap.ts`, `docs/seo/LOCAL-SEO-CHECKLIST.md` |
| 7 | Content architecture & internal linking | `60b99e6` | `Breadcrumbs`, destination / attraction / blog / book / experiences pages, footer, `nearby-destinations.ts`, `scripts/check-internal-links.ts` (13 files) |
| — | Fixes found while documenting | `2efefed` | `markdown.ts` (heading demotion), `metadata.ts` (60-char cap), `article.ts`, blog page |
| 8 | Documentation | `55beac6` | `docs/seo/`: AEO-GEO-GUIDE (223 lines), SCHEMA-REFERENCE (588), CONTENT-GUIDE (188), PERFORMANCE-BUDGET (149), KEYWORD-MAP (95), CONVENTIONS (258) |
| 9 | Fixes found during verification | `1df0d6c` | RSS head link, answer lengths, hydration fix (`LanguageContext`), favicon (`icon.tsx`) (9 files) |
| 9 | Fix found in Rich Results Test | `9871b88` | `structured-data/destination.ts` (address parts) |
| 11 | Reporting | *(this commit)* | `ORGANIC-SEARCH-SUBMISSION.md`, `GROWTH-VERIFICATION.md` addendum, `PERFORMANCE-BUDGET.md` final numbers |

**Dependencies added:** none. The press-kit ZIP uses a 90-line STORE-method writer (`src/lib/zip.ts`) instead of a zip library.
**Docs line counts** (minimums from the brief in brackets): CONVENTIONS 258 (100), SEO-STRATEGY 207 (150), AEO-GEO-GUIDE 223 (150),
CONTENT-GUIDE 188 (100), SCHEMA-REFERENCE 588 (200), PERFORMANCE-BUDGET 149 (80), KEYWORD-MAP 95 (60), LOCAL-SEO-CHECKLIST 144 (80).

---

## 2. Rich Results Test results

Run in Google's Rich Results Test (*Code* mode, because localhost isn't reachable by Google). The input was each
page's JSON-LD exactly as served to Googlebot. Full detail and the Schema.org validator results are in the
`GROWTH-VERIFICATION.md` addendum.

| Page | Valid items | Errors | Non-critical issues |
|---|---|---|---|
| Homepage `/` | 5 (Local businesses ×2, Organization ×2, Review snippets ×1) | **0** | 0 |
| `/faq` | 3 (Breadcrumbs, Local businesses, Organization) | **0** | 0 |
| `/destinations/coxs-bazar` | 5 (Breadcrumbs, Local businesses ×2, Organization ×2) | **0** | 1: `postalCode` (optional; not in data model) |
| `/blog/ultimate-coxs-bazar-travel-guide` | 4 (Articles, Breadcrumbs, Local businesses, Organization) | **0** | 1: `author.url` (optional; no author pages) |
| `/reviews` | 9 (incl. Review snippets ×5) | **0** | 0 |
| `/explore-the-area/lawachara-national-park` | 3 | **0** | 0 |

FAQPage is valid (Schema.org validator: 0 errors, 0 warnings, 15 Q&A) but Google no longer lists it as a rich
result for non-government, non-health sites. Every page tested in the Schema.org validator returned 0 errors
and 0 warnings.

---

## 3. Section 9 verification (raw output)

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | `pnpm build` | ✅ | `✓ Compiled successfully`; exit 0 (both `NEXT_PUBLIC_ENV=production` and staging builds) |
| 2 | `pnpm lint` | ✅ | `$ eslint` (no output); exit 0, **0 warnings** |
| 3 | Schema validation | ✅ | §2 |
| 4 | Sitemap | ✅ | Well-formed XML, `urlset` (sitemaps.org 0.9), 40 URLs: home, 16 static, 3 legal, 5 attraction guides, 6 destinations, 8 booking URLs, 1 blog post. Priorities `{0.5:16, 0.8:8, 0.9:6, 0.7:6, 0.3:3, 1.0:1}` |
| 5 | Robots | ✅ | Production: `Allow: /`, `Disallow: /admin/`, `/api/`, `/style-guide`, `/booking/confirmation/`, `Sitemap: https://clientresort.com/sitemap.xml`; `/_next/` not blocked. Staging build: `User-Agent: * / Disallow: /` and `<meta name="robots" content="noindex, nofollow"/>` |
| 6 | Hreflang | ✅ | Homepage head: `hrefLang="en" → https://clientresort.com`, `hrefLang="bn-BD" → https://clientresort.com/?lang=bn`, `hrefLang="x-default" → https://clientresort.com` |
| 7 | FAQ schema = visible | ✅ | `FAQPage mainEntity: 15 questions; strings not visible word-for-word: 0` |
| 8 | Direct answer blocks | ✅ | `/`: "What is Client Resort & Spa?" → "Client Resort & Spa is a Cox's Bazar resort with direct online booking." (13 words + 41). `/how-to-reach`: 12 + 40. `/faq`: 13 + 41. Destination: 15 + 16 (see defect D5). Also present on attraction, `/dining`, `/amenities` |
| 9 | Internal linking | ⚠️ | `Crawled 40 internal URLs … 0 crawl errors · 5 linking-rule misses`. No broken links, redirecting links or orphans. 5 destinations have < 3 attraction guides (D1) |
| 10 | Bengali parity | ✅ | `en.ts keys: 654 · bn.ts keys: 654 · Parity OK` (also type-enforced: `bn: ContentDictionary`) |
| 11 | Alt text | ✅ | `check-seo-metadata.ts` checks every `<img>` on all 40 sitemap URLs: 0 without non-empty alt |
| 12 | Press kit | ✅ | `GET /press-kit/download → application/zip`, 1129 KB, `testzip: OK`: `fact-sheet.md`, `logo/logo.svg`, `logo/logo.png`, 6 photos. `/brand/logo.svg` → `image/svg+xml`, `/brand/logo.png` → `image/png` |
| 13 | Share your stay | ✅ | `https://search.google.com/local/writereview?placeid=ChkI6aeu…`, `https://facebook.com/clientresort/reviews`. No platform homepages |
| 14 | RSS | ✅ | Well-formed XML, `rss version="2.0"`, 1 item with `dc:creator`, `pubDate`, `guid`; `<link rel="alternate" type="application/rss+xml">` in every page head |
| 15 | No dead generators | ✅ | 13/13 exported generators called from routes (e.g. `getTouristAttractionSchema` → `explore-the-area/[slug]/page.tsx`) |
| + | Metadata conventions | ✅ | `check-seo-metadata.ts`: `40 URLs checked · 0 errors · 1 warnings` (the warning is the seed blog post's 101-character excerpt) |
| + | NAP | ✅ | `check-nap.ts`: 6/6 pages OK |
| + | 360px layout | ✅ | 13 pages: `scrollWidth == clientWidth` (no horizontal overflow) |
| + | `?lang=bn` | ✅ | `htmlLang: "bn"`, Bengali FAQ rendered, stored preference untouched, **0 console errors** |

---

## 4. Claims that could not be verified

| Claim | Status | Reason |
|---|---|---|
| Rich Results Test on the **live URL** | ❌ Unverified | No public deployment. Code-mode tests validate the markup but not Google's fetch or render of the live page |
| Sitemap submitted to Google Search Console | ❌ Unverified | Requires the client's GSC property and a production domain (checklist step in `LOCAL-SEO-CHECKLIST.md` §6) |
| HTTP→HTTPS and www→apex single-hop 301s | ❌ Unverified | Implemented as nginx config in `docs/DEPLOYMENT.md` §5.1; needs a server with TLS to test. Trailing slash → 308 **is** verified locally |
| NAP matches GBP, Facebook and Tripadvisor | ❌ Unverified | Sample brand has no real profiles. Manual checklist provided |
| Bengali copy reads naturally | ⚠️ Partially verified | Written natively (not machine-translated) and spot-checked, but not reviewed by a second native speaker |
| Google indexes the client-rendered Bengali at `?lang=bn` | ❌ Unverified | Depends on Google's rendering. Documented limitation (D3) |
| Review data authenticity | ⚠️ | Schema reads the Google review cache, which holds **seeded sample reviews** in local dev. Production data comes from the Places API cron |
| Wikidata IDs | ✅ Verified | All 14 IDs checked against the Wikidata API on 2026-09-28 |

---

## 5. Defects found during verification

Defects that were **fixed** during the phase are listed in the commits (`2efefed`, `1df0d6c`, `9871b88`).
Pre-existing defects fixed along the way: canonical inheritance (≈20 pages canonicalized to `/`), fabricated
Wikidata IDs, hardcoded 4.9/48 ratings, invalid RSS XML, orphan pages, hydration error #418 for Bengali
visitors, missing favicon, missing `/icon.png` logo.

**Open defects:**

| ID | Severity | Defect | Notes |
|---|---|---|---|
| D0 | **High** | Performance gate not met: homepage 81, `/faq` 81, destination 79; LCP 5.1–5.5 s (target 2.5 s); JS ≈ 297 KB (budget 150 KB); fonts 366 KB | Diagnosed causes in `PERFORMANCE-BUDGET.md` §3 (Bengali font on English pages, duplicate Playfair preload). Owner chose to proceed; the perf sprint is paused |
| D1 | Medium | 5 of 6 destinations link to 0 attraction guides (rule: ≥ 3) | Sample data only has guides near Sreemangal. Writing guides for other destinations would mean inventing distances; needs client content |
| D2 | Medium | Sample content contradicts itself geographically: property configured in Cox's Bazar, attraction guides are Sreemangal-area, and their "travel time from resort" values assume a Sreemangal property | Template sample data. Must be replaced per client (`LOCAL-SEO-CHECKLIST.md` §5) |
| D3 | Medium | Non-blog pages render Bengali on the client; the `?lang=bn` canonical points to English | Documented; `/bn/` migration path in `SEO-STRATEGY.md` §8. Blog posts are fully server-rendered and valid |
| D4 | Medium | `/reviews` shows hardcoded sample testimonials labelled "Google Reviews" / "TripAdvisor" / "Verified" | Not marked up (schema uses only the review cache), but still fabricated-looking visible content. Replace or remove per client |
| D5 | Low | Data-driven answer blocks miss length targets: destination "Where is" context 16 words, attraction "What is" answer 17 words | Lengths come from DB/content fields, not code |
| D6 | Low | `/amenities` and `/dining` item lists are hardcoded English (infinity pool, spa, EV charging…) and not derived from `policies` or translated | Pre-existing page content; the new answer blocks use config |
| D7 | Low | Footer links (22, including the 4 added) are < 44 px tall on mobile | Pre-existing footer style; changing it is design work |
| D8 | Low | Destination seed data uses real hotel names (e.g. "Sayeman Beach Resort & Spa") as sample properties, now in schema as the site's lodging | Seed-data issue; replace per client |
| D9 | Low | Rich Results non-critical: destination `postalCode`, Article `author.url` | No data source for either |
| D10 | Low | Sitemap `lastModified` for static pages is build time | No per-page edit date exists at runtime (documented in `SEO-STRATEGY.md` §6) |

**Local environment note:** to verify Article, RSS and the blog hreflang pair, one published post
(`ultimate-coxs-bazar-travel-guide`, from `src/content/blog/`) plus a "Destination Guides" category were
**inserted into the local `prisma/dev.db`**. Nothing was deleted. Remove it with
`DELETE FROM BlogPost WHERE slug='ultimate-coxs-bazar-travel-guide';` if unwanted.

---

## 6. Honest assessment

The organic-search infrastructure is in good shape:
- every public route has unique, convention-compliant metadata with self-referencing canonicals, hreflang and environment-gated robots;
- every schema generator is live and validates with **0 errors** in both Google's Rich Results Test and the Schema.org validator;
- FAQ, direct-answer, entity, freshness and citation systems are built from single sources of truth (`brand.config.ts`, `src/content/`, the database), so they cannot drift from what the page shows;
- the verification is automated in five scripts a future deployment can re-run.

This phase also fixed several serious pre-existing problems that would have hurt a real launch: site-wide
canonicalization to the homepage, fabricated Wikidata identities, hardcoded ratings, and an invalid RSS feed.

The branch is **not ready to merge as a "complete" phase**, for two reasons:
- **The brief's hard dependency is unmet.** Mobile Lighthouse is 81, not ≥ 90, and LCP is about 2× the target.
- **Some success criteria rely on sample content** (D1, D2, D4) and can only be met with a real client's data.

**Recommendation:** merge the infrastructure once the owner accepts D0–D4 as known gaps. Then resume the
performance sprint, whose diagnosed font fixes are the most likely route to ≥ 90. After that, run the per-client
checklist (`LOCAL-SEO-CHECKLIST.md` §6) before any production launch.

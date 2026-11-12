# AEO & GEO Guide

**AEO (Answer Engine Optimization)** means being the direct answer: featured snippets, "People
also ask", voice assistants and FAQ results.
**GEO (Generative Engine Optimization)** means being *cited* inside AI-generated answers from
Google AI Overviews, ChatGPT search, Perplexity, Copilot and Claude.

Both reward the same things: a clear answer near the top, facts stated specifically, entities
named consistently, recent dates, and corroboration from other sites. This guide covers how
the scaffold implements each one and what editors must keep doing.

`CONTENT-GUIDE.md` covers general writing rules. `SCHEMA-REFERENCE.md` covers the markup.

---

## 1. How answer engines read a page

1. **Retrieval works on passages, not pages.** A crawler splits the page into chunks (roughly a
   heading plus its paragraphs) and scores each chunk against the question.
2. **Extraction takes the most answer-shaped sentence**: short, declarative, and containing the
   subject and the fact.
3. **Citation goes to the source whose passage best supports the generated sentence**, weighted
   by trust signals: consistent entity data, structured data, freshness, and whether other
   sources agree.

So every important fact should sit in a **self-contained passage** that starts with a
**direct answer**, uses the **canonical entity name**, and is **backed by markup** and a date.

---

## 2. Direct answer blocks (AEO)

Component: `src/components/seo/DirectAnswer.tsx`. Content: `src/content/en.ts` / `bn.ts →
answers.*`.

```html
<section data-speakable="answer">
  <h2>How do I get to Client Resort & Spa?</h2>
  <p><strong>Fly from Dhaka to Cox's Bazar Airport, then take a short transfer to Client Resort & Spa.</strong>
     Overnight coaches and intercity trains also run from Dhaka to Cox's Bazar. Our airport shuttle
     meets your flight if you book it 24 hours ahead…</p>
</section>
```

| Element | Rule | Why |
|---|---|---|
| `<h2>` | The question, phrased the way people ask it, naming the property or place | Matches the query and voice phrasing |
| `<strong>` | 10–15 words and a complete answer on its own | The extractable sentence |
| Context | 40–60 words, 2–3 sentences, specific facts | The citable passage |
| `data-speakable="answer"` | Always present | Selector for the page's Speakable schema |

Placement: directly after the page `<h1>` and intro, above the fold on mobile where the
layout allows.

Blocks in the scaffold:

| Page | Blocks |
|---|---|
| `/` | What is [Property]? |
| `/faq` | What is [Property]? plus 15 FAQ answers |
| `/how-to-reach` | How do I get to [Property]? plus a numbered `<ol>` of steps from Dhaka |
| `/destinations/[slug]` | Where is [Destination]? What is there to do at [Destination]? plus a room comparison `<table>` |
| `/explore-the-area/[slug]` | What is [Attraction]? How far is [Attraction] from [Property]? plus a key-facts `<dl>` |
| `/dining` | What food is available at [Property]? |
| `/amenities` | What facilities does [Property] have? (the list is generated from `policies`) |
| `/blog/[slug]` | The excerpt, in `<strong>`, answers the headline |

---

## 3. FAQ system (AEO)

`src/content/faq.ts` generates 15 FAQs across six categories (Booking, Check-in, Payment,
Cancellation, Amenities, Nearby). They cover check-in/out, early check-in/late check-out,
parking, pets, breakfast, cancellation, payment methods, Wi-Fi, accessibility, children and
extra beds, shuttle, and smoking.

Rules:

- **The answer is generated from `brand.config.ts → policies`.** Never edit an answer's facts in
  `faq.ts`. Change the policy, and the English answer, the Bengali answer, the amenity schema
  and the `/amenities` answer block all update together.
- The first sentence answers the question: "Check-in is from 2:00 PM…", "No, pets are not allowed…".
- English answers are 40–60 words (`scripts/check-faq.ts`).
- The FAQPage JSON-LD and the visible list read the **same array**, so they match word for word.
- Voice phrasing: short declarative sentences, no parentheses or abbreviations a speech engine
  would stumble over, and the property name in the question.

---

## 4. Entity authority (GEO)

AI systems resolve "Lawachara", "Lawachara NP" and "the park" into one entity only when the
signals agree. The registry at `src/content/entities.ts` is the single source.

For each place it records:

| Field | Example | Used for |
|---|---|---|
| `nameEn` | Lawachara National Park | Every English mention |
| `nameBn` | লাউয়াছড়া জাতীয় উদ্যান | Every Bengali mention |
| `wikidataId` | Q3350641 | `sameAs` on TouristAttraction schema |
| `referenceUrl` | en.wikipedia.org/wiki/Lawachara_National_Park | Visible "Sources & references" link |
| `officialUrl` | (only when listed on Wikidata as P856) | Visible link + `sameAs` |

**Verification rule:** every Wikidata ID, Bengali label and reference URL was pulled from the
Wikidata API on 2026-09-28, not typed from memory. The previous scaffold's IDs were
fabricated: `Q115801314`, used as the resort's `sameAs`, is an Italian 14th-century composer.
Before adding an entity:

```bash
curl -s "https://www.wikidata.org/w/api.php?action=wbsearchentities&search=Inani%20Beach&language=en&format=json"
curl -s "https://www.wikidata.org/w/api.php?action=wbgetentities&ids=Q6013546&props=labels|sitelinks/urls&languages=en|bn&sitefilter=enwiki&format=json"
```

If no item exists, leave `wikidataId` undefined. An absent `sameAs` is harmless; a wrong one
teaches AI systems a false identity.

The **property itself** is linked through `brand.config.ts → socialLinks` and `profiles`
(Google Business Profile, Facebook, Instagram, Tripadvisor, Wikidata when one exists). Those
URLs become the Organization and LocalBusiness `sameAs`.

Writing rules:

- Use the full canonical name on first mention in every section, not only the first in the page,
  because each section may be retrieved alone.
- Don't vary names for style. "Cox's Bazar", not "Coxsbazar" or "CXB town".
- State relationships explicitly: "Hum Hum Waterfall is in Rajkandi Reserve Forest, near
  Sreemangal", not "it's nearby".

---

## 5. Freshness (GEO)

Answer engines favour recent sources, and a page that looks unmaintained is cited less.

| Signal | Implementation |
|---|---|
| Visible "Last updated" date | `LastUpdated` component on destination pages (latest destination/room edit), attraction guides (`lastReviewed`) and blog posts (when edited after publishing) |
| `dateModified` | Article schema from `BlogPost.updatedAt` |
| Regeneration | `revalidate = 86400` on blog and destination detail; room edits revalidate destination pages immediately |
| Sitemap `lastModified` | Real edit dates for destinations, rooms, posts and guides |

Editorial cadence: review each destination page, attraction guide and top-10 blog post **at
least every 13 weeks**. Update a price, seasonal note or fact, and set `lastReviewed` for
guides. Never bump a date without changing or re-verifying content; a false freshness signal is a
fabricated claim.

---

## 6. Multimodal signals

- **Alt text** names the place or property, the location and the subject:
  `Sayeman Beach Resort & Spa — Deluxe Sea View room, Marine Drive, Cox's Bazar`.
- **ImageObject** schema for hero images (destination and attraction pages) with a caption and description.
- **File names** are descriptive and hyphenated when clients upload their own photography:
  `client-resort-infinity-pool-sunset.webp`, not `IMG_4521.jpg`. The sample images are remote
  Unsplash URLs and can't be renamed; replacing them is part of client onboarding.

---

## 7. Citation readiness (GEO)

Much of what AI answers cite about a hotel comes from **third parties**: reviews, travel
writers, directories. The scaffold makes being cited easy.

### `/press-kit`

- Short and long property descriptions (English and Bengali), generated from config and live data.
- A key-facts `<dl>`: official name, address, GPS, capacity, price range, check-in/out,
  amenities, press contact. Capacity and price range come from the database.
- Logos: `/brand/logo.svg` and `/brand/logo.png` (512×512).
- Photos with captions and credits derived from the image host. Sample images are credited
  "Unsplash (sample image — replace with licensed property photography)".
- **`/press-kit/download`**: one ZIP with `fact-sheet.md` (bilingual), the logos and the photos.

### `/share-your-stay`

Deep links to **this property's** review forms only:

| Platform | URL source | Shown when |
|---|---|---|
| Google | `https://search.google.com/local/writereview?placeid=<google.placeId>` | Place ID configured |
| Facebook | `<socialLinks.facebook>/reviews` | Facebook Page configured |
| Tripadvisor | `profiles.tripadvisorReview` | Review URL configured |

No platform homepage is ever linked. If nothing is configured, the page says so rather than
showing dead buttons.

### `/feed.xml`

A valid RSS 2.0 feed of the 50 latest published posts: XML-escaped, `dc:creator` for authors,
categories, `lastBuildDate`, `atom:link rel="self"`, and `<link rel="alternate">` in every page
head. It lets aggregators and AI crawlers discover new posts without crawling the blog.

### `/llms.txt`

A static Markdown summary (`public/llms.txt`) pointing AI assistants and research tools at the
booking, property-information, policy and contact pages, so they don't have to crawl the whole
site to answer a guest's question. It is a **per-client template**, same as
`docs/seo/KEYWORD-MAP.md`: regenerate it with the client's real brand name, domain and page set
before a client deployment goes live. Not auto-generated — there is no live data in it to drift.

---

## 8. Speakable

The homepage and `/faq` carry a `WebPage` with `speakable.cssSelector = ["h1",
'[data-speakable="answer"]']`, pointing voice assistants at the heading and the direct answers.
Speakable is a WebPage property. Emitting a bare `SpeakableSpecification` node (as the
previous scaffold did) is invalid.

---

## 9. What not to do

- ❌ Stuff keywords into answers. Answer engines extract sentences, and a stuffed sentence is not an answer.
- ❌ Hide text for bots, or show different FAQ text in the schema than on the page.
- ❌ Mark up testimonials that are not real reviews. The sample `directTestimonials` on `/reviews` are deliberately **not** marked up.
- ❌ Guess Wikidata IDs, distances, opening hours or prices. Omit what you can't verify.
- ❌ Bump dates without changing content.

---

## 10. Monthly GEO check

1. Ask ChatGPT (search on), Perplexity, Gemini and Claude:
   "Where is [Property]?", "How do I get to [Property] from Dhaka?", "What time is check-in at
   [Property]?", "Best resorts in [Location]", and the top attraction question.
2. Record whether the site is cited, which page, and whether the facts are right.
3. Where a wrong fact appears, find its source (often an outdated directory listing) and fix
   it there. See `LOCAL-SEO-CHECKLIST.md` §4.

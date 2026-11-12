# Content Guide

How to write and structure page content so that people, search engines and answer engines
can all use it. `CONVENTIONS.md` covers the technical rules (metadata, URLs, robots).
This guide covers the words on the page.

Everyone who edits `src/content/`, blog posts, destination descriptions or attraction guides
should read it.

---

## 1. Heading Structure

| Level | Use | Example |
|---|---|---|
| `<h1>` | The page's subject. Exactly one per page. | "How to Reach Client Resort & Spa" |
| `<h2>` | A section, ideally phrased as a question the section answers. | "Where is Sayeman Beach Resort & Spa?" |
| `<h3>` | A subsection or a single FAQ question. | "Can I check in early or check out late?" |

Rules:

1. **Never skip a level.** Card titles in a grid directly under an `<h1>` must be `<h2>`, or
   there must be an `<h2>` above them. The homepage direct answer block provides that `<h2>`
   for the feature cards.
2. **Describe the content; don't decorate it.** "Location" tells a machine nothing.
   "Where is Client Resort & Spa located?" matches the query a traveller types or speaks.
3. **Put the place name in the heading** whenever a heading refers to one, so a heading
   read on its own (in a snippet or an AI answer) still says what it's about.
4. **Badges, eyebrows and kickers are not headings.** Use `<span>` or `<p>`.
5. Shared components (header, footer, chat widget, cookie banner) never render `<h1>`.

---

## 2. The Direct Answer Pattern

Every key page opens with a direct answer block, rendered by `src/components/seo/DirectAnswer.tsx`:

```html
<section data-speakable="answer">
  <h2>What is Client Resort & Spa?</h2>
  <p><strong>Client Resort & Spa is a Cox's Bazar resort with rooms you can book directly online.</strong>
     Guests pay securely with bKash, Nagad, BanglaQR or cards and receive instant confirmation…</p>
</section>
```

| Part | Length | Purpose |
|---|---|---|
| `<h2>` question | One natural-language question | Matches the query |
| `<strong>` answer | **10–15 words** | The sentence answer engines extract |
| Context | **40–60 words**, 2–3 sentences | The passage answer engines cite |

Where the blocks live:

| Page | Question(s) | Content keys |
|---|---|---|
| Homepage | What is [Property]? | `answers.home*` |
| `/how-to-reach` | How do I get to [Property]? (plus a numbered `<ol>` of steps) | `answers.reach*` |
| `/faq` | What is [Property]?, then every FAQ | `answers.home*`, `src/content/faq.ts` |
| `/destinations/[slug]` | Where is [Destination]? What is there to do at [Destination]? | `answers.where*`, `answers.todo*` |
| `/explore-the-area/[slug]` | What is [Attraction]? How far is [Attraction] from [Property]? | `answers.attraction*` |
| `/blog/[slug]` | The excerpt, in `<strong>`, answers the headline | `BlogPost.excerpt` |
| `/dining` | What food is available at [Property]? | `answers.dining*` |
| `/amenities` | What facilities does [Property] have? | `answers.amenities*` |

Writing the `<strong>` sentence:

- ✅ "Check-in is from 2:00 PM and check-out is by 11:00 AM."
- ✅ "Fly from Dhaka to Cox's Bazar Airport, then take a short transfer."
- ❌ "We are delighted to welcome guests throughout the day." (it doesn't answer anything)
- ❌ "Please contact our front desk for check-in information." (it defers the answer)

---

## 3. Paragraphs

- **Under 60 words.** AI retrieval systems split pages into passages, and a long paragraph
  is split at arbitrary points.
- **One idea per paragraph.** Each paragraph should make sense quoted on its own, with no
  "as mentioned above" and no bare "it".
- **Lead with the substance.** No throat-clearing introductions ("Nestled in the heart of…").
- **Be specific.** "12 km (20 minutes by car) from the resort" beats "close to the resort".
  Numbers, times, prices and names are what get cited.
- **Use short declarative sentences** in FAQ answers and anything voice assistants read aloud.

---

## 4. FAQ Format

The FAQ lives in `src/content/faq.ts` and is **generated from `brand.config.ts`** (`property`,
`policies`, `payments`). To change a policy, change the config value. The English answer, the
Bengali answer and the FAQPage schema all update together.

Every FAQ item:

1. Belongs to one category: Booking, Check-in, Payment, Cancellation, Amenities or Nearby.
2. Has a question phrased the way a guest would ask it, naming the property where natural.
3. Has an English answer of **40–60 words** that **starts with the answer**:
   - ✅ "Check-in is from 2:00 PM and check-out is by 11:00 AM. Please bring…"
   - ❌ "Please contact us regarding check-in times."
4. Has a Bengali question and answer written natively, not machine-translated.
5. Renders visibly on `/faq`, word for word the same as the schema. `FaqList` and the
   FAQPage schema read the same `FAQ_ITEMS` array, so never edit one without the other.

Check: `pnpm exec tsx scripts/check-faq.ts` fails if an English answer falls outside 40–60
words or a Bengali field is empty.

Other pages with visible Q&A (destination or attraction answer blocks) do not emit FAQPage
schema. Google only shows FAQ rich results for a limited set of sites, and one canonical FAQ
page avoids competing markup.

---

## 5. Featured-Snippet Formats

| Content type | Markup | Where it is used |
|---|---|---|
| Comparison (room types, prices) | `<table>` with `<th scope>` | `RoomComparisonTable` on destination pages |
| Steps ("how to reach from Dhaka") | `<ol>` | `StepList` on `/how-to-reach` |
| Fact/value pairs | `<dl>` / `<dt>` / `<dd>` | Key-facts strip on attraction pages |
| Question → answer | `<h2>`/`<h3>` question + `<p>` answer | `DirectAnswer`, `FaqList` |

Don't simulate these with styled `<div>`s. The semantic element is what search engines read.

---

## 6. Entity Names

- Refer to every place by its canonical name from `src/content/entities.ts`: "Lawachara
  National Park", never "the park" or "Lawachara NP".
- Use the Bengali spelling from the same file (`nameBn`), for example লাউয়াছড়া জাতীয় উদ্যান.
- For a new place, add it to `entities.ts` first, with its Wikidata ID verified through the API.

---

## 7. Image Alt Text

Alt text names **the place or property, the location, and the subject**:

- ✅ `"Sayeman Beach Resort & Spa — Deluxe Sea View room, Marine Drive, Cox's Bazar"`
- ✅ `"Lawachara National Park, Sreemangal — hoolock gibbon trail through the rainforest"`
- ❌ `"image"`, `"hero"`, `"IMG_4521"`, or an empty `alt` on a content image

Only purely decorative images (background textures, dividers) get `alt=""`.
File names follow the same idea: `client-resort-deluxe-sea-view-room.webp`, not `IMG_4521.jpg`.

---

## 8. Internal Linking

| Page type | Must link to |
|---|---|
| Homepage | Every top-level section (Destinations, Explore, Blog, Experiences, Offers, How to Reach, FAQ, Reviews, About, Contact), via the header and footer |
| Destination detail | At least 3 nearby attraction guides (attractions whose `nearDestination` is this slug), How to Reach, booking for each room |
| Attraction detail | Its parent destination listing, How to Reach, at least 2 other attractions |
| Blog post | At least 2 destinations or experiences, plus related posts |
| Experience | The destinations listing |
| Every nested page | Its parent, through the visible `<Breadcrumbs>` trail. Pass the same `crumbs` array to `getBreadcrumbSchema()` so BreadcrumbList matches it |

Link text describes the target ("Lawachara National Park guide"), not "click here".

---

## 9. Freshness

- Destination and attraction pages show a visible **"Last updated"** date.
- Blog posts show the published date, and the updated date when it differs.
- Article schema carries `dateModified` from `BlogPost.updatedAt`.
- Blog and destination routes revalidate every 24 hours (`revalidate = 86400`).
- Review each destination page and top blog post **at least once every 13 weeks**. Update a
  fact, price or seasonal note, and the date moves with it.

---

## 10. Bengali Content

- Every public string in `src/content/en.ts` has a counterpart in `bn.ts` (`scripts/check-i18n-parity.ts`).
- Write Bengali for Bangladeshi readers, not as a word-for-word translation: "দুপুর ২টা"
  rather than "২:০০ PM", and "হোয়াটসঅ্যাপে টেবিল বুক করুন" rather than a literal calque.
- Show numbers in Bengali digits (`formatNumber(n, "bn")`) and currency with
  `Intl.NumberFormat("bn-BD", { style: "currency", currency: "BDT" })`.
- Brand names and proper nouns with no established Bengali form stay in Latin script.

Check: `pnpm exec tsx scripts/check-internal-links.ts` crawls from `/` and reports broken links,
redirecting links, orphan pages and each rule above.

Body content from the CMS may start with `# Title`. The blog renderer demotes body headings one
level (`renderAndSanitizeMarkdown(…, { demoteHeadings: true })`) so the page keeps a single
`<h1>`. Still, write posts starting at `##`.

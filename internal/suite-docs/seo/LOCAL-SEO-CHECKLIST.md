# Local SEO Checklist

A resort competes locally first. People search "resort in Cox's Bazar", "hotel near Inani
Beach" or "Sajek cottage booking", and those results come from Google's local index: the map pack,
Google Hotels and the Business Profile. Answer engines confirm a property's identity the same
way, by matching the website against its Google Business Profile, Facebook page, Tripadvisor
listing and directory citations.

Work through this checklist for every client **before** setting `NEXT_PUBLIC_ENV=production`,
then repeat the audit sections quarterly.

---

## 1. Canonical NAP (Name, Address, Phone)

The canonical NAP lives in **one place**: `src/components/brand/brand.config.ts`.

| Field | Config key | Where it renders |
|---|---|---|
| Name | `name` | Header logo, footer, titles, Organization + LocalBusiness JSON-LD |
| Address | `PROPERTY_ADDRESS` → `property.address` | Footer, `/contact`, `/how-to-reach` map, press kit, PostalAddress JSON-LD |
| One-line address | `contact.address` (derived with `formatPropertyAddress()`) | Footer, `/contact`, press kit |
| Phone | `contact.phone` | Footer, `/contact`, destination sidebar, floating call button, FAQ, JSON-LD `telephone` |
| WhatsApp | `contact.whatsapp` | Floating widget, dining reservations |
| Geo | `property.geo` | JSON-LD `geo`, `/how-to-reach` |

- [ ] Name is written **exactly** as on the Google Business Profile, including "&" vs "and", "Resort & Spa" vs "Resort and Spa", and capitalisation.
- [ ] Street address, locality and postcode match the GBP address character for character.
- [ ] Phone matches the GBP primary phone. Use the same number everywhere; don't mix a hotline on the site with a mobile on GBP.
- [ ] `property.geo` coordinates are the GBP pin, not the town centre. Right-click the pin in Google Maps → copy coordinates.
- [ ] `property.mapUrl` is the GBP share link (`https://maps.app.goo.gl/…` or `https://maps.google.com/?cid=…`).
- [ ] No other phone number or address is hardcoded anywhere. Run the automated check:

```bash
pnpm build && pnpm start
pnpm exec tsx scripts/check-nap.ts
```

It fails if a page shows an unexpected Bangladeshi phone number, or if the LocalBusiness or
Organization JSON-LD name, phone or address differs from `brand.config.ts`.

---

## 2. Google Business Profile (GBP)

### 2.1 Profile setup

- [ ] The profile is claimed and verified by the property owner. The agency is a **manager**, not the owner.
- [ ] Primary category: **Resort hotel** (or **Hotel** for a city property). Add secondary categories only if they are true (e.g. "Restaurant" for a public restaurant).
- [ ] Hotel attributes are filled in: check-in/out times, Wi-Fi, parking, pool, breakfast, accessibility, pets. They must match `brand.config.ts → policies` and `/faq`.
- [ ] Opening hours: "Open 24 hours" when the front desk is 24/7 (matches `property.openingHours`).
- [ ] Website URL is the canonical `https://[domain]` (no `www`, no UTM on the main link).
- [ ] Booking link is `https://[domain]/destinations` or the specific room page.
- [ ] Description (up to 750 characters) reuses the press-kit long description (`/press-kit`).
- [ ] Photos: at least 20 real photos (exterior, rooms, bathroom, dining, views, staff), each with a descriptive file name before upload.
- [ ] Q&A: seed the profile with the top 5 questions from `/faq`, answered with the same wording.

### 2.2 Connecting GBP to the site

- [ ] Find the **Place ID** with Google's Place ID Finder and set `NEXT_PUBLIC_GOOGLE_PLACE_ID` (read by `brand.config.ts → google.placeId`).
- [ ] Set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (or `GOOGLE_MAPS_API_KEY`) with the Places API enabled, and schedule the `/api/cron/fetch-google-reviews` cron. Reviews are cached in `GoogleReviewCache`.
- [ ] Confirm the homepage shows the aggregate rating, review count and latest-reviews carousel. The same numbers appear in the homepage `AggregateRating` JSON-LD.
- [ ] Confirm "Write a Review" on the homepage, `/reviews` and `/share-your-stay` opens `https://search.google.com/local/writereview?placeid=<PLACE_ID>` for **this** property.
- [ ] Set `profiles.googleBusinessProfile` to the public Maps URL so it appears in `sameAs`.

### 2.3 Ongoing

- [ ] Reply to every Google review within 48 hours, in the reviewer's language.
- [ ] Post a GBP update (offer, event or seasonal note) at least twice a month.
- [ ] Update holiday hours before Eid, Pohela Boishakh and Victory Day closures or changes.

---

## 3. Other profiles (entity fingerprint)

Every profile you set in `brand.config.ts` appears in the Organization and LocalBusiness
`sameAs`. Set **only** URLs of this property's own pages.

- [ ] `socialLinks.facebook`: the Facebook **Page** URL (not a personal profile). Facebook reviews/recommendations are enabled on the page.
- [ ] `socialLinks.instagram`, `socialLinks.youtube`, if they exist and are active.
- [ ] `profiles.tripadvisor`: the Tripadvisor listing URL. If the property is not listed, claim or create it at Tripadvisor Management Center first.
- [ ] `profiles.tripadvisorReview`: the listing's direct "Write a review" URL (enables the Tripadvisor card on `/share-your-stay`).
- [ ] `profiles.wikidataId`: **only** when a Wikidata item for the property exists. Verify it:
  `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=<ID>&props=labels`.
  Never create or guess one.
- [ ] Name, address and phone on each profile match section 1 exactly.

---

## 4. Citation building (Bangladesh + travel)

Consistent listings on trusted directories corroborate the NAP. Record each one in the client's
tracking sheet with URL, date and login owner.

| Priority | Platform | Notes |
|---|---|---|
| High | Google Business Profile | Section 2 |
| High | Facebook Page | Section 3 |
| High | Tripadvisor | Hotel listing + owner response |
| High | Booking.com / Agoda / Expedia | If the property sells through OTAs, their listing name and address must match |
| Medium | Bing Places for Business | Import from GBP |
| Medium | Apple Business Connect | Apple Maps listing |
| Medium | Bangladesh tourism directories and the local district tourism pages | Where available |
| Low | Local news or travel blog features | Earned via the `/press-kit` |

- [ ] Every citation uses the canonical NAP from section 1.
- [ ] Every citation links to the canonical `https://[domain]`.
- [ ] Old or duplicate listings (previous owner, old phone) are corrected or merged.

---

## 5. On-site local content

- [ ] Homepage direct answer names the town/region ("… is a Cox's Bazar resort …").
- [ ] `/how-to-reach` names the real transit hubs: airport, bus terminal, railway station. Canonical names go in `src/content/entities.ts`.
- [ ] Every destination page names and links at least 3 nearby attractions.
- [ ] Attraction guides state a specific distance and travel time from the property (verified by driving or mapping it).
- [ ] Blog posts mention real local landmarks, dishes, festivals and seasons by name.
- [ ] Sample content (the nearby-attraction set, testimonials, dining menu, amenities list) has been **replaced** with the client's real information.

---

## 6. Go-live gate

Run these on the production build (`NEXT_PUBLIC_ENV=production pnpm build && pnpm start`):

- [ ] `pnpm exec tsx scripts/check-seo-metadata.ts`: 0 errors.
- [ ] `pnpm exec tsx scripts/check-nap.ts`: all OK.
- [ ] `pnpm exec tsx scripts/check-i18n-parity.ts` and `scripts/check-faq.ts`: OK.
- [ ] Rich Results Test on the homepage, `/faq`, one destination and one blog post: 0 errors.
- [ ] `/robots.txt` shows the production rules and the sitemap line, **not** `Disallow: /`.
- [ ] Deploy with `NEXT_PUBLIC_ENV=production`; check `<meta name="robots" content="index, follow">` on the live homepage.
- [ ] nginx single-hop redirects verified (`DEPLOYMENT.md` §5.1).
- [ ] Submit `https://[domain]/sitemap.xml` to Google Search Console and Bing Webmaster Tools.
- [ ] Request indexing for the homepage, `/faq` and each destination in Search Console.

---

## 7. Quarterly audit

- [ ] Re-run section 1 and section 6 checks.
- [ ] Search the property name and phone number on Google and fix any listing with an outdated NAP.
- [ ] Review GBP insights: calls, direction requests, website clicks.
- [ ] Ask the top 10 guest questions to ChatGPT, Perplexity, Gemini and Claude; note which sources they cite and fix any wrong facts at the source.

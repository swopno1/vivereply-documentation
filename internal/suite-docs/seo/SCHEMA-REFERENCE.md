# Schema Reference

Every JSON-LD type the scaffold emits: where it renders, which generator builds it, where the
data comes from, and a complete example. The examples are **actual output** captured from a
production build of the sample configuration, trimmed only where lists repeat (marked).

Generators live in `src/lib/structured-data/`, one file per type, and are re-exported from
`index.ts`. `<JsonLd data={graph(...)} />` (`src/components/seo/JsonLd.tsx`) renders them.

---

## 1. Rules

1. **One `@graph` per page section.** Related nodes share a document and reference each other by `@id`.
2. **Stable `@id`s** (from `SCHEMA_IDS` in `shared.ts`):

   | Entity | `@id` |
   |---|---|
   | Organization | `https://[domain]/#organization` |
   | WebSite | `https://[domain]/#website` |
   | The property (Resort/Hotel/LodgingBusiness) | `https://[domain]/#lodging` |
   | Logo | `https://[domain]/#logo` |
   | Destination lodging | `https://[domain]/destinations/[slug]#lodging` |
   | Hotel room | `https://[domain]/destinations/[slug]#room-[roomId]` |
   | Attraction | `https://[domain]/explore-the-area/[slug]#attraction` |
   | Article | `https://[domain]/blog/[slug]#article` |
   | WebPage / Breadcrumb / FAQ / Image | `[page URL]#webpage`, `#breadcrumb`, `#faq`, `#image-[key]` |

3. **Only real data.** Values come from `brand.config.ts`, `src/content/` or the database.
   Unknown values are **omitted** (`compact()` strips `undefined` and empty arrays), never filled with placeholders.
4. **Markup matches the page.** FAQ text, reviews and ratings in JSON-LD are built from the same arrays the page renders.
5. **No dead generators.** Every export in `index.ts` is called from at least one route (§16).
6. **Safe serialization.** `serializeJsonLd()` escapes `<` so CMS text can't close the `<script>` element.

## 2. Inventory

| Type | Generator | Renders on | Data source |
|---|---|---|---|
| Organization | `getOrganizationSchema()` | Root layout (every page) | `brand.config.ts` |
| WebSite + SearchAction | `getWebSiteSchema()` | Root layout (every page) | `brand.config.ts`, `/blog?search=` |
| Resort / Hotel / LodgingBusiness | `getLodgingBusinessSchema()` | `/`, `/contact`, `/reviews` | `brand.config.ts` (`property`, `policies`, `profiles`) |
| AggregateRating | `getAggregateRatingSchema()` | `/`, `/reviews` (inside the lodging node) | `GoogleReviewCache` |
| Review | `getReviewSchema()` | `/reviews` (inside the lodging node) | `GoogleReviewCache` |
| WebPage + Speakable | `getSpeakableWebPageSchema()` | `/`, `/faq` | `en.ts` |
| Destination lodging + HotelRoom + Offer | `getDestinationLodgingGraph()` | `/destinations/[slug]` | `Destination`, `Room` |
| ImageObject | `getImageObjectSchema()` | `/destinations/[slug]`, `/explore-the-area/[slug]` | Hero image |
| Place + GeoCoordinates | `getPropertyPlaceSchema()` | `/how-to-reach` | `brand.config.ts` |
| TouristAttraction | `getTouristAttractionSchema()` | `/explore-the-area/[slug]` | `nearby-destinations.ts`, `entities.ts` |
| FAQPage | `getFAQPageSchema()` | `/faq` | `src/content/faq.ts` |
| HowTo | `getHowToSchema()` | `/how-to-reach` | `src/content/answers.ts` (`reachStep1`–`4`) |
| Article | `getArticleSchema()` | `/blog/[slug]` | `BlogPost` |
| BreadcrumbList | `getBreadcrumbSchema()` | Every nested route, `/faq`, `/how-to-reach`, `/contact` | The page's `crumbs` array |

---

## 3. Organization

Rendered once per page by `src/app/layout.tsx`. `sameAs` lists social profiles, the Google
Business Profile, Tripadvisor and Wikidata, **only those configured**.

```json
{
  "@type": "Organization",
  "@id": "https://clientresort.com/#organization",
  "name": "Client Resort & Spa",
  "url": "https://clientresort.com",
  "logo": {
    "@type": "ImageObject",
    "@id": "https://clientresort.com/#logo",
    "url": "https://clientresort.com/brand/logo.png",
    "contentUrl": "https://clientresort.com/brand/logo.png",
    "width": 512,
    "height": 512,
    "caption": "Client Resort Logo"
  },
  "image": "https://clientresort.com/opengraph-image",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Resort Road, Destination Zone",
    "addressLocality": "Cox's Bazar",
    "addressRegion": "Chattogram Division",
    "postalCode": "4700",
    "addressCountry": "BD"
  },
  "email": "reservations@client.com",
  "telephone": "+880 1700-000000",
  "sameAs": [
    "https://facebook.com/clientresort",
    "https://instagram.com/clientresort",
    "https://youtube.com/clientresort"
  ]
}
```

## 4. WebSite (with SearchAction)

The `SearchAction` targets the blog's real full-text search. Google retired the sitelinks
search box in 2024, but the node still identifies the site and its publisher.

```json
{
  "@type": "WebSite",
  "@id": "https://clientresort.com/#website",
  "name": "Client Resort & Spa",
  "url": "https://clientresort.com",
  "inLanguage": [
    "en",
    "bn-BD"
  ],
  "publisher": {
    "@id": "https://clientresort.com/#organization"
  },
  "potentialAction": {
    "@type": "SearchAction",
    "target": {
      "@type": "EntryPoint",
      "urlTemplate": "https://clientresort.com/blog?search={search_term_string}"
    },
    "query-input": "required name=search_term_string"
  }
}
```

## 5. Resort / Hotel / LodgingBusiness (the property)

`@type` comes from `brand.property.schemaType`. All three are LocalBusiness subtypes, so this
node also serves as the LocalBusiness markup (address, geo, telephone, openingHours,
priceRange). `amenityFeature` is derived from `brand.policies`, the same facts the FAQ states.
`aggregateRating` appears only when the Google review cache has data.

```json
{
  "@type": "Resort",
  "@id": "https://clientresort.com/#lodging",
  "name": "Client Resort & Spa",
  "description": "Your Serene Escape in Bangladesh",
  "url": "https://clientresort.com",
  "image": "https://clientresort.com/opengraph-image",
  "logo": {
    "@id": "https://clientresort.com/#logo"
  },
  "parentOrganization": {
    "@id": "https://clientresort.com/#organization"
  },
  "telephone": "+880 1700-000000",
  "email": "reservations@client.com",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Resort Road, Destination Zone",
    "addressLocality": "Cox's Bazar",
    "addressRegion": "Chattogram Division",
    "postalCode": "4700",
    "addressCountry": "BD"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 21.4272,
    "longitude": 92.0058
  },
  "priceRange": "৳৳৳",
  "currenciesAccepted": "BDT",
  "openingHours": "Mo-Su 00:00-23:59",
  "checkinTime": "14:00",
  "checkoutTime": "11:00",
  "amenityFeature": [
    {
      "@type": "LocationFeatureSpecification",
      "name": "Free Wi-Fi",
      "value": true
    },
    {
      "@type": "LocationFeatureSpecification",
      "name": "Free parking",
      "value": true
    },
    {
      "@type": "LocationFeatureSpecification",
      "name": "Airport shuttle",
      "value": true
    },
    {
      "@type": "LocationFeatureSpecification",
      "name": "Breakfast included",
      "value": true
    },
    {
      "@type": "LocationFeatureSpecification",
      "name": "Pets allowed",
      "value": false
    },
    {
      "@type": "LocationFeatureSpecification",
      "name": "Wheelchair accessible",
      "value": true
    },
    {
      "@type": "LocationFeatureSpecification",
      "name": "Smoke-free rooms",
      "value": true
    },
    {
      "@type": "LocationFeatureSpecification",
      "name": "Restaurant",
      "value": true
    },
    {
      "@type": "LocationFeatureSpecification",
      "name": "24-hour front desk",
      "value": true
    }
  ],
  "petsAllowed": false,
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": 5,
    "reviewCount": 4,
    "bestRating": 5,
    "worstRating": 1
  },
  "sameAs": [
    "https://facebook.com/clientresort",
    "https://instagram.com/clientresort",
    "https://youtube.com/clientresort"
  ]
}
```

Optional properties emitted when configured: `hasMap` (`property.mapUrl`), `starRating`
(`property.starRating`, only for officially rated properties), `image` (`property.image`,
defaulting to the generated OG image).

## 6. AggregateRating and Review

Built only from `GoogleReviewCache` (`src/lib/reviews.ts`), the same data the visible
`<GoogleReviews>` widget receives. On `/reviews`, the lodging node carries one `Review` per
cached review:

```json
{
  "@type": "Review",
  "author": {
    "@type": "Person",
    "name": "Sabrina Rahman"
  },
  "reviewBody": "Saint Martin was pristine. The resort team arranged our ferry transfers seamlessly. Sunset views from the hammock deck were unmatched.",
  "datePublished": "2026-06-24",
  "reviewRating": {
    "@type": "Rating",
    "ratingValue": 4.8,
    "bestRating": 5,
    "worstRating": 1
  }
}
```

The sample testimonials hardcoded on `/reviews` are **not** marked up.

> Google does not show review-star rich results for a LocalBusiness or Organization reviewing
> itself ("self-serving reviews"). The markup is valid and used for understanding, but don't
> promise stars in search results.

## 7. WebPage + Speakable

Speakable is a WebPage property. Selectors point at the `<h1>` and every
`[data-speakable="answer"]` direct-answer block.

```json
{
  "@type": "WebPage",
  "@id": "https://clientresort.com/#webpage",
  "url": "https://clientresort.com/",
  "name": "Reusable Travel Website Scaffold for Bangladeshi Resorts & Hotels",
  "description": "High-performance, 4G BDIX-optimized website foundation built with Next.js 15, Tailwind CSS v4, and Prisma ORM.",
  "isPartOf": {
    "@id": "https://clientresort.com/#website"
  },
  "about": {
    "@id": "https://clientresort.com/#lodging"
  },
  "inLanguage": "en",
  "speakable": {
    "@type": "SpeakableSpecification",
    "cssSelector": [
      "h1",
      "[data-speakable=\"answer\"]"
    ]
  }
}
```

## 8. Destination lodging, HotelRoom and Offer

Each destination page emits its lodging node, one `HotelRoom` per room and a nightly
`Offer` per room. Prices go on `makesOffer → Offer.itemOffered` because schema.org
`HotelRoom` (a Place) has no `offers` property. No `aggregateRating` is emitted: the
`Destination` model stores a rating but no review count or reviews to support it.

Lodging (`makesOffer` and `containsPlace` trimmed to one room):

```json
{
  "@type": "Resort",
  "@id": "https://clientresort.com/destinations/coxs-bazar#lodging",
  "name": "Sayeman Beach Resort & Spa",
  "description": "Located on Kalatoli Beach, Cox's Bazar. Featuring oceanfront infinity pools, gourmet dining, and direct beach access.",
  "url": "https://clientresort.com/destinations/coxs-bazar",
  "image": {
    "@id": "https://clientresort.com/destinations/coxs-bazar#image-hero"
  },
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Marine Drive, Cox's Bazar, Chittagong Division",
    "addressCountry": "BD"
  },
  "telephone": "+880 1700-000000",
  "priceRange": "৳৳৳",
  "checkinTime": "14:00",
  "checkoutTime": "11:00",
  "brand": {
    "@id": "https://clientresort.com/#organization"
  },
  "containsPlace": [
    {
      "@id": "https://clientresort.com/destinations/coxs-bazar#room-93cc0150-8480-4043-bec0-510225797553"
    }
  ],
  "makesOffer": [
    {
      "@type": "Offer",
      "url": "https://clientresort.com/book/93cc0150-8480-4043-bec0-510225797553",
      "priceCurrency": "BDT",
      "price": 12500,
      "priceSpecification": {
        "@type": "UnitPriceSpecification",
        "price": 12500,
        "priceCurrency": "BDT",
        "unitCode": "DAY",
        "referenceQuantity": {
          "@type": "QuantitativeValue",
          "value": 1,
          "unitCode": "DAY"
        }
      },
      "itemOffered": {
        "@id": "https://clientresort.com/destinations/coxs-bazar#room-93cc0150-8480-4043-bec0-510225797553"
      }
    }
  ]
}
```

HotelRoom:

```json
{
  "@type": "HotelRoom",
  "@id": "https://clientresort.com/destinations/coxs-bazar#room-93cc0150-8480-4043-bec0-510225797553",
  "name": "Oceanfront Deluxe Room",
  "image": "https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=1200&q=80",
  "containedInPlace": {
    "@id": "https://clientresort.com/destinations/coxs-bazar#lodging"
  },
  "occupancy": {
    "@type": "QuantitativeValue",
    "minValue": 1,
    "maxValue": 2
  },
  "bed": {
    "@type": "BedDetails",
    "typeOfBed": "King Bed"
  },
  "floorSize": {
    "@type": "QuantitativeValue",
    "value": 620,
    "unitCode": "FTK"
  },
  "amenityFeature": [
    {
      "@type": "LocationFeatureSpecification",
      "name": "Sea-facing balcony",
      "value": true
    },
    {
      "@type": "LocationFeatureSpecification",
      "name": "King bed",
      "value": true
    },
    {
      "@type": "LocationFeatureSpecification",
      "name": "Rain shower",
      "value": true
    },
    {
      "@type": "LocationFeatureSpecification",
      "name": "Welcome Drink",
      "value": true
    }
  ]
}
```

## 9. ImageObject

```json
{
  "@type": "ImageObject",
  "@id": "https://clientresort.com/destinations/coxs-bazar#image-hero",
  "contentUrl": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80",
  "url": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80",
  "caption": "Sayeman Beach Resort & Spa, Marine Drive, Cox's Bazar, Chittagong Division",
  "description": "Bangladesh's Premier Oceanfront Luxury Resort on the Longest Natural Beach"
}
```

## 10. Place + GeoCoordinates

On `/how-to-reach`, linked to the property via `containsPlace`.

```json
{
  "@type": "Place",
  "@id": "https://clientresort.com/how-to-reach#place",
  "name": "Client Resort & Spa",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Resort Road, Destination Zone",
    "addressLocality": "Cox's Bazar",
    "addressRegion": "Chattogram Division",
    "postalCode": "4700",
    "addressCountry": "BD"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 21.4272,
    "longitude": 92.0058
  },
  "hasMap": "https://www.google.com/maps/search/?api=1&query=21.4272,92.0058",
  "containsPlace": {
    "@id": "https://clientresort.com/#lodging"
  }
}
```

## 11. TouristAttraction

`sameAs` comes from the Wikidata-verified registry in `src/content/entities.ts`.
`openingHours` and `isAccessibleForFree` are emitted only when set on the attraction; the
sample data sets neither, so they are omitted rather than guessed.

```json
{
  "@type": "TouristAttraction",
  "@id": "https://clientresort.com/explore-the-area/lawachara-national-park#attraction",
  "name": "Lawachara National Park",
  "description": "A lush rainforest sanctuary famous for the critically endangered hoolock gibbons, rare orchids, and scenic nature trails.",
  "url": "https://clientresort.com/explore-the-area/lawachara-national-park",
  "image": "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1200&q=80",
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 24.3215,
    "longitude": 91.7876
  },
  "hasMap": "https://www.google.com/maps/search/?api=1&query=24.3215,91.7876",
  "publicAccess": true,
  "sameAs": [
    "https://www.wikidata.org/wiki/Q3350641"
  ]
}
```

## 12. FAQPage

Built from `FAQ_ITEMS`, the array `<FaqList>` renders (`mainEntity` trimmed to 2 of 15):

```json
{
  "@type": "FAQPage",
  "@id": "https://clientresort.com/faq#faq",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "How do I book a room at Client Resort & Spa?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Book directly on this website: choose a destination, pick a room and pay online to confirm instantly. Direct bookings receive an email confirmation and a digital check-in pass. You can also call +880 1700-000000 or message us on WhatsApp if you prefer to book with our reservations team."
      }
    },
    {
      "@type": "Question",
      "name": "Are children welcome, and can I add an extra bed?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes, children are welcome, and children under 5 stay free when they share the existing bedding. An extra bed costs BDT 1,200 per night. Extra beds depend on the room type, so request one when you book and we will confirm it before arrival."
      }
    }
  ]
}
```

## 12.5 HowTo

Built from the same `reachStep1`–`4` strings `<StepList>` renders on `/how-to-reach` — the
schema and the visible list must stay word-for-word identical (English, the SSR language).

```json
{
  "@type": "HowTo",
  "@id": "https://clientresort.com/how-to-reach#howto",
  "name": "How to reach Client Resort & Spa from Dhaka, step by step",
  "step": [
    {
      "@type": "HowToStep",
      "position": 1,
      "text": "Book a domestic flight from Dhaka (DAC) to Cox's Bazar (CXB). The flight takes about one hour."
    },
    {
      "@type": "HowToStep",
      "position": 2,
      "text": "Send us your flight number at least 24 hours before arrival to reserve the shuttle."
    }
  ]
}
```

## 13. Article

`dateModified` comes from `BlogPost.updatedAt`. `inLanguage` is `bn-BD` when the post is
served in Bengali (`?lang=bn`). `articleBody` is trimmed here.

```json
{
  "@type": "Article",
  "@id": "https://clientresort.com/blog/ultimate-coxs-bazar-travel-guide#article",
  "headline": "The Ultimate Guide to Cox's Bazar: Beach, Marine Drive & Culinary Gems",
  "description": "How to get the most out of visiting the world's longest natural sea beach with oceanfront relaxation.",
  "image": [
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80"
  ],
  "datePublished": "2025-01-10T00:00:00.000Z",
  "dateModified": "2026-09-28T09:37:18.424Z",
  "author": {
    "@type": "Person",
    "name": "Beach Resort Team"
  },
  "publisher": {
    "@id": "https://clientresort.com/#organization"
  },
  "mainEntityOfPage": "https://clientresort.com/blog/ultimate-coxs-bazar-travel-guide",
  "articleSection": "Destination Guides",
  "inLanguage": "en",
  "articleBody": "# The Ultimate Guide to Cox's Bazar: Beach, Marine Drive & Culinary Gems\n\nStretching over 120 kilometers along the Bay o…",
  "url": "https://clientresort.com/blog/ultimate-coxs-bazar-travel-guide"
}
```

## 14. BreadcrumbList

The page passes the same `crumbs` array to `<Breadcrumbs>` (visible) and `getBreadcrumbSchema()`.

```json
{
  "@type": "BreadcrumbList",
  "@id": "https://clientresort.com/destinations/coxs-bazar#breadcrumb",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "https://clientresort.com/"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Destinations",
      "item": "https://clientresort.com/destinations"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "Sayeman Beach Resort & Spa",
      "item": "https://clientresort.com/destinations/coxs-bazar"
    }
  ]
}
```

---

## 15. Validation

- **Rich Results Test** (https://search.google.com/test/rich-results): run the homepage,
  `/faq`, one destination and one blog post after any schema change. Must show 0 errors.
  Results for this release are in `../archive/GROWTH-VERIFICATION.md`.
- **Schema.org validator** (https://validator.schema.org): catches vocabulary errors the Rich
  Results Test ignores for types Google doesn't feature (HotelRoom, TouristAttraction, Place).
- **Local extraction**: `python3 scripts/extract-jsonld.py http://localhost:3000/<path>` lists
  every node, `@id`, rating and `sameAs` on a page and fails on JSON parse errors.

## 16. Generator → route map (no dead generators)

| Generator | Called from |
|---|---|
| `getOrganizationSchema`, `getWebSiteSchema` | `src/app/layout.tsx` |
| `getLodgingBusinessSchema` | `src/app/page.tsx`, `src/app/contact/layout.tsx`, `src/app/reviews/page.tsx` |
| `getAggregateRatingSchema` | `src/app/page.tsx`, `src/app/reviews/page.tsx` |
| `getReviewSchema` | `src/app/reviews/page.tsx` |
| `getSpeakableWebPageSchema` | `src/app/page.tsx`, `src/app/faq/page.tsx` |
| `getDestinationLodgingGraph` (→ `getHotelRoomSchema`, `getRoomOfferSchema`) | `src/app/destinations/[slug]/page.tsx` |
| `getImageObjectSchema` | `src/app/destinations/[slug]/page.tsx`, `src/app/explore-the-area/[slug]/page.tsx` |
| `getPropertyPlaceSchema` | `src/app/how-to-reach/page.tsx` |
| `getTouristAttractionSchema` | `src/app/explore-the-area/[slug]/page.tsx` |
| `getFAQPageSchema` | `src/app/faq/page.tsx` |
| `getHowToSchema` | `src/app/how-to-reach/page.tsx` |
| `getArticleSchema` | `src/app/blog/[slug]/page.tsx` |
| `getBreadcrumbSchema` | destination, attraction, blog post, booking, `/faq`, `/how-to-reach`, `/contact` |

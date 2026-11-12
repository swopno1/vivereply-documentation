# Keyword Map (per-client template)

Copy this file for each client deployment (`KEYWORD-MAP.<client>.md`, kept in the client
branch) and fill in every table **from real keyword research**: Google Search Console queries
for an existing site, plus Google Keyword Planner, Google autocomplete and "People also ask"
for the location. Do not publish estimated volumes as facts. Write "n/a" when unknown.

The rows below show the **structure** using the sample configuration (a Cox's Bazar resort).
They are examples of intent and phrasing, not researched targets.

---

## 1. Client profile

| Field | Value |
|---|---|
| Property name (exact, as on GBP) | |
| Location label (`property.locationLabel`) | |
| Primary market (e.g. Dhaka families, Chattogram couples, foreign tourists) | |
| Languages searched | English / Bengali / Banglish |
| Top 3 competitors (name + domain) | |
| Research date and sources | |

---

## 2. Page → primary keyword

One primary keyword per page. It must appear in the title (first 30 characters), the `<h1>`
and the first paragraph. No two pages share a primary keyword.

| Route | Primary keyword (EN) | Primary keyword (BN) | Secondary keywords | Intent |
|---|---|---|---|---|
| `/` | *cox's bazar resort* | *কক্সবাজার রিসোর্ট* | *[brand name]*, *sea view resort cox's bazar* | Commercial |
| `/destinations` | *resorts in bangladesh* | *বাংলাদেশের রিসোর্ট* | *beach resort bangladesh* | Commercial |
| `/destinations/[slug]` | *[destination] hotel/resort* | *[destination] রিসোর্ট* | *[destination] room price* | Transactional |
| `/book/[roomId]` | *book [room type] [destination]* | | | Transactional |
| `/how-to-reach` | *how to go [location] from dhaka* | *ঢাকা থেকে [location] যাওয়ার উপায়* | *[location] bus/train/flight* | Informational |
| `/explore-the-area/[slug]` | *[attraction]* | *[attraction bn]* | *[attraction] distance*, *best time to visit* | Informational |
| `/faq` | *[brand] check in time* | *[brand] চেক ইন* | *pets allowed*, *breakfast included* | Pre-booking |
| `/dining` | *[location] seafood restaurant* | *[location] সামুদ্রিক খাবার* | | Commercial |
| `/amenities` | *[brand] facilities* | | *resort with pool [location]* | Commercial |
| `/offers` | *[location] resort offer* | *[location] হোটেল অফার* | *package*, *discount* | Transactional |
| `/reviews` | *[brand] reviews* | | | Navigational |
| `/blog/[slug]` | one informational query per post | | | Informational |

---

## 3. Question bank (AEO / GEO)

The questions people ask about the property and area. Each one must be answered on exactly one
page, in a direct answer block or an FAQ. This is also the monthly AI-citation test set
(`SEO-STRATEGY.md` §5).

| # | Question (as searched or spoken) | Answered on | Answer block / FAQ id | Cited by AI? (date) |
|---|---|---|---|---|
| 1 | What is [brand]? | `/`, `/faq` | `answers.home*` | |
| 2 | How do I get to [brand] from Dhaka? | `/how-to-reach` | `answers.reach*` | |
| 3 | What time is check-in at [brand]? | `/faq` | `checkin-checkout-times` | |
| 4 | Is breakfast included at [brand]? | `/faq` | `breakfast` | |
| 5 | Can I pay with bKash? | `/faq` | `payment-methods` | |
| 6 | What is the cancellation policy? | `/faq` | `cancellation-policy` | |
| 7 | Are pets allowed? | `/faq` | `pets-policy` | |
| 8 | Best time to visit [location]? | blog / attraction guide | | |
| 9 | How far is [attraction] from [brand]? | `/explore-the-area/[slug]` | `answers.attractionDistance*` | |
| 10 | Best resorts in [location]? | `/`, `/destinations` | | |

---

## 4. Bengali and Banglish variants

Bangladeshi users mix scripts. Record the variants you see in Search Console and autocomplete,
and cover them in `bn.ts → seo` meta copy and in blog content. **Don't stuff variants into English
pages.**

| English query | Bengali | Banglish / transliterated |
|---|---|---|
| *cox's bazar hotel price* | *কক্সবাজার হোটেল ভাড়া* | *coxs bazar hotel vara* |
| *sajek resort booking* | *সাজেক রিসোর্ট বুকিং* | *sajek resort booking* |
| | | |

---

## 5. Blog content plan

| Target query | Working title (≤ 60 chars) | Pillar | Links to (≥2 destinations/experiences) | Publish | Refresh by (+13 weeks) |
|---|---|---|---|---|---|
| | | | | | |

---

## 6. Review log

| Date | Change | Reason (data) |
|---|---|---|
| | | |

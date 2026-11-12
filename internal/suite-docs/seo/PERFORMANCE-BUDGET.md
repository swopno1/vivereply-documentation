# Performance Budget

Performance is a ranking factor, a conversion factor, and a hard dependency of the organic-search
work. A direct answer on a page that takes five seconds to paint is rarely seen. This document
records the **enforced budget**, the **measured** numbers, and the rules that protect them.

> Every number below comes from an actual Lighthouse run. Do not edit a measured value without
> re-running the measurement, and record the date and method with it.

---

## 1. Budget (targets)

| Metric | Budget | Source of truth |
|---|---|---|
| Lighthouse Performance (mobile) | **≥ 90** on `/`, `/faq`, one destination page | Lighthouse, mobile, 4× CPU throttle |
| Largest Contentful Paint (LCP) | **≤ 2.5 s** | Lab (Lighthouse) + field (GSC Core Web Vitals) |
| Interaction to Next Paint (INP) | **≤ 200 ms** (field, p75) | GSC Core Web Vitals / CrUX |
| Total Blocking Time (TBT, lab proxy for INP) | **≤ 200 ms** | Lighthouse |
| Cumulative Layout Shift (CLS) | **≤ 0.1** | Lighthouse + field |
| Time to First Byte (TTFB) | **≤ 200 ms** at origin, BDIX path | `curl -w "%{time_starttransfer}"` |
| JavaScript per route | **≤ 150 KB** compressed on first load | Lighthouse network requests (Script) |
| Web fonts on English pages | **≤ 120 KB** | Lighthouse network requests (Font) |
| Hero image | **≤ 150 KB**, AVIF/WebP, `priority` | Lighthouse LCP element |

The JS budget comes from `CLAUDE.md` §2. The font budget allows Inter and Playfair Display
(about 113 KB), with Noto Sans Bengali loading only when Bengali text is displayed.

---

## 2. Measured (2026-09-28)

**Method:** `next build && next start` (production, local), Lighthouse 13, `--form-factor=mobile
--throttling.cpuSlowdownMultiplier=4`, headless Chrome. Each page was run **3 times** and the
median-scoring run is reported (single runs vary by ±4 points). The destination page is
`/destinations/coxs-bazar`.

### 2.1 Core metrics

| Page | Measurement point | Score | LCP | TBT | CLS | FCP |
|---|---|---|---|---|---|---|
| `/` | Before organic-search phase (main @ `9731feb`) | 80 | 4.8 s | 20 ms | 0 | 2.1 s |
| `/` | After organic-search phase (`9871b88`) | 81 | 5.3 s | 40 ms | 0 | 0.9 s |
| `/faq` | Before | 83 | 4.8 s | 20 ms | 0 | 0.9 s |
| `/faq` | After | 81 | 5.1 s | 90 ms | 0 | 0.9 s |
| destination | Before | 79 | 5.6 s | 80 ms | 0 | 0.9 s |
| destination | After | 79 | 5.5 s | 70 ms | 0 | 0.9 s |

**Status: the budget is NOT met.** LCP is about 2× over the target on every page, and no page
reaches a score of 90. TBT and CLS are within budget. The organic-search phase was roughly
neutral: scores moved by ≤ 2 points (within the run-to-run spread), and TBT rose
40–70 ms on `/faq` from hydrating the bilingual FAQ list and direct-answer blocks.

Earlier revisions of this file reported a homepage score of 93. That could not be reproduced on
2026-09-28 with the method above and has been removed.

### 2.2 Transfer sizes (compressed, "after" runs)

| Page | JS | CSS | Fonts | Images | Total |
|---|---|---|---|---|---|
| `/` | 297 KB | 15 KB | 366 KB | 4 KB | 715 KB |
| `/faq` | 246 KB | 15 KB | 366 KB | 0 KB | 653 KB |
| destination | 274 KB | 15 KB | 366 KB | 82 KB | 777 KB |

- **JS is about 2× over the 150 KB budget** on every route.
- **Fonts are about 3× over the 120 KB budget.**
- TTFB is 3–10 ms locally (statically generated pages). Production TTFB depends on the host
  and must be measured on the deployed site.

---

## 3. Known causes (diagnosed, not yet fixed)

Found in the Lighthouse baseline of 2026-09-28. These belong to the paused performance sprint.

1. **Noto Sans Bengali (214 KB) loads on every English page.** Two causes:
   - its `@font-face` has no `unicode-range`, so Chrome fetches it while Inter or Playfair is still loading; and
   - the language switcher renders "বাংলা", so every page really does contain Bengali glyphs.
   Fix: add a `unicode-range` for the Bengali block (U+0980–09FF, U+200C–200D, U+25CC) and
   render the switcher label in the system font.
2. **Playfair Display downloads twice (2 × 39 KB).** `layout.tsx` preloads
   `/fonts/playfair-display.woff2`, and `next/font` also preloads its own hashed copy. Fix: remove
   the manual `<link rel="preload">`.
3. **LCP is text on `/` and `/faq`**, and it waits on the fonts above. Fixing 1 and 2 is expected
   to move LCP the most. This is unmeasured and must be proven with a Lighthouse run.
4. **Destination hero preload lacks `fetchpriority="high"`** (Lighthouse `lcp-discovery-insight`).
5. **About 29 KB of unused JavaScript** per route, and 13 KB of legacy polyfills on the destination page.

---

## 4. Rules that protect the budget

### JavaScript

- Server Components by default. Add `"use client"` only to a component that uses state,
  effects, event handlers or browser APIs, and keep it a small leaf. New SEO components that
  need the language toggle (`DirectAnswer`, `FaqList`, `StepList`, `LastUpdated`) are small
  leaves that receive their content as props.
- `framer-motion`: import only `LazyMotion`, `domAnimation`, `m` and `AnimatePresence`.
- No `moment`, `lodash` or `date-fns`. Use `Intl` via `src/lib/formatters.ts`.
- Heavy SDKs (Google Maps) are imported dynamically inside effects, never at module top level.
- Keep `experimental.optimizePackageImports` covering every icon/UI package in use.
- Third-party scripts (GA4, Meta Pixel) use `next/script` with `afterInteractive` or `lazyOnload`, never `beforeInteractive`.

### INP (interaction responsiveness)

- Keep event handlers under 50 ms. Move heavy work (price calculation over many dates, filtering
  long lists) into `startTransition` or off the main thread.
- Never run synchronous `localStorage` reads or JSON parsing of large payloads inside click handlers.
- Show immediate visual feedback (pressed state, spinner) before any network call in booking and payment flows.
- Avoid layout thrashing: don't read layout (`getBoundingClientRect`) and write styles in the same loop.

### Images

- `next/image` only (no `<img>`). `priority` on the LCP image, correct `sizes`, AVIF/WebP via `images.formats`.
- Explicit dimensions or `fill` inside a sized container, so CLS stays at 0.

### Fonts

- Self-hosted via `next/font/local`, `display: swap`, fallback metrics generated by next/font (size-adjust).
- Load only the weights in use. Bengali only when Bengali is displayed (see §3.1).

### CSS

- Tailwind v4, one stylesheet (15 KB). No additional global CSS libraries.

---

## 5. How to measure

```bash
pnpm build && pnpm start
npx lighthouse http://localhost:3000/ --output=json --output-path=./lh-home.json \
  --form-factor=mobile --throttling.cpuSlowdownMultiplier=4 --chrome-flags="--headless=new"
```

- Run each page **3 times** and report the median-scoring run.
- Report score, LCP, TBT and CLS, and the LCP element (`largest-contentful-paint-element`).
- Record transfer sizes by resource type from `audits["network-requests"]`.
- After deployment, compare with **field data** in Search Console → Core Web Vitals (28-day
  window). Field data, not lab data, is what Google uses for ranking.

---

## 6. Gate

The organic-search brief lists "homepage ≥ 90 on mobile" as a hard dependency. **It was not
met** when the organic-search phase was built (homepage 80 before, 81 after). The owner chose to proceed
and record the gap. The fixes in §3 are the next performance sprint's starting point, and
each must be committed and measured on its own.

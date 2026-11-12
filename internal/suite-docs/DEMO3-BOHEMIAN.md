# Demo3 — Bohemian Resort Website (client/demo3)

## What this is
A complete, production-quality public resort website in a Bohemian design style,
built as an **optional design demo** on the `client/demo3` branch. It showcases
the fictional **Krishnachura Retreat** — every name, price, review, and detail is
invented demonstration content, clearly labelled as such throughout the site.

## Preview
Deploy the `client/demo3` branch (e.g. Vercel preview from the branch). The
public site renders the Bohemian design; `/admin` serves the unchanged RMS.

## Architecture — isolation
- All demo code lives in `src/demo/bohemian/` (data, design tokens, components).
- All demo pages live in the `(boho)` route group: `src/app/(boho)/`.
  Route groups don't change URLs, so `/`, `/stay`, `/about`, etc. work as normal.
- Design tokens are scoped under the `.boho` CSS class (`boho.css`). The admin,
  APIs, booking flow, and RMS never reference them.
- Demo pages use `demoMetadata()` (noindex, fictional titles) — never the real
  brand SEO helpers.

## New routes
| Route | Page |
|---|---|
| `/` | Home — hero, booking widget, story, featured stays, amenities, experiences, dining feature, gallery preview, testimonials, offers, CTA |
| `/stay` | Accommodation listing (5 fictional stays) + live availability search |
| `/stay/[slug]` | Accommodation detail — gallery, specs, amenities, policies, booking card |
| `/experiences` | Experience listing (6 fictional experiences) |
| `/experiences/[slug]` | Experience detail |
| `/dining` | Ember & Leaf restaurant — story, sample menu, hours |
| `/gallery` | Filterable gallery + accessible lightbox |
| `/about` | Fictional resort story and values |
| `/offers` | Packages (featured + cards), illustrative pricing |
| `/location` | Directions and nearby attractions (demo) |
| `/contact` | Demo contact details + validated demo form |
| `/faq` | Accordion FAQ (demo) |
| `/privacy`, `/terms` | Clearly-labelled demonstration legal copy |

## Components (`src/demo/bohemian/components/`)
`BohoChrome` (header/footer), `ui` (buttons, headings, sections, badges),
`Cards` (accommodation/experience/offer), `Gallery` (grid + lightbox),
`BookingWidget` (live availability), `Testimonials`, `ContactForm`, `Reveal`
(scroll animation), `BohoImage` (next/image wrapper with blur placeholder).

## Booking integration (real, not faked)
`src/demo/bohemian/actions.ts` exposes `searchAvailability()`, a server action
using the RMS's own engine (`src/lib/rooms/availability` + Prisma). The
`BookingWidget` searches **real** rooms/units and deep-links to the untouched
`/book/[roomId]` flow. Fictional showcases never invent availability or prices.

## What was NOT touched (RMS preserved)
`src/app/admin/**`, `src/app/api/**`, `src/app/actions/**`, `src/app/book/**`,
`src/app/booking/**`, `src/app/payment/**`, `src/middleware.ts`, `prisma/**`,
`src/lib/**`, `src/components/**`, root `src/app/layout.tsx`. No migrations,
no schema changes, no auth changes. The only shared-file edit is additive:
`sitemap.ts` gained the `/stay` and `/location` demo routes.

## Verification
- All 30 new files pass esbuild syntax validation.
- RMS regression: verified by change scope — no RMS file was modified.
- `pnpm lint` / `pnpm build` could not run here (no full local checkout with
  dependencies/database in this environment); run them before merging.

## Known limitations
- Demo pages are `noindex` (intentional — fictional content).
- Root-layout floating widgets (WhatsApp/callback/chat) still render on demo
  pages; they are shared functionality, intentionally untouched.
- Non-redesigned public routes (`/blog`, `/destinations`, `/reviews`, …) remain
  functional in the legacy design and are not linked from the new navigation.
- Imagery is Unsplash-sourced; replace with real photography before any
  production use.

# `(swiss)` → `(site)` route + theme plan (CQ-M11)

Plan only — not executed. The guest-facing route group hardcodes the
demo brand in three coupled layers; renaming the directory alone would
leave the brand behind in imports, CSS and component names.

## Current coupling (2026-11-02)

1. **Route group** `src/app/(swiss)/` — 64 files, 24 routes (about,
   stay, book, offers, blog/[slug], demo-gateway, …). Route groups don't
   affect URLs, so the rename itself is URL-safe.
2. **Theme package** `src/demo/swiss/` (`swiss.css`, `SwissChrome`,
   `DemoBanner`, `actions.ts`, `data.ts`) — imported by the group
   layout AND by `src/app/booking/*` + `src/app/blog/*` outside it.
3. **CSS scope** `.swiss` (root layout comment + group layout div).
4. **Blog split**: list/category/tag live in `src/app/blog/*`, post +
   submit in `src/app/(swiss)/blog/*` — one feature, two trees, two
   layouts (the (swiss) half gets Swiss chrome, the top half doesn't).

## Execution order

1. **Unify blog first** (same behavior, one tree): move
   `(swiss)/blog/[slug]` + `(swiss)/blog/submit` into `src/app/blog/`,
   keeping URLs (`/blog/x` — group is URL-transparent). Verify list →
   post → submit still renders under one layout.
2. **Theme via config**: add `brand.theme` (`"swiss" | future themes`)
   to brand config; the new `(site)/layout.tsx` picks chrome/CSS by
   that flag instead of importing `@/demo/swiss/*` directly.
3. **Rename the package**: `git mv src/demo/swiss src/demo/themes/swiss`
   (history preserved), then `git mv "src/app/(swiss)" src/app/(site)`.
   Update the 5 out-of-group importers
   (`booking/confirmation`, `booking/manage`, `booking/not-found`,
   `blog/BlogListingPage`, `blog/not-found`).
4. **CSS scope**: rename `.swiss` → `.site-swiss` (or per-theme class
   from step 2) in `swiss.css` + the two layout divs.
5. **Verify**: `tsc`, `eslint`, full suite, `pnpm build`, and a visual
   pass over every guest route in en + bn (URLs unchanged, so no
   redirect map is needed; the sitemap/robots stay valid).

## Non-goals

- No URL changes (groups are URL-transparent).
- No new theme is designed here — only the seam that lets one plug in.
- `DemoBanner` stays until the owner calls production (demo-mode contract).

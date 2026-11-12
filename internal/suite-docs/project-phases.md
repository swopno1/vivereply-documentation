# Project Implementation Plan & Phases

This document outlines the six development phases for the Bangladeshi resort and travel website scaffold.

---

## Phase 1: Foundation (Completed)

- [x] Initialize Next.js 15+ App Router project with TypeScript and `pnpm`.
- [x] Configure Tailwind CSS v4 using CSS-first `@theme` configuration in `src/styles/theme.css`.
- [x] Add self-hosted font loading via `next/font/local` in `public/fonts/` for display font (Playfair Display / Fraunces) and body font (Inter / Noto Sans Bengali fallback).
- [x] Install and configure shadcn/ui base primitives (`Button`, `Card`, `Input`, `Badge`, `Sheet`, `Dialog`, `Tabs`).
- [x] Install Framer Motion (restricted strictly to `motion` and `AnimatePresence` imports).
- [x] Implement the isolated branding layer in `src/components/brand/`:
  - `brand.config.ts` (Site name, domain, social links, primary color)
  - `BrandConfig.tsx` (Context provider)
  - `Logo.tsx` (SVG logo accepting variant prop)
  - `BrandColors.ts` (CSS variable bindings)
  - `BrandFooter.tsx` (Client-tailored footer)
- [x] Implement bilingual content dictionary placeholders in `src/content/en.ts` and `src/content/bn.ts` with a lightweight `useTranslation` hook.
- [x] Build the interactive style guide page at `/style-guide`:
  - Render all design system tokens (colors, typography, radii, spacing, shadows).
  - Render base UI components in all state variants.
  - Render travel-specific component shells (`HeroSearchBar`, `DestinationCard`, `BookingStepper`, `RoomCard`, `TrustBar`, `StickyMobileCTA`).
- [x] Configure `next.config.ts` with `remotePatterns` placeholder and `optimizePackageImports`.
- [x] Document repository architecture and brand-swapping instructions in `README.md`.

**Definition of Done**:
- Clean `pnpm build` and `pnpm lint` without errors or warnings.
- The `/style-guide` route visually renders all design tokens, components, and travel component shells.
- Zero horizontal scrolling or layout clipping when verified at 360px mobile viewport width.
- Zero hardcoded brand references outside `src/components/brand/`.

---

## Phase 2: Content & Data Structure (Completed)

- [x] Define Prisma ORM schema for `Destination`, `Room`, `Booking`, `Guest`, and `Payment` models.
- [x] Create seed scripts with rich Bangladeshi travel data (5-10 destinations e.g., Sajek Valley, Cox's Bazar, Sreemangal, Sundarbans, Kuakata, Saint Martin's Island).
- [x] Implement SSG + ISR routes for `/destinations` and `/destinations/[slug]`.
- [x] Integrate `next/image` blur-up image placeholders generated during build/seed.

**Definition of Done**:
- Database seeds successfully with realistic content and images.
- Destination pages render statically with revalidation schedules and blur loading states.

---

## Phase 3: Booking Flow & Administrative Interface (Completed)

- [x] Implement stateful, multi-step `BookingStepper` UI (`/book/[roomId]`).
- [x] Implement payment gateway adapter interfaces for bKash, Nagad, and SSLCommerz.
- [x] Build webhook API handlers for async payment confirmation and status mutations.
- [x] Build `/booking/confirmation/[id]` route with downloadable check-in pass.
- [x] Integrate Resend API for transactional confirmation email dispatch.
- [x] Implement secure `/admin` dashboard for room availability toggles and booking management.

**Definition of Done**:
- End-to-end booking reservation state saved to database.
- Payment webhooks update booking status reliably with failure fallbacks.
- Transactional HTML emails received upon booking confirmation.

---

## Phase 4: Performance & Network Optimization (Completed)

- [x] Execute Google Lighthouse audit targeting >95 mobile performance score on simulated 4G connection.
- [x] Configure Next.js `optimizePackageImports` for heavy icon and motion packages.
- [x] Implement dynamic imports with loading shimmer skeletons for off-screen components.
- [x] Instrument lightweight Real User Monitoring (RUM) for Core Web Vitals tracking.

**Definition of Done**:
- Initial JavaScript bundle size strictly under 150KB gzipped per route.
- First Contentful Paint (FCP) under 1.2 seconds on simulated 4G mobile.

---

## Phase 5: Comprehensive i18n & Localization (Completed)

- [x] Expand translation dictionaries in `src/content/en.ts` and `src/content/bn.ts` for all route content.
- [x] Implement header language switcher with cookie/local-storage locale persistence.
- [x] Configure font fallback rules ensuring seamless Noto Sans Bengali rendering.
- [x] Format currency outputs using `Intl.NumberFormat('bn-BD', { style: 'currency', currency: 'BDT' })`.

**Definition of Done**:
- Complete interface toggle between English and Bengali without layout shifts or text overflow.
- All numbers, dates, and currency values formatted according to target locale.

---

## Phase 6: Production Deployment & Infrastructure (Completed)

- [x] Create multi-stage production `Dockerfile` optimized for Next.js standalone output.
- [x] Prepare BDIX VPS deployment guide (Nginx reverse proxy + PM2 process manager).
- [x] Document Let's Encrypt SSL certificate provisioning commands.
- [x] Finalize white-label branding swap manual in `README.md`.

**Definition of Done**:
- Docker container builds and executes efficiently.
- Documentation allows a developer to launch a newly branded resort client in under 30 minutes.

---

## Future Work (Post-v1 Roadmap)

- **Mobile Application Wrapper (Capacitor)**:
  - While Android native development is out of scope for v1, the scaffold architecture is designed to support a Capacitor web-wrapper wrapper build (`@capacitor/core`, `@capacitor/android`) in future releases if native store presence is required by a client.


---

## Phase 8: Local SEO & Feature-Rich Monetization Layer

- [x] Sub-Phase 8B: Interactive Map & "How to Reach" Page (`/how-to-reach`)
  - Integrated `@googlemaps/js-api-loader` for interactive map rendering.
  - Primary resort marker & custom transit hub markers for airports, bus terminals, and railway stations.
  - DirectionsService route calculation with text summary of distance and travel time.
  - Localized content strings in `src/content/en.ts` and `src/content/bn.ts`.

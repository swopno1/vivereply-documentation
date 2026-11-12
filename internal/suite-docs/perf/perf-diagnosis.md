# Performance Diagnosis & Primary Offenders Report

## Classification of Performance Bottlenecks

Based on the baseline Lighthouse mobile audits and Next.js Webpack bundle analysis, the primary performance bottlenecks are classified below:

### 1. Client-Side JavaScript Bundle
- **Issue**: Oversized chunks and heavy client hydration overhead contributing to high Total Blocking Time (TBT up to 1050ms on destination page, 440ms on homepage).
- **Primary Offenders**:
  - `src/components/travel/InteractiveReachMap.tsx`: Statically imports `@googlemaps/js-api-loader` (bundle chunk ~235.5 KB), pulling Google Maps SDK into initial client bundle even when off-screen or unused.
  - Overuse of `'use client'` directives across static presentational components (`src/components/travel/Header.tsx`, `src/components/travel/Footer.tsx`, `src/components/travel/HeroSection.tsx`, etc.), inflating client hydration bundle size.
  - Direct imports of full `framer-motion` package across components rather than using `m` from `LazyMotion`.

### 2. Fonts
- **Issue**: Large render-blocking font payloads causing high First Contentful Paint (FCP) and Largest Contentful Paint (LCP) delays (LCP 4.5s–5.2s).
- **Primary Offenders**:
  - `src/app/layout.tsx`: Loads `Noto_Sans_Bengali` font (214 KB woff2 file), `Inter` (74 KB), and `Playfair_Display` (39 KB) upfront.
  - Lack of font preloading for primary above-the-fold display font, causing text rendering layout delays.

### 3. Images
- **Issue**: High LCP on homepage (4.5s) and destination page (5.2s) due to unoptimized hero image delivery.
- **Primary Offenders**:
  - Homepage Hero (`src/components/travel/HeroSection.tsx`): Hero image missing `priority` attribute and optimal responsive `sizes` attribute.
  - Destination Detail (`src/app/destinations/[slug]/DestinationDetailClientView.tsx`): Hero image loads large remote Unsplash JPEG/PNG without explicit `priority` or tight `sizes` definition.

### 4. Server Response Time & Rendering
- **Issue**: Certain dynamic routes incurring unnecessary server rendering overhead instead of leveraging static generation (SSG) or incremental static revalidation (ISR).
- **Primary Offenders**:
  - Missing `revalidate` or `generateStaticParams` configs in subpages and dynamic detail routes.

### 5. Fabricated Admin Metrics & Schema Maintenance
- **Issue**: `/admin/performance` renders hardcoded/fabricated RUM metrics; unused schema generators in `src/lib/structured-data.ts`.


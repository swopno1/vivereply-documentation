# 04 — UI/UX & Usability (public booking + marketing flows)

Scope: public flows only. Admin/RMS screens excluded from this pass.
Verdict: **Booking flow exists but leaks intent, ships demo chrome, and fails a11y basics.** Fix params + demo removal + labels/focus/contrast before launch.

## Critical flow break: booking params dropped

**Status 2026-11-01: FIXED.** Widget triple now flows through a validated parser (`lib/booking/search-params.ts`, tested) into the book page and stepper initial state.

- `SwissBookingWidget.tsx:104` book link passes `checkIn`/`checkOut`/`guests` params.
- `src/app/(swiss)/book/[roomId]/page.tsx:39-42` never reads `searchParams`.
- `BookingStepper.tsx:40-42` dates init empty; params ignored.
- Net: guest picks dates → dates vanish on booking page. Fix: read params in page, seed stepper, validate range, show summary.

## Demo ships in prod chrome (remove before launch)

- `(swiss)/layout.tsx:11-16` demo banner + `pt-8` offset ships in layout.
- `DemoBanner.tsx:9-12` duplicate banner landmark, `z-100` above dialogs.
- `SwissChrome.tsx:99,135-136` fictional/demo footer copy.
- `HeroSearchBar.tsx:11-14,69-72` hardcoded past dates, non-functional search (style-guide only).
- `RoomCard.tsx:74-76`, `DestinationCard.tsx:81-83` dead CTA buttons (style-guide only).
- `FloatingWidgets.tsx:23,77-86` callback modal state has no trigger button (dead UI); exit-intent on `mouseleave` fires spuriously on desktop.
- `error.tsx:3-8,23-24` error chrome uses `SiteHeader`/`BrandFooter` not Swiss chrome; `skeletons.tsx:4-50` `BookingStepperSkeleton` rounded/card style mismatches Swiss flat.
- Fix: env-gate or delete demo components; unify error/loading chrome with Swiss theme; wire or remove dead CTAs; replace exit-intent with explicit trigger.

## Accessibility (all Medium, all launch-relevant)

- No skip link anywhere in public chrome (regex search: no match). `globals.css:3-6` `overflow-x: hidden` masks overflow instead of fixing it.
- `layout.tsx:86` `html lang` hardcoded `en` (breaks Bengali screen readers).
- Mobile menu (`SwissChrome.tsx:46-86`): no Esc close, focus trap, scroll lock, `aria-current`.
- Stepper (`BookingStepper.tsx:185-218`): divs no `aria-current`, labels hidden on mobile, error div no `role=alert`.
- Labels unassociated (`:239-264`, `:268-284`, `:347-412`): no `htmlFor`, input not nested, no `autoComplete`/`inputMode`.
- `PaymentMethodSelector.tsx:180` label with no control; gateway buttons no `aria-pressed`/`radiogroup` (`:189-349`).
- Gallery (`gallery/page.tsx:74-93`) `role=tablist` without tab keyboard semantics; lightbox `:128-181` no focus trap/return focus/scroll lock.
- Contrast fails AA 4.5: `#777777` meta/label 4.48:1; red `#E53935` small text ~4.2:1 (`swiss.css:54-58,189-197`).
- Invalid HTML: `(swiss)/page.tsx:46-56` `dt`/`dd` visual vs DOM order; `stay/page.tsx:40-41` `Reveal` div inside `ol` wraps `li`.
- Contact (`contact/page.tsx:135-204`): good `autocomplete` + `role=status` success; but phone required with no format validation, generic error only.
- Good patterns to keep: `BkashPaymentButton.tsx:92-129` proper disabled/loading/error `role=alert`; `PaymentMethodSelector.tsx:92-121` loading and no-methods states; `ConfirmationClientView.tsx:72-99` good `time`/`dateTime` + `formatDate(lang)`.

Fix order: skip link + dynamic `lang` → label association + autocomplete → stepper `aria-current` + `role=alert` errors → focus management (menu, lightbox, modal) → contrast tokens → invalid HTML.

**Status 2026-11-01: booking-path semantics FIXED** (skip link, menu Esc/trap/lock/aria-current, stepper list semantics + associated labels + autocomplete/inputMode + alert errors, payment radiogroup, clip overflow, focus-visible rings). `lang` deliberately unchanged (client sync is already correct; server read would de-static the app). Contrast + gallery lightbox + invalid-HTML nits remain.

## i18n / currency inconsistency

**Status 2026-11-01: FIXED** (unit display decided: ৳ via `formatBdt`). All 7 code sites converted; static illustrative strings in demo data left as copy.

- `stay/page.tsx:72`, `stay/[slug]/page.tsx:113,143`, offers + homepage hardcode `৳` + `toLocaleString(en-US)` instead of `formatBdt(lang)`.
- `StickyMobileCTA.tsx:25` hardcoded `৳` + `toLocaleString()`, ambiguous units.
- `money.ts:61-64` `formatBdt` handles `bn` digits correctly; booking flow uses it.
- Fix: route every price through `formatBdt(lang)`; decide unit display (৳ vs BDT) once.

## Performance / images

- `_images.ts:6-8` + `next.config.ts:54-85` `next/image` blur/sizes/lazy + AVIF/WebP — good.
- Heavy 1600–2000w Unsplash remotes — replace with sized local/CDN images per brand before launch; add `fetchpriority` for hero, lazy below fold.

## Unresolved

- Stripe FX disclosure: selector says `charged in USD` but rate/total-in-USD display not verified (`StripePaymentButton` body not read).
- `InteractiveReachMap`/`AreaGuideMap` keyboard operability not inspected (map embeds, lower priority).
- Admin/RMS screens excluded; only public booking/marketing audited.
- Real-device contrast/talkback testing not performed; ratios computed, not measured.

# Design System & Visual Specification Guide

## Design Tokens & Theme Configuration

| Token | Value | Tailwind / CSS Variable Mapping |
| :--- | :--- | :--- |
| **Primary** | Deep Teal `#0D5C63` | `--color-primary`, `bg-primary`, `text-primary` |
| **Accent** | Warm Sand `#F4E4C1` | `--color-accent`, `bg-accent`, `text-accent-foreground` |
| **Secondary** | Forest `#2D6A4F` | `--color-secondary`, `bg-secondary`, `text-secondary` |
| **Display Font** | "Playfair Display" / "Fraunces" | `--font-display`, `font-display` |
| **Body Font** | "Inter" / "DM Sans" (Fallback: "Noto Sans Bengali") | `--font-sans`, `font-sans` |
| **Card Radius** | `12px` (`0.75rem`) | `--radius-card`, `rounded-card` |
| **Button Radius** | `9999px` (Pill format) | `--radius-button`, `rounded-full` |
| **Section Padding** | `clamp(3rem, 8vw, 6rem)` | `--section-padding`, `py-section` |

---

## Visual Principles

1. **Quiet Concierge Aesthetic**:
   - Sophisticated, serene, and uncluttered layout that conveys luxury hospitality.
   - Avoid aggressive SaaS badges, noisy neon accents, or distracting popups.
2. **Minimal & Fast-Loading Interfaces**:
   - Strictly no heavy CSS backdrops, intense glassmorphism, or multi-layered box shadows that hinder mobile GPU rendering performance.
   - High-contrast, clean surfaces with crisp typography and generous whitespace.
3. **Mobile-First Ergonomics (360px Baseline)**:
   - Every layout is designed bottom-up for touch interactions on 360px wide viewports.
   - All tap targets are at least 44x44px.
4. **Contextual Trust Signals**:
   - Display verified guest reviews, secure MFS payment badges (bKash, Nagad), and direct phone/WhatsApp contact triggers adjacent to every booking CTA.

---

## Travel Component Inventory & Responsive Specification

### 1. HeroSearchBar
- **Description**: Prominent search bar enabling date selection, room type, and guest capacity choices.
- **Mobile Behavior (360px)**: Collapses into a vertical stacked card layout. Input fields stack cleanly with 100% full-width trigger buttons.
- **Desktop Behavior**: Horizontal floating bar spanning across the lower third of the hero banner with integrated inline popovers.
- **Exact CTA Placement**: Bottom of the stacked card on mobile; rightmost inline action button on desktop.

### 2. DestinationCard
- **Description**: Card component representing a regional travel destination or resort location with image cover, tag, and key highlights.
- **Mobile Behavior (360px)**: Full-width stacked card with fixed 16:9 aspect ratio image header, overlay badge, and single CTA button.
- **Desktop Behavior**: Grid card (3-column layout on wide screens) with subtle hover scale effect on image container.
- **Exact CTA Placement**: Bottom right corner of the card footer ("Explore Destination").

### 3. BookingStepper
- **Description**: Multi-step reservation wizard (Dates & Guests -> Guest Contact -> Payment Gateway -> Confirmation).
- **Mobile Behavior (360px)**: Simplified top step indicator displaying step number ("Step 2 of 4") and progress bar. Single-column input fields with sticky bottom navigation bar.
- **Desktop Behavior**: Horizontal progress timeline with step titles and icons. Split view with sticky booking summary sidebar on the right.
- **Exact CTA Placement**: Fixed sticky bottom bar on mobile viewports ("Continue to Payment"); bottom right of step box on desktop.

### 4. RoomCard
- **Description**: Accommodation unit card displaying bed configuration, square footage, amenity icons, nightly rate in BDT, and availability.
- **Mobile Behavior (360px)**: Vertical stack with swipeable/scrollable image gallery, badge triggers, and full-width price CTA row.
- **Desktop Behavior**: Horizontal split card (image left 45%, details right 55%) or grid card in multi-room listings.
- **Exact CTA Placement**: Bottom right section of card ("Reserve Room" pill button).

### 5. TrustBar
- **Description**: Social proof and security bar highlighting local MFS payment compliance (bKash/Nagad), Instant Confirmation, and 24/7 Concierge Support.
- **Mobile Behavior (360px)**: Horizontal scrolling snap carousel or 2x2 grid with compact icon-and-label pairs.
- **Desktop Behavior**: Single horizontal row centered across the page width.
- **Exact CTA Placement**: Non-interactive or secondary trigger ("Learn about our guarantees").

### 6. StickyMobileCTA
- **Description**: Persistent lower bar on room/destination detail pages allowing fast checkout initiation without scrolling back to top.
- **Mobile Behavior (360px)**: Fixed to viewport bottom with high z-index, displaying summary room rate on left and "Book Now" CTA on right.
- **Desktop Behavior**: Hidden (`hidden md:hidden`) as desktop layouts utilize the sticky right sidebar.
- **Exact CTA Placement**: Right-aligned pill button inside the fixed bottom bar.

---

## Network & CDN Infrastructure Constraint: Cloudflare DNS-Only Mode

### Requirement
Cloudflare proxies **must remain turned off** (DNS-Only / Gray Cloud mode) for all client domains deployed with this scaffold.

### Rationale & BDIX Considerations
In Bangladesh, local internet service providers (ISPs) route traffic through BDIX (Bangladesh Internet Exchange) peering connections for low latency (<10ms). When Cloudflare CDN Proxy (Orange Cloud) is activated, traffic from Bangladeshi mobile operators and ISPs is frequently routed through Cloudflare edge nodes in Singapore or India before reaching Bangladeshi origin servers. This international round-trip introduces significant network latency (100ms - 250ms) and can bypass direct BDIX optimization.

By maintaining Cloudflare in **DNS-Only mode**, domain queries resolve directly to the local BDIX-connected VPS IP address, guaranteeing the fastest possible connection speeds for domestic 4G travelers.

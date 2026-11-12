# Project Description: Reusable Travel Website Scaffold (Bangladeshi Resorts & Hotels)

## Overview
This project is a production-grade, white-label, reusable travel website scaffold designed specifically for Bangladeshi resorts, luxury boutique hotels, and tour operators. The scaffold is built as an extensible, high-performance web application template that can be deployed repeatedly for different clients. Each deployment requires updates only to the `src/components/brand/` directory and localized content strings.

The primary target audience consists of domestic Bangladeshi travelers accessing the platform over mobile 4G network infrastructure. Consequently, ultra-fast initial page loads, aggressive image optimization, BDIX-friendly bandwidth constraints, and mobile-first touch ergonomics are foundational architecture goals. The visual aesthetic reflects a "quiet concierge" feel—a premium, serene, and trustworthy travel guide rather than an overcrowded SaaS dashboard.

---

## Target Users & Stakeholders

1. **End-User Travelers (Domestic Bangladeshi Market)**
   - Accessing primarily via smartphones (360px to 412px viewports) on 3G/4G networks.
   - Seek fast visual discovery of resort amenities, room details, and transparent pricing in Bangladeshi Taka (BDT ৳).
   - Prefer seamless local payment options including Mobile Financial Services (bKash, Nagad) and cards (SSLCommerz).
   - Require bilingual interface capabilities (Bengali and English).

2. **Resort & Hotel Owners / Administrators**
   - Seek a bespoke, luxury digital identity without custom software engineering overhead for every property.
   - Require real-time availability management, booking confirmation workflows, and automated customer email communications.
   - Expect low operational maintenance, high reliability, and simple deployment procedures on local BDIX VPS providers.

---

## Core Booking Flow

1. **Discovery & Search**:
   - Guests land on property homepage or destination overview.
   - Use `HeroSearchBar` to select check-in/check-out dates, guest counts, and desired accommodation features.
2. **Room & Package Selection**:
   - Guests browse `RoomCard` and `DestinationCard` items showcasing high-definition optimized images, capacity, pricing, and amenities.
3. **Reservation & Multi-Step Booking**:
   - Guests launch the `BookingStepper` process:
     - **Step 1**: Dates & Guest Count confirmation.
     - **Step 2**: Guest Details (Name, Phone Number, Email, Special Requests).
     - **Step 3**: Payment Gateway Selection (bKash, Nagad, or SSLCommerz).
4. **Payment Processing & Verification**:
   - System initiates MFS charge / SSLCommerz gateway session.
   - Webhooks handle asynchronous payment state confirmation and store immutable payment logs.
5. **Confirmation & Notification**:
   - Guest is redirected to `/booking/confirmation/[id]` with full invoice summary and QR check-in voucher.
   - Resend API dispatches branded transactional HTML emails to the guest and resort reservation desk.
6. **Admin Management**:
   - Resort managers inspect booking requests, adjust calendar availability, and confirm manually verified payments via `/admin`.

---

## Core Data Model

- **Destination / Property**:
  - `id`, `slug`, `name`, `tagline`, `description`, `location`, `heroImage`, `galleryImages`, `rating`, `amenities`, `featured`.
- **Room**:
  - `id`, `destinationId`, `title`, `slug`, `pricePerNight`, `maxGuests`, `bedType`, `sizeSqFt`, `images`, `amenities`, `availableUnits`.
- **Guest**:
  - `id`, `fullName`, `email`, `phone`, `nidOrPassport`, `address`.
- **Booking**:
  - `id`, `bookingCode`, `roomId`, `guestId`, `checkInDate`, `checkOutDate`, `totalAmount`, `status` (`PENDING`, `CONFIRMED`, `CANCELLED`, `COMPLETED`), `createdAt`.
- **Payment**:
  - `id`, `bookingId`, `provider` (`BKASH`, `NAGAD`, `SSLCOMMERZ`), `transactionId`, `amount`, `status` (`INITIATED`, `SUCCESS`, `FAILED`), `rawWebhookPayload`.

---

## Page Inventory

- `/` - White-label resort landing showcase featuring hero search, trust signals, featured rooms, and curated experiences.
- `/destinations` - Filterable grid of regional destinations / resort zones.
- `/destinations/[slug]` - SSG+ISR detail page with room options, photo gallery, location map, and direct booking triggers.
- `/book/[roomId]` - Multi-step booking stepper with real-time price calculation.
- `/booking/confirmation/[id]` - Booking confirmation, status verification, and downloadable check-in pass.
- `/admin` - Secure admin overview for reservations, guest lists, and room availability toggles.
- `/style-guide` - Comprehensive design token visual contract rendering all brand components, base UI elements, and travel component shells.

---

## Integrations

- **bKash Direct Gateway API**: Native MFS payment tokenization, payment creation, execution, and query API.
- **Nagad Merchant API**: Direct payment checkout URL generation and callback verification.
- **SSLCommerz Gateway**: Comprehensive Bangladesh credit card, debit card, and Internet banking aggregation.
- **Resend API**: Transactional email delivery for instant booking confirmation receipts and staff alerts.
- **Cloudflare R2**: High-speed object storage for resort media assets, optimized via custom CDN domain.

---

## Explicit Out-of-Scope Items (v1)

- **Native Android / iOS Application Code**: Mobile app builds are deferred to future phases (a Capacitor wrapper note is retained under Future Work).
- **Multi-Currency FX Engine**: v1 strictly targets BDT (৳) pricing for domestic travelers.
- **Offline Sync Engine**: Requires online network connection for live room availability checks.
- **Custom Native PMS Replacement**: Heavy accounting/channel management software is excluded; v1 focuses on booking capture and inventory reservation.

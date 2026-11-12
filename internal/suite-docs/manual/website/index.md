# The Website — Staff Training Module

**What:** the public site guests see — rooms, booking, stories, and
everything that brings them to the front desk.
**Audience:** all staff (know what guests see before they arrive).
**Time to complete:** about 20 minutes.

## Learning objectives

After this module you can describe the guest's journey from first visit
to confirmed booking, and know which site sections feed which operational
screens.

## 1. What the site is

The property's direct-booking website: no middleman, no commission. Every
page has one job — turn a visitor into a guest. The sections:

| Section | Docs | What it's for |
|---|---|---|
| **Booking** | [Booking Journey](booking/) | Rooms, the booking stepper, payment, confirmation |
| **Explore** | [Explore](explore/) | Destinations, experiences, dining, gallery, offers |
| **Plan** | [Plan Your Visit](plan/) | About, contact, how to reach, FAQ, reviews |
| **Stories** | [Stories](stories/) | Blog, guest stories, press |
| **Policies** | [Policies](policies/) | Terms, privacy, refund policy |

## 2. The golden rule

**The website is a promise; operations keep it.** Every room photo, every
amenity listed, every "5 minutes from the beach" — a guest will arrive
expecting it. If reality changes (the pool is closed, the restaurant
hours shifted), the site must change the same day. An outdated promise is
a bad review waiting to happen.

## 3. How the site connects to operations

- **Bookings** made on the site appear in [Bookings](../bookings/) —
  same records, same statuses, same folios.
- **The contact form** POSTs to `/api/contact`: the lead is saved and a
  Resend alert goes to the resort team (with the demo banner on demo
  installs). **Phone is required** — a lead without a phone is a lead you
  can't call.
- **Guest stories** submitted on the site land in the [blog moderation
  queue](../blog/pending/) — same approval flow as staff posts.
- **Payments** on the site run through the configured gateways (see
  [Payments settings](../settings/payments/)) — the site never touches
  money directly.

## 4. The demo banner

On demo installs, **every public page carries the demo banner** and every
outgoing email carries the demo notice. It comes off for production —
that's the founder's call, not the staff's.

## 5. Troubleshooting

| Symptom | Check first |
|---|---|
| Site shows old room prices | The [room type's price](../rooms/edit/) changed — the site reads it live. Check caches/CDN. |
| Contact form submissions going nowhere | The alert goes to the settings contact email — is it still a placeholder? |
| Booking fails on the site | Same booking engine as the admin — check availability, gateway status, and the [system health](../system/) page. |

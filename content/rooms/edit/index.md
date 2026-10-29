# Room Edit — Staff Training Module

**Page:** `/admin/rooms/[id]` and `/admin/rooms/new` — managing a room type.
**Audience:** managers, owners.
**Time to complete:** about 15 minutes.
**Prerequisite:** the [Rooms](..) module.

## Learning objectives

After this module you can create a room type, price it, and manage its
physical units safely.

## 1. The Details tab

- **Title, destination, slug** — the slug is the URL piece; keep it
  stable once published.
- **Bed type, max guests** — max guests is enforced at booking time.
- **Price per night** — the single source for quotes, folio charges, and
  revenue math. Change it deliberately: it prices every future night from
  the moment you save.
- **Description and photos** — what guests read and see on the website.
- **Active flag** — inactive types vanish from the booking form but keep
  their history.

## 2. The Units tab

The physical rooms: unit numbers (TV-1…), status, and **live booking
counts** per unit. Adding/removing units needs the elevated permission —
and the live counts are why: **never remove a unit with future bookings**;
the count column tells you which are safe.

Units also carry the maintenance/out-of-order states that take them out
of sale (see [Housekeeping](../../housekeeping/) and the daily sheet's
room grid).

## 3. Pricing discipline

The price per night is the most leveraged number in the system — one field
drives quotes, folios, ADR, and RevPAR. Change it with the same care as a
cash count: deliberately, once, and with the manager's awareness. Seasonal
pricing (if used) belongs in the rate logic, not in daily edits of this
field.

## 4. Troubleshooting

| Symptom | Check first |
|---|---|
| New room not bookable | Is it active? Inactive types don't show in the booking form. |
| Can't remove a unit | It has live future bookings — the count column shows it. Reassign those bookings first. |
| Website shows old photos | Check you saved; then check the site cache/CDN. |

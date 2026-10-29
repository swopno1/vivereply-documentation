# Rooms — Staff Training Module

**Page:** `/admin/rooms` — the property's room types.
**Audience:** managers, front desk (primary readers).
**Time to complete:** about 15 minutes.
**Prerequisite:** none.

## Learning objectives

After this module you can read the room list and know where room data is
managed.

## 1. What the page is

One card per **room type** (not physical unit): hero photo, destination,
title, bed type, **max guests**, **price per night**, unit count, and how
many units are out of service.

**Room type vs unit — the distinction that runs the property:** the *room
type* (Terracotta Villa, ৳14,500/night, max 4) is what guests book and what
pricing attaches to. The *unit* (TV-1, TV-2…) is the physical room with a
housekeeping state. Bookings hold a room type; at check-in they get a unit.

## 2. Sub-page

| Page | Docs | What it's for |
|---|---|---|
| `/admin/rooms/[id]` (and `/admin/rooms/new`) | [Room Edit](edit/) | Creating and editing room types and their units |

**Note:** there is no read-only room page — opening a room means editing
it (ROOMS.edit permission; ROOMS.create for new).

## 3. How rooms connect

- **Bookings** hold the room type; the new-booking form lists active types
  with prices and max guests.
- **Units** carry the housekeeping state → readiness badges, the
  housekeeping board, the daily sheet's room grid.
- **Price per night** is the base of every quote, folio room charge, and
  the ADR/RevPAR math.
- **Max guests** is validated at booking time.

## 4. Troubleshooting

| Symptom | Check first |
|---|---|
| Room missing from booking form | Only active room types show — check it's active. |
| Price looks wrong on quotes | The room type's price per night is the source — fix it here. |
| Can't open a room | You need ROOMS edit permission — opening is editing. |

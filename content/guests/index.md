# Guests — Staff Training Module

**Page:** `/admin/guests` — everyone who has stayed or booked.
**Audience:** front desk (primary), managers.
**Time to complete:** about 15 minutes.
**Prerequisite:** none.

## Learning objectives

After this module you can find any guest, read their history, and know
what guest data the property keeps.

## 1. What the page is

The guest directory: every person with a booking, newest first, 20 per
page. **Search matches name, email, or phone** — the same fragments you
use on the bookings page. Sort by most frequent, most recent, most spent,
or most recent stay; filter to All, Returning, New, or VIP.

Each row shows guest name, phone, email, **total stays**, **last stay**,
and **member since** — at a glance: is this a first-timer or a regular?
**Last stay** is the check-in of their latest *real* stay (checked in or
completed) — upcoming bookings never count, so the date is always in the
past. The full **booking history** (contact plus reservation rows, newest
first) opens in a dialog via the row's **View history** button.

## 2. What the property keeps per guest

- **Name, phone, email** — captured at booking; the phone is the
  operational key (front-desk dialing, Chatbot verification).
- **NID/passport, address** — display-only in admin: no screen collects
  or edits them; they arrive via the website booking form (*"not
  provided"* until then). Chase the guest directly — they are required
  for the property's records.

## 3. How guests connect

- **Bookings** belong to guests — one guest, many stays over time.
- **Folios** charge the guest's stay; **payments** tie to their bookings.
- **Chatbot** verifies by the stored phone/email and sends details to
  the stored email.
- The booking detail's guest card reads this record — keep it accurate
  and it stays accurate everywhere.

## 4. Discipline

- **One record per person.** Guests are created automatically with their
  bookings — there is no manual guest creation. Before each new booking,
  search — duplicates split history and break the "regular guest" read.
- **Phones are sacred.** A wrong digit means a missed arrival call and a
  failed verification. Read it back at check-in.
- **Privacy.** Guest data is the property's most sensitive data. It never
  leaves the system except through the property's own channels (confirmation
  emails, receipts) — never personal phones, never social media.

## 5. Troubleshooting

| Symptom | Check first |
|---|---|
| Two records for one guest | There is no merge — search before each new booking so duplicates never split history. |
| Missing NID/passport | No admin field collects it — it arrives via the website booking form. Chase the guest directly. |
| Can't find a guest | Try phone fragment — it's the most reliable key. |

# Front Desk — Staff Training Module

**Page:** `/admin/front-desk` — the desk's daily operations screen.
**Audience:** front-desk staff (primary), managers.
**Time to complete:** about 25 minutes reading, then one supervised shift.
**Prerequisite:** the Admin Dashboard module (business day, statuses, KPIs).

## Learning objectives

After this module you can:

- Explain the three lists (Arrivals, Departures, In-house) and exactly which
  bookings appear in each — and which don't.
- Read a stay card: guest, room and unit, dates, readiness badge, overdue flag.
- Run the arrival workflow for every status, including unpaid and
  payment-under-review bookings.
- Run the departure workflow and hand clean units to housekeeping.
- Spot and handle overdue checkouts.
- Know where the four nav buttons (Daily Sheet, Housekeeping, Cash, Night
  Audit) take you and when to use each.

## 1. Getting here

Open **Front Desk** from the admin sidebar, or go to `/admin/front-desk`
directly. It requires the *front desk view* permission.

**No money on this page — by design.** The front desk role has no finance
access, so this page is purely operational: people, rooms, and timing. Money
lives on the booking record (open it) and on the dashboard (finance roles).
If a guest asks "how much do I owe?", open their booking — don't guess from
this page.

## 2. The header

The top shows the title, the **business day** (long date) and the property
time zone — the same business-day concept as the dashboard. Everything below
is for *that* day.

Below the header are four buttons — your doorways to the desk's tools:

| Button | Opens | When to use it |
|---|---|---|
| **Daily Sheet** | `/admin/front-desk/daily-sheet` — the day's full operational sheet | Your end-of-day close and the manager's morning review |
| **Housekeeping** | `/admin/housekeeping` — room cleanliness board | To check whether an arrival's room is actually ready (shown only when the housekeeping module is on) |
| **Cash** | `/admin/front-desk/cash` — cash shifts and drawer | Start/end of your cash shift; recording desk takings |
| **Night Audit** | `/admin/front-desk/night-audit` — the day-close | End of day; only if you are authorized to close |

Learn these four locations on day one — half of front-desk work is knowing
which door to walk through.

---

## 3. Arrivals today

### What it is

Every guest who *may* walk in today: bookings with check-in date = today in
status Pending, Payment-under-review, Confirmed, or already Checked-in —
**plus** earlier arrivals the night audit deliberately kept (guests still on
their way from a previous day).

### How to read it

Each stay card shows, top to bottom:

- **Guest name** and status badge (see §7).
- **Room type · Room (unit) number** — e.g. *Terracotta Villa · Room 101*.
  *No room assigned* means the booking has no unit yet: assign one before the
  guest arrives (open the booking).
- **Readiness badge** (only when the housekeeping module is on): the unit's
  cleanliness — **Dirty** (red), **Clean** (blue), **Inspected** (green).
  Only *Inspected* is truly ready for check-in. A red or blue badge on an
  arrival is your cue to chase housekeeping *now*, not at 15:00.
- **Dates → nights** and **guest count** (the little person icon).
- **Booking code** (mono text) — the reference you'll use on the phone.
- **Call** button — dials the guest's phone directly. Use it.
- **Open booking** button — the full record: payments, folio, timeline.

### What to do — the arrival workflow

Work this list **before** the afternoon rush, top to bottom:

1. **Confirmed + room assigned + inspected** — nothing to do; it's ready.
2. **Confirmed + no unit** — assign a unit (open the booking).
3. **Confirmed + Dirty/Clean badge** — message housekeeping with the unit
   number and the guest's ETA.
4. **Pending (unpaid)** — contact the guest *today*: take payment or cancel
   per policy. An unpaid arrival held overnight blocks a sellable unit.
5. **Payment under review** — check the Bangla QR verification queue first;
   do not check the guest in as "paid" until the payment is verified.
6. **Already checked in** — they're here; nothing to do.

**Escalate to the manager:** a guest who can't be reached and hasn't paid by
mid-afternoon; any overbooking risk (more confirmed arrivals than ready
units); a VIP arrival with unresolved requests.

---

## 4. Departures today

### What it is

Bookings checking out today: check-out date = today, status Checked-in or
already Completed (departed).

### What to do — the departure workflow

1. **Settle the folio first.** Open the booking, confirm every charge is
   posted and the balance is zero (or the agreed arrangement is recorded).
   Never check out a guest with an unexplained balance — fix it now, not
   after they've left.
2. **Check out** in the booking record. The unit's cleanliness flips to
   **Dirty** automatically — that is the signal to housekeeping, not a phone
   call you need to make (though a heads-up on heavy days helps).
3. **Heavy departure + heavy arrival days** are the day's bottleneck: warn
   housekeeping by mid-morning with the unit list. The manager should know
   too — this is the one day-part that routinely needs extra hands.

---

## 5. In-house

### What it is

Everyone checked in **right now**, ordered by earliest checkout first.

### How to read it

This is your "who is in the building" list — the count feeds the dashboard's
In-House KPI and, in an emergency, the evacuation reconcile. The ordering
(earliest checkout first) doubles as tomorrow's departure preview: the top of
this list is tomorrow's work.

### The OVERDUE flag

A stay marked **Checkout overdue** (red text) is checked in *past* its
check-out date. **What to do:**

1. Find out why — did the guest extend (then extend the booking properly so
   charges keep posting), or did check-out simply never get recorded (then
   record it)?
2. An unrecorded overstay blocks the unit from sale and skews occupancy.
   Fix the record the same shift.
3. If the guest is still in the room and won't leave or pay, escalate to the
   manager immediately — do not handle confrontations alone.

---

## 6. Status badges on this page

| Badge | Meaning | Your action |
|---|---|---|
| **Pending** (amber) | Created, unpaid | Collect payment or cancel — today |
| **Payment under review** (amber) | Bangla QR receipt awaiting verification | Verify in the payments queue before treating as paid |
| **Confirmed** (green) | Paid/approved, arriving | Prep the arrival (room, requests) |
| **Checked-in** (blue) | In the building | Normal operations |
| **Completed** (grey) | Stay finished | Historical |
| **No-show** (orange) | Never arrived | Charge per policy, close the booking |

---

## 7. The five-minute desk routine

**Start of shift:**

1. Open Front Desk — confirm the business day.
2. Scan **Arrivals**: count the statuses. Unpaid or unverified ones get
   contacted first.
3. Check readiness badges on today's arrivals — chase housekeeping on
   anything not Inspected.
4. Glance at **In-house** for overdue flags.

**End of shift:**

1. Departures all checked out with settled folios?
2. Cash drawer reconciled (via the Cash page)?
3. Hand over in writing: remaining arrivals, open alerts, any guest issues.

## 8. Troubleshooting

| Symptom | Check first |
|---|---|
| An arrival is missing | Wrong business day? Or the booking is Cancelled/No-show (those don't list). |
| "No room assigned" on many arrivals | Units were never assigned — open each booking and assign. |
| Readiness badge missing | Housekeeping module off, or no unit assigned yet. |
| Guest says they paid but badge says Pending | Check the booking's payments; online webhooks can lag a minute. Don't take their word alone — verify. |
| Overdue flag on a guest who left | Check-out was never recorded — record it now. |
| Page shows yesterday | Night audit hasn't closed the day yet (~04:00). Normal. |

## 9. Where this page's data comes from (for the curious)

One query (`loadFrontDeskToday`) pulls bookings for the business day with
guest, room, and unit attached — no money tables, which is why the page loads
fast and shows no financials. The readiness badge reads the unit's
housekeeping state, shared with the Housekeeping board: both pages always
agree, because it's the same field. Statuses flow from the booking lifecycle
(see the Data-Flow Reference).

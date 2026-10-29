# Admin Dashboard — Staff Training Module

**Page:** `/admin` — the first screen after login.
**Audience:** front desk, managers, finance, owners.
**Time to complete:** about 30 minutes reading, then one supervised shift.

## Learning objectives

After this module you can:

- Explain what the business day is and why every number on the page follows it.
- Read every KPI card: what it measures, where its data comes from, and what
  "normal" looks like.
- Work the Attention Required list: what each alert means and who handles it.
- Read the payments breakdown and export it.
- Use the Recent Bookings table and the Upcoming Arrivals list in daily work.
- Know exactly when a number is worth escalating — and to whom.

## 1. Getting to the dashboard

Log in at `/admin/login`. After a successful login the system sends you to
`/admin` automatically — unless your role is not allowed to see the dashboard,
in which case you land on the first page your role *is* allowed to see (for
example, a housekeeping-only login lands on Housekeeping).

**Who sees what.** The dashboard itself requires the *view reports*
permission. The money cards (Revenue, Month-to-date, Payments by method) additionally
require the *view finance* permission. If your screen shows occupancy and
arrivals but no money figures, that is intentional — your role is not cleared
for financial data. Do not ask a colleague to screenshot money figures for
you; ask your manager about a role change instead.

**Loading behaviour.** The page header appears first, then each section fills
in on its own as its data arrives. On a slow connection you will see grey
placeholder blocks for a few seconds. That is normal — wait for the section
you need rather than reloading the page.

---

## 2. The header: Business day and Time zone

At the top of the page, under the title *Dashboard Overview*, you will see a
line like:

> **Business day:** Thu, 30 Oct 2026 · **Time zone:** Asia/Dhaka

### What it is

The single most important line on the page. Every KPI, every table, every
alert below is computed **for this business day** — not for "right now".

### What "business day" means

A hotel day does not end at midnight. Guests are still asleep, the night
auditor is still working, and a booking made at 01:30 belongs to *yesterday's*
business. The business day therefore rolls over in the early morning (around
04:00 property time) when the **night audit** closes the previous day. Until
that close happens, the dashboard keeps showing yesterday.

### How to use it

- **Always read this line first** when a number looks wrong. "Why does it
  still say yesterday's date at 02:00?" — because the night audit hasn't
  closed the day yet. That is correct behaviour, not a bug.
- The time zone tells you whose clock the system follows. Ours is
  Asia/Dhaka. If it ever shows anything else, tell your manager — it is a
  property setting, not something staff change.

### Where it comes from

The business day is stored by the system and advanced only by the night
audit (automatic) or a manual day-close by an authorized user. The time zone
comes from property settings (Settings → General).

---

## 3. KPI row 1 — Money and occupancy

Four cards. The two money cards appear only for roles with finance permission.

### 3.1 Revenue Today

**What it is.** Cash collected today — the headline money number.

**How to read it.** The big figure is the *net*: money received minus refunds
given. Underneath, in smaller text, you see the two parts: *Received* (gross
money in) and *refunds* (money paid back out).

> Example: big figure **৳45,000**, small text *Received ৳50,000 · refunds
> ৳5,000* means ৳50,000 arrived today and ৳5,000 was refunded today.

**What it means — and what it does NOT mean.** This is **cash collected**,
not earned revenue and not bookings value:

- A guest who paid online yesterday for a stay next week counted
  *yesterday*, when the money arrived — not today.
- A confirmed booking that hasn't paid yet counts **zero**.
- A refund counts on the day the refund was completed, even if the original
  payment was weeks ago.

If "Revenue Today" looks low on a busy day, the usual reason is that most of
today's arrivals prepaid days ago. That is healthy, not alarming — check
*Booked Value* (section 5) for the pipeline view.

**Where it comes from.** Online payments recorded by the payment gateways
(bKash, Nagad, SSLCommerz, Bangla QR, Stripe) on the day the money arrived,
plus cash/card taken at the front desk and recorded on the guest folio, minus
completed refunds from each gateway and desk refunds. Desk takings are
attributed by **business date**, so a cash payment taken at 01:00 lands on the
correct business day.

**What to do with it.** Front desk: compare it at end of shift against your
cash drawer and the day's receipts — they should reconcile. Any unexplained
gap goes to the manager **the same shift**, not tomorrow. Finance/owner: watch
the trend across days, not single-day spikes — one group checkout can double a
day.

### 3.2 Revenue This Month

**What it is.** Exactly the same cash-collected definition as Revenue Today,
summed from the 1st of the month through today.

**How to use it.** Your month-to-date scoreboard. Compare it against the same
point last month (ask finance for the comparison) to see whether the property
is ahead or behind. A single number never tells the whole story — read it
together with Occupancy and ADR below.

### 3.3 Occupancy Today

**What it is.** The share of sellable units occupied **tonight**.

**How to read it.** Big figure is a percentage; the small text says, for
example, *14 of 19 units occupied*.

**How to analyse it.**

- **Near 100%** on a future date means stop worrying about filling rooms and
  start protecting rate — no discounts, upsell the remaining units.
- **Persistently under 40%** on near-term dates is a demand problem: tell the
  manager, who may adjust pricing or promotions.
- **0% with "No bookable units set up yet"** means the inventory isn't
  configured — an admin task, not a sales problem.

**Where it comes from.** Occupied tonight = bookings currently checked in
against a unit, divided by *bookable* units (units that are active, not
archived, and in service — maintenance/out-of-order units are excluded from
both sides of the fraction).

### 3.4 Available Units Tonight

**What it is.** How many units you can still sell for tonight, summed across
room types.

**How to use it.** This is the front desk's most practical number after
midnight-business: it answers "can I still take a walk-in?" If it is 0, you
are full — say so confidently and offer the waitlist or the nearest
alternative dates. The figure comes from actual unit availability, not from a
hand-maintained counter, so trust it over anyone's memory.

---

## 4. KPI row 2 — Movement

### 4.1 Arrivals Today

**What it is.** Guests expected to check in today (their check-in date is the
current business day).

**How to read it.** Big figure = expected arrivals; small text = how many
have *already* checked in (e.g. *9 arrivals, 4 checked in*).

**How to use it.** This is your shift plan. Before the afternoon rush, open
each arrival's booking and confirm: room assigned, rate correct, special
requests noted, payment status. The gap between the two numbers is your
remaining workload. A large gap late in the evening deserves a round of
confirmation calls — no-shows cost a night you could have resold.

### 4.2 Departures Today

**What it is.** Guests due to check out today, with how many already have.

**How to use it.** Coordinate with housekeeping: every checked-out unit needs
cleaning before it can be sold again (see the Housekeeping module). If
departures are heavy and arrivals are heavy, warn housekeeping early — that
is the day's bottleneck, and the manager should know by mid-morning.

### 4.3 In-House

**What it is.** Guests checked in *right now* — the number of occupied stays
at this moment.

**How to use it.** Your "who is in the building" figure. It feeds occupancy,
and in an emergency (fire, evacuation) this is the count you reconcile
against. It changes only on check-in and check-out — if it looks wrong, one
of those two actions was missed or done on the wrong booking.

### 4.4 Pending Verifications

**What it is.** Bangla QR payments waiting for staff review.

**How to read it.** Each unit is one guest payment made by QR that the system
could not auto-verify and parked for a human.

**What to do.** This is **front-desk action work**, not passive information:
open each one, match it against the bank statement/notification, then approve
or reject. Work this queue to zero at least twice a day — a guest whose
payment sits unverified may be told their booking is unpaid. If a payment
can't be matched, escalate to the manager; never approve on guesswork.

**Where it comes from.** Bookings stuck in *pending manual verification*
status after a Bangla QR receipt submission.

---

## 5. Month to date

Three cards plus an occasional warning line, all visible only with finance
permission.

### 5.1 Booked Value This Month

**What it is.** The total value of *sold bookings checking in this month* —
the pipeline, not the cash.

**How to read it with Revenue This Month.** The two cards answer different
questions: *Booked Value* = "how much business did we sell for this month?",
*Revenue* = "how much cash has actually arrived?" A big booked value with
small revenue means money is still outstanding — chase prepayments. Similar
figures mean collection is healthy.

### 5.2 ADR (Average Daily Rate)

**What it is.** Room revenue divided by room-nights sold, month to date.
Plainly: the average price each sold night actually fetched.

**How to analyse it.** ADR is your pricing-health gauge. Falling ADR with
steady occupancy means you are discounting too much; rising ADR with falling
occupancy means you may be priced out of the market. Note: our ADR is
computed **gross of discounts** — a discounted night still counts at its
charged rate in the underlying revenue, so read it alongside promotion
activity. Shows "—" when no room-nights have been sold yet.

### 5.3 RevPAR (Revenue Per Available Room)

**What it is.** Room revenue divided by *available* unit-nights — the single
number that combines occupancy and rate.

**How to analyse it.** RevPAR is the number owners care about most. It rises
when you fill more rooms *or* charge more per room, and it punishes empty
rooms even at high rates. Track its trend month to month; a one-day value
means little.

### 5.4 The amber warning line

Occasionally you will see: *"N part-paid desk sales this month are not
counted: the amount received is not recorded."*

**What it means.** Some desk sales were recorded as part-paid without the
received amount being entered, so the system honestly excludes them from
revenue rather than guessing. **What to do:** find those folios (ask finance
or your manager where to look) and complete the payment entries. The warning
disappears once the amounts are recorded. Do not ignore it — it means revenue
is understated.

---

## 6. Attention Required

An amber card that appears **only when something needs action**. No card, no
problems — that is the normal state. It lists two kinds of alerts, each with
a button taking you straight to the fix.

### 6.1 "Room X has no units available tonight"

**What it means.** An active room type is completely sold out for tonight
(computed from real units, not estimates).

**What to do.** Usually: nothing, it's information — but check *why* if it
surprises you. If a room type shows zero while you believe units are free,
units may be wrongly marked out-of-order or stuck dirty — check with
housekeeping, then the manager. The *Manage Room* button opens the room's
admin page.

### 6.2 "Unpaid booking RES-… (Guest Name) is older than 24h"

**What it means.** A booking was created more than 24 hours ago, is still in
*Pending* (unpaid), and the system held it past the normal expiry. Only the
20 oldest are shown.

**What to do — this is front-desk work:**

1. Open the booking (*Review Booking* button).
2. Contact the guest: request payment today or confirm cancellation.
3. If the guest pays, complete the payment flow; if not, cancel per the
   cancellation policy so the unit returns to sale.
4. If the guest is unreachable after reasonable attempts, escalate to the
   manager — do not let stale holds silently eat inventory.

**Why 24 hours matters.** An unpaid hold blocks a unit other guests could
book. Every day it sits, the property loses a potential sale.

---

## 7. Payments by Method

**What it is.** This month's received payments broken down by method — bKash,
Nagad, SSLCommerz, Bangla QR, Stripe, Cash, Other — each showing gross
received and the number of payments. Finance-permission only.

**How to analyse it.**

- **Mix shifts** tell a story: a sudden jump in Cash share may mean the
  online checkout had problems — check with front desk whether guests
  reported payment failures.
- **A method showing volume but the gateway was "down"** that day deserves a
  finance review for double-recording (the same money entered at the desk
  *and* arriving online).
- **Counts vs. amounts:** many tiny payments on one method can signal test
  transactions or split payments worth a glance.

**Export CSV.** The *Export CSV* button downloads the month's payment data
for spreadsheets and the accountant. The export contains the same figures as
the cards.

**Where it comes from.** The same collected-payments data as the Revenue
cards, grouped by provider. Desk takings appear under Cash/Other.

---

## 8. Recent Bookings

A table of the 10 most recently **created** bookings (not by stay date).

**Columns:** booking code (click to open the booking), guest name, room,
check-in date, and a status badge.

### Status badges — learn these cold

| Badge | Meaning | Your action |
|---|---|---|
| **Pending** (amber) | Created, not yet paid | Needs payment or cancellation — see §6.2 |
| **Confirmed** (green) | Paid/approved, stay in future | Nothing until arrival prep |
| **Checked-in** (blue) | Guest is in the building | Normal operations |
| **Completed** (grey) | Stay finished and closed | Historical; nothing to do |
| **Cancelled** (red) | Cancelled, unit released | Nothing, unless a refund is due |
| **No-show** (orange) | Never arrived, never cancelled | Charge per policy, then close |

**How to use the table.** It is your "what just happened" feed. A sudden run
of Pending badges means the payment flow may be failing — try a test booking
yourself or ask front desk. Clicking any booking code opens the full booking
record (guest details, folio, payments, timeline).

---

## 9. Upcoming Arrivals

The next 5 **confirmed** check-ins, soonest first. Each card shows the guest,
room, check-in date, booking code, and a **check-in button** that jumps
straight to that booking for the arrival workflow.

**Daily use.** This list *is* the front desk's tomorrow-morning. Each evening,
walk it: room assigned and inspected? Rate and package correct? Airport
pickup or special requests arranged? Payment complete, or balance flagged for
collection at check-in? Five minutes here prevents most check-in-desk crises.

---

## 10. The five-minute dashboard routine

Do this at the start of every shift. It catches 90% of operational problems
before guests feel them.

1. **Header** — confirm the business day is the day you think it is.
2. **Attention Required** — if the card is there, work every alert now.
3. **Arrivals vs. checked-in** — your remaining workload today.
4. **Pending Verifications** — work the queue toward zero.
5. **Available Tonight** — can you still sell? If zero, switch to waitlist mode.

End of shift: reconcile **Revenue Today** against drawer and receipts; hand
over the arrivals gap and any open alerts to the next shift **in writing**.

## 11. Troubleshooting — "this number looks wrong"

| Symptom | Check first |
|---|---|
| Date seems a day behind | Business day hasn't rolled — night audit closes ~04:00. Normal before then. |
| Revenue low on a busy day | Prepayments counted when received. Check Booked Value for the pipeline. |
| Occupancy 0% unexpectedly | Units may be archived/out-of-order; check Rooms. |
| A card I need is missing | Role permission (finance roles see money cards). Ask your manager. |
| Sections show grey placeholders | Slow connection — wait, don't reload repeatedly. |
| Alert won't clear | The underlying condition is still true (e.g. booking still unpaid). Fix the cause, not the alert. |
| Numbers differ from yesterday's sheet | Sheets run on business date; confirm both views use the same day. |

If none of these explain it, screenshot the card **with the header's business
day visible** and send it to your manager. Never "fix" data by editing
records to make a dashboard number look right.

## 12. Glossary

- **Business day** — the property's operating day; advances when night audit closes it (~04:00).
- **Night audit** — the automatic (and occasionally manual) close-of-day: posts room charges, closes the business date, rolls the books.
- **Collected / Revenue** — cash actually received minus completed refunds.
- **Bookable unit** — a physical room unit that is active, not archived, and in service.
- **ADR** — average daily rate: room revenue ÷ room-nights sold.
- **RevPAR** — revenue per available room: room revenue ÷ available unit-nights.
- **Folio** — a guest's bill: charges, payments, and balance for a stay.
- **Pending verification** — a Bangla QR payment awaiting human review.
- **No-show** — a confirmed booking whose guest never arrived.

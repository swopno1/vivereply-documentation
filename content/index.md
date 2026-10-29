# Vivereply Documentation

**ViveReply is one business solution with two faces** — published at
**docs.vivereply.com**:

| Face | What it is | Start here |
|---|---|---|
| **ViveReply Suite** | The complete package for every hotel/resort: the direct-booking website plus the Resort Property Management System — bookings, front desk, housekeeping, room service, inventory, purchasing, HR, and finance, in one system | [Suite training ↓](#suite-training) |
| **ViveReply Chatbot** | The AI front-office assistant: answers guests, checks live availability, quotes exact prices, drafts bookings, and schedules with clients **like a real staff member** — wired into the Suite's live data (current build: *ViveReply Concierge*) | [Chatbot docs](chatbot/) |

The Suite runs the property. The Chatbot talks to the guest. Together
they're the complete package — and these docs cover both.

This documentation serves two purposes: it's the **staff training
manual** for properties running Vivereply, and the **product
documentation** for everyone working with it.

## Suite training

The Suite docs are organized as training modules — each covers one screen
or workflow: what it is, how to read it, where its data comes from, what
to do, and how to fix it when it breaks.

**New staff:** read the modules in order, starting with the Admin
Dashboard. Each module ends with troubleshooting — the exact checks for
your role. **Trainers:** each card and section follows the same pattern —
*what it is*, *how to read it*, *where the data comes from*, and *what to
do about it*. Use those headings as your lesson plan. **Everyone:** when a
figure looks wrong, go to the *Troubleshooting* section of the relevant
module before escalating. Half of all "wrong numbers" turn out to be a
business-day or filter misunderstanding.

**Start here:** [Signing In](access/) → [Admin Dashboard](admin-dashboard/)
→ [Bookings](bookings/).

**The daily operation:** [Front Desk](front-desk/) (with [Daily
Sheet](front-desk/daily-sheet/), [Cash](front-desk/cash/), [Night
Audit](front-desk/night-audit/)) → [Housekeeping](housekeeping/) →
[Room Service](room-service/).

**The money:** [Finance](finance/) ([Journals](finance/journals/),
[Payables](finance/payables/), [Petty Cash](finance/petty-cash/),
[Reports](finance/reports/)) and [Expenses](expenses/).

**The property:** [Rooms](rooms/), [Guests](guests/),
[Inventory](inventory/), [Purchasing](purchasing/), [HR](hr/),
[Settings](settings/).

**The public face:** [The Website](website/) ([Booking
Journey](website/booking/), [Explore](website/explore/), [Stories](website/stories/),
[Policies](website/policies/)) and the [Blog](blog/).

**The machinery:** [Chatbot Handoffs](concierge-handoffs/), [System
Health](system/), [Audit Log](audit/).

**The reference:** [Data-Flow Reference](data-flow/) — the bird's-eye
technical map: entities, flows, invariants, and the anomaly watchlist.
Updated with every module.

## Conventions used throughout

**Business day, not calendar day.** The whole system runs on the
property's *business day*, which moves forward only when the night audit
closes the previous day (normally around 04:00 property time). A booking
made at 01:00 at night still belongs to *yesterday's* business day. Every
date on every screen means business date unless it says otherwise. The
current business day and the property time zone are shown at the top of
the dashboard — always glance there first when a number surprises you.

**Money is cash collected, not earned.** Wherever the dashboard shows
revenue, it means money that has actually arrived — gateway payments
received plus cash taken at the desk, minus completed refunds. A confirmed
booking that hasn't paid yet contributes **zero** to revenue. Prepayments
*do* count, on the day the money arrives.

**Amounts are stored in poisha, shown in taka.** The system records money
in poisha (1 taka = 100 poisha) to avoid rounding errors. You will only
ever see taka on screen.

**Roles matter.** Some cards only appear for roles allowed to see money.
If a colleague's screen looks different from yours, that is usually why —
not a bug.

**You can never approve your own work.** Every approval queue in the
system enforces separation of duties — journals, payments, counts,
refunds, time off. It's the single most repeated rule in these docs
because it's the single most important control the property has.

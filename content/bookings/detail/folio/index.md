# Guest Folio — Staff Training Module

**Page:** `/admin/bookings/[id]/folio` — the guest's bill.
**Audience:** front desk (primary), managers.
**Time to complete:** about 25 minutes.
**Prerequisite:** the [Bookings](..) module.

## Learning objectives

After this module you can read a folio like an accountant, post the four
entry types correctly, and know exactly what the balance means.

## 1. What the folio is

*"Everything charged to and paid on this stay."* One chronological list of
**entries** — charges, payments, discounts, refunds — each stamped with who
posted it and when. The header shows the stay (*\{room} · unit \{unit} ·
\{checkIn} to \{checkOut}, \{nights} nights*).

## 2. Reading the totals

- **Charges** — everything billed: room nights, extras, room service.
- **Discounts** — reductions, each with its reason.
- **Payments** — everything received (desk cash, online gateways).
- **Refunds** — money returned.
- **Balance due** (red) — the guest still owes this. **In credit**
  (green) — we've taken more than owed (refund or apply it). **Settled**
  — zero, clean.

**The projection line:** *"At check-out (with \{count} nights still to
post): \{amount}."* Room nights are posted **one at a time by the night
audit** — so mid-stay, the balance understates the final bill. The
projection adds the unposted nights: that's the number to quote when a
guest asks "what will I owe?"

**Legacy note:** very old bookings marked part-paid before folios existed
show a prompt to record the received amount as a payment — do it once,
then it's clean.

## 3. The four actions

Posting needs the create permission on an **open stay** (a manager can
also post to a closed stay — *"This stay is over. Only a manager can post
to it."*).

| Action | What it does | Needs |
|---|---|---|
| **Add charge** | Posts a charge: category (Extra bed, Laundry, Minibar, Food and drinks, Room service, Other — plus Early check-in / Late check-out, which auto-fill the fee from settings), description (required for Other) | Amount |
| **Record payment** | Records money received: method (Cash, Card, bKash, Nagad, Bank transfer, Other) + reference. **Cash needs an open cash shift** — without one, the page links you to open it. | Amount, method |
| **Discount** | Reduces the bill | Amount + **reason** (required) |
| **Refund at desk** | Returns money to the guest | Amount + method + **reason** (required) |

**Voiding a line** asks *why* and keeps the voided line visible, struck
through — history is never rewritten, only corrected.

**Every post is idempotent** (a fresh key per submit): double-clicking the
button can't double-charge the guest.

## 4. How the folio connects

- **Night audit** posts each night's ROOM_CHARGE here.
- **Room service** delivery posts its charge here.
- **Desk cash payments** land on your cash shift *and* here — the two must
  agree.
- **Online payments** (bKash/Nagad/SSLCommerz/BanglaQR/Stripe) appear as
  entries with their source marked.
- The **balance** feeds the daily sheet's money-due and the front-desk
  Owes column; **checkout is blocked** until it's settled.

## 5. Troubleshooting

| Symptom | Check first |
|---|---|
| "No open shift" on a cash payment | Open your cash shift first — the page links you there. |
| Can't post — stay is over | Only a manager can post to a closed stay. |
| Balance looks too low mid-stay | Unposted nights — read the projection line, not the balance. |
| Discount/refund blocked | A reason is required for both — write it. |
| Double charge fear | Idempotent posting — a double-click can't double-post. Check the entries. |

# Cash Shifts — Staff Training Module

**Page:** `/admin/front-desk/cash` — the cash drawer, per shift.
**Audience:** front-desk staff (primary), managers, auditors.
**Time to complete:** about 25 minutes reading, then one supervised shift.
**Prerequisite:** the Front Desk module.

## Learning objectives

After this module you can:

- Open a cash shift with a starting float and explain what the float is.
- Take cash payments and pay cash refunds on your shift.
- Close your shift with a **blind count** and explain why it's blind.
- Read the difference (short/over) and know what happens next.
- Know when a manager must sign off, and what sign-off means.

## 1. What a cash shift is

Every taka of physical cash that moves at the front desk — payments taken,
refunds paid out — belongs to exactly one **cash shift**: a named period
(yours) with a recorded starting amount, every cash movement logged against
it, and a counted ending amount. The shift is how the property proves the
drawer is honest.

**The golden rule:** *no open shift = no cash handling.* The page tells you
plainly: "You have no open shift. You can't take or pay out cash until you
open one." If a guest offers cash and your shift isn't open, open it first —
never "record it later".

## 2. Opening your shift

You need the *create* permission for front-desk work (standard for desk
staff).

1. Enter the **starting cash in the drawer** — the float, e.g. ৳5,000.
   (Maximum ৳1,00,000.)
2. Press **Open shift**. The shift records who opened it, when, on which
   business date, and the float.

From this moment, every cash payment you take and every cash refund you pay
is stamped onto your shift automatically — you don't log them by hand.

**What the float is for.** The float is the drawer's starting money (small
notes and coins for giving change). It is *not* revenue. At close, the
expected drawer = float + cash taken − cash paid out.

## 3. During the shift

Work normally. Cash taken at the desk (guest payments) and cash paid out
(desk refunds) attach themselves to your open shift. The page shows your
shift as *"Open since \{time}"* with the float and a running count of cash
transactions — but deliberately **not** the expected total.

## 4. Closing your shift — the blind count

This is the heart of the module. Read it twice.

### Why "blind"?

When you count the drawer at close, the system **does not show you the
expected amount**. You count what's physically there — by note or as one
total — and submit. Only *after* submitting does the system compare your
count against what the drawer should hold and tell you whether it balanced.
A blind count can't be fudged toward the expected figure, which is exactly
the point.

### How to close

1. Open **Count the drawer**.
2. Count **by note** (default): enter how many pieces of each — 1000, 500,
   200, 100, 50, 20, 10, 5, 2, 1. Or tick *"Enter the total instead"* and
   type one figure.
3. Add a **note** if anything was unusual (optional for your own shift).
4. Confirm the dialog — *"Close the shift with \{amount} counted? The count
   can't be changed afterwards."* This is final. Count twice before
   confirming.

### The three outcomes

| Result | Meaning | What happens |
|---|---|---|
| **Balanced** | Counted = expected | Shift closes clean. Done. |
| **Short by \{amount}** | Drawer has less than expected | Shift closes and **waits for a manager to sign it off**. |
| **Over by \{amount}** | Drawer has more than expected | Shift closes and **waits for a manager to sign it off**. |

**A difference is not an accusation.** Shortages happen (a miscounted
refund, change given wrong); overs happen (a payment recorded twice). What
matters is honesty: the count is final, the difference is recorded, and a
manager reviews it. Never "adjust" a count to force a balance, never borrow
from tomorrow's float to cover today — both are dismissible offences. Report
the difference truthfully; that is the whole system working as designed.

### Manager closing someone else's shift

A manager *can* close another person's shift (e.g. someone went home sick),
but then a **note is required** — why you're closing it. The note becomes
part of the record.

## 5. Reading the shift lists

- **Waiting for sign-off** — closed shifts with a difference, needing a
  manager. (Managers: this is your queue.)
- **Open now** — shifts currently running, with holder names.
- **Your recent shifts / Recent shifts** — history.

Each shift line shows: holder, opened → closed times, **Start** (float),
**Expected**, **Counted**, **Difference** (+/−). Click **View** for the
detail page: every cash line (payment/refund, voided lines marked),
the count-by-note breakdown, the close note, and the sign-off review.

**After-the-count voids.** Occasionally a void is recorded *after* the
count (e.g. a payment voided late). These change what the drawer *should*
have held and are shown as part of the explanation for a difference — they
don't rewrite the count.

**Who sees what.** You see your own shifts. Managers (approve permission)
and auditors (reports view) see everyone's.

## 6. Manager: signing off a difference

Open the shift, read the count detail and the holder's note, investigate
(check the cash lines, ask the holder), then sign off with **what happened
and what was done**: found, repaid, or written off. The sign-off is the
record the auditors read — write it like one.

## 7. How cash connects to everything else

- Desk payments on your shift feed the **dashboard's Revenue Today**
  (cash-collected definition) and the **Payments by method** card (Cash).
- Un-signed-off shifts appear in the **daily sheet's owner summary**
  ("Cash shifts to sign off") and block a clean night audit.
- Open cash shifts are flagged on the **night audit checklist** — close or
  hand over before the day closes.

## 8. Troubleshooting

| Symptom | Check first |
|---|---|
| Can't take cash | No open shift — open one first. |
| "Invalid amount" on open/close | Amounts must be positive numbers with at most 2 decimals. |
| Count was wrong after submitting | It can't be changed — that's the point. The difference goes to sign-off; be accurate before confirming. |
| Shift stuck open overnight | Close it (or a manager closes it with a note). Open shifts block the audit checklist. |
| Difference you can't explain | Don't guess — write what you know in the note and let the manager investigate. |

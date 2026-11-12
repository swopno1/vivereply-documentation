# Phase B2 §3–4: cash shifts

Owner decision (2026-10-07): **per person, blind count.**
- Each desk user opens a shift with a starting float.
- At the end they count the cash without seeing the expected amount.
- Any difference needs a manager's sign-off with a reason.

## 1. The rules

| Rule | Where it is enforced |
|---|---|
| One open shift per person | `CashShift_one_open_per_user` partial unique index; the action returns `already_open` |
| **Cash needs your open shift.** Every desk cash payment or refund goes on the recorder's open shift. Without one, cash is refused and nothing is saved. | `cashShiftForLine()` in the folio actions, the offline sale (paid in cash) and the refund at cancellation (paid back in cash). In the database: the `FolioLine_cash_needs_shift` check and the `FolioLine_cash_shift` trigger, which requires the shift to be open and to belong to the line's `createdBy`. |
| Only cash goes on a shift | `FolioLine_cash_shift_method` check. Card, bKash, Nagad and bank transfers don't touch the drawer. |
| A void goes on the original line's shift, even after that shift was counted | `voidFolioLineAction` and the trigger |
| Counted figures are final; the only later change is the sign-off; shifts are never deleted | `CashShift_guard` trigger, plus checks that the figures are consistent (`variance = counted − expected`; the status matches the variance) |
| Old cash lines (before B2) have no shift | The check is `NOT VALID`, so existing rows aren't checked. Voids of old lines are exempt. |

**Expected cash** = opening float + cash payments − cash refunds, each net of voids. It is computed from the shift's lines (`expectedCash()`) and stored on the shift when it is counted (`expectedPoisha`).

## 2. Open, close, sign off

| Action | Who | What |
|---|---|---|
| `openCashShiftAction({ openingFloatPoisha })` | `FRONT_DESK.create` | Float from ৳0 to ৳1,00,000. The shift records the business date it was opened on. Audited as `CASH_SHIFT_OPENED`. |
| `closeCashShiftAction({ shiftId, countedPoisha, countDetail?, note? })` | the holder (`FRONT_DESK.create`); or a manager (`FRONT_DESK.approve`) for a shift someone left open, with a note | See below. Audited as `CASH_SHIFT_CLOSED`, with every figure. |
| `reviewCashShiftAction({ shiftId, note })` | `FRONT_DESK.approve` | Signs off a shift in `NEEDS_REVIEW`; the reason is required. A manager can't sign off their own shift. The OWNER can, because nobody is above them. Audited as `CASH_SHIFT_REVIEWED`. |

**Closing a shift:**
1. **Count:** the count may come with a count by note (৳1000 … ৳1). If it does, it must add up to the total (`count_mismatch`).
2. **Lock:** the shift row is locked (`FOR UPDATE`) and the expected amount is computed and stored.
3. **Status:** a difference of zero gives `CLOSED`; any other difference gives `NEEDS_REVIEW`.
4. **Result:** the result tells the holder whether the count balanced, and by how much it didn't. They see this only once the count is final.

**Blind count:** the holder never sees the expected amount, or the cash total, while their shift is open (§4).

## 3. Concurrency

- **Recording cash:** recording cash locks the recorder's open shift row (`lockOpenShift`), so a payment and a close of the same shift are serialised:
  - **Payment first:** the payment commits first and is part of the expected amount.
  - **Close first:** the payment, re-reading after the wait, finds no open shift and is refused (`no_open_shift`). Nothing is lost.

  The test runs this race five times and checks both outcomes.
- **Voids:** a void of a cash line locks that line's shift too.
- **Voids after close:**
  - A void that lands after the count is a **void after close**. The review shows it, because it explains part of the difference.
  - **Original rule:** the trigger stamped voids with `clock_timestamp()`, and the close took `closedAt` from the same database clock.
  - **Problem (found during Phase D):** the two timestamps go through different rounding. Postgres rounds the void to the millisecond, while `closedAt` is truncated on its way through JavaScript. In a tight race they could tie or cross, and one `pnpm test:db` run failed this way once.
  - **Fix (migration `20261011110000_cash_shift_void_order`):** the decision no longer depends on two clocks.
    - The close sets `closedAt` to the later of the database clock and the latest line already on the shift (`closingTime()`, under the row lock), so every line counted is at or before `closedAt`.
    - The trigger stamps a void on a counted shift strictly after `closedAt` (`GREATEST(clock, closedAt + 1 ms)`).
    - "After the count" is therefore exactly `createdAt > closedAt`.
    - A regression test forces a `closedAt` a minute ahead of the clock and checks that the void is still filed after the count.
  - Payments can't arrive after the close, so they keep their normal timestamp.

## 4. Schema

Migration `20261009110000_cash_shift` (additive):
- the `CashShift` table and the `CashShiftStatus` enum (`OPEN`, `CLOSED`, `NEEDS_REVIEW`, `REVIEWED`);
- the nullable column `FolioLine.cashShiftId`;
- the checks and triggers above.

`createOfflineBooking` and `cancelBookingWithRefundDecision` throw `NoOpenShiftError` inside their transaction for cash without a shift. The whole booking or cancellation is rolled back, and the message tells the user to open a shift.

## 5. Tests

**`src/lib/cash/cash.db.test.ts`:**
- cash refused without a shift, while card isn't;
- one open shift per person;
- a balanced close with a count by note;
- a short close, then the sign-off rules (holder, own shift, owner);
- a manager closing someone else's shift;
- a void after close;
- the database guards;
- the payment-versus-close race;
- an offline cash sale.

**`src/lib/cash/constants.test.ts`:** counting by note and the drawer effect of each line.

**Existing tests updated** to take cash only on an open shift (`ensureOpenShift`), or not to use cash where the test isn't about money: `folio.db.test.ts`, `metrics.db.test.ts`, `room-units.db.test.ts`, `sheet.db.test.ts`.

## 6. Screens (§4)

**`/admin/front-desk/cash`** (`FRONT_DESK.view`, `frontDesk` module), linked from the Front Desk page:

| Section | Who | Shows |
|---|---|---|
| Your shift | `FRONT_DESK.create` | **No shift:** a starting-cash field and "Open shift". **Open:** when it opened, the starting cash, the number of cash transactions so far (**never the total**), and the count form. |
| Count the drawer | the holder | One row per note (৳1000 … ৳1, pieces × value), with a running total. Alternatively, a single total. An optional note. A confirmation that the count is final. Then the result: "Balanced", or "Short by ৳500 …" / "Over by …", with the shift waiting for sign-off. |
| Waiting for sign-off, Open now, Recent shifts | `FRONT_DESK.approve` or `REPORTS.view` | Every shift with holder, times, start, expected, counted and difference. "Open now" shows what each drawer should hold now, except the viewer's own shift, whose count is blind too. |
| Your recent shifts | the holder | Their counted shifts, with figures; the count is final, so the figures can be shown. |

**`/admin/front-desk/cash/[id]`:**
- **Content:**
  - the figures: start, cash taken, cash paid out, expected, counted, difference;
  - the count by note and the close note;
  - the cash lines, each linked to its folio, with "Void" and "After the count" tags;
  - an explanation of voids after the count;
  - the sign-off, or who signed off and why.
- **Access:**
  - **Holder:** only once the shift is counted. Their own open shift redirects to the cash page.
  - **Anyone else:** needs `FRONT_DESK.approve` or `REPORTS.view`.
- **Managers can also:**
  - sign off a difference (not their own shift; the OWNER may sign off their own);
  - close a shift someone left open, by counting the drawer with a required note.

**Elsewhere:**
- **Folio:** "Cash needs your open cash shift." links to the cash page.
- **Night audit:** lists the shifts still open, as information; the close doesn't wait for them.
- **Daily sheet:** the owner summary counts "Cash shifts waiting for sign-off".

### Live check (production build, scratch DB, 360px)

| As | Checked |
|---|---|
| FRONT_DESK (English) | A cash payment on the folio was refused with a link (44px) to the cash page. Opened a shift with ৳2,000, then took ৳1,500 cash on the folio. The cash page showed "Cash transactions so far: 1" and no total. Counted three ৳1,000 notes (total ৳3,000) and closed; the result was "Short by ৳500 … waits for a manager". "Your recent shifts" shows expected ৳3,500, counted ৳3,000, difference −৳500. Every tap target ≥ 44px; `scrollWidth` 345. |
| MANAGER (Bengali) | "অনুমোদনের অপেক্ষায় (১)" lists the shift with its figures. The detail page shows the figures, the count by note (৳১,০০০ × ৩) and the cash line linked to LIVE-1. Signed off with a Bengali note, and the page shows who signed off and the note. No overflow. |

**Fixed live:**
- The folio's "no shift" message repeated its own link text.
- "1 cash transactions" read wrongly; it is now "Cash transactions so far: 1".
- The empty "Recent shifts" list showed a blank line.

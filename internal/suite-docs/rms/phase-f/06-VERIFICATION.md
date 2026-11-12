# Phase F §6: verification report

Branch `phase-f-finance`, from `main` at `3357500` (Phase E merged).

| § | Commit | What |
|---|---|---|
| 1 | `bf459dc` | Chart of accounts, journal entries (balanced, append-only), months, manual journals with approval, reversals; plan (00-PLAN.md) |
| 2 | `81c84c0` | Automatic postings from the folio, online payments and refunds, stock, expenses and cash drawers; cron route and "Post now" |
| 3 | `e60c0a1` | Supplier bills and payments, petty cash counts, transfers |
| 4 | `69a3181` | Finance screens |
| 5 | `830d58a` | Reports and CSV export |
| 6 | this commit | Live-check fixes, test isolation, verification report, RMS index |

## Summary

**The books:**
- **Double entry, in poisha,** on a starting chart of accounts for a small resort.
- **Journal entries:** always balanced (checked by the database at commit), never changed, corrected by reversals.
- **Manual journals and opening balances** post only when someone else approves them.
- **Months** close; the OWNER reopens them.

**What posts by itself:**
- **The desk:** everything the folio records: nights, charges, discounts, payments, refunds, voids.
- **Online:** gateway payments and completed refunds.
- **The store:** stock received, used, wasted and counted.
- **Spending:** approved expenses (cash ones out of petty cash), and signed-off cash-drawer differences.
- **When:** hourly or on "Post now", once each.

**Owed to suppliers:**
- **Bills** against deliveries (any price difference to its own account) or other costs.
- **Payments** from a money account (never the desk drawer), allocated to bills and approved by someone else.
- **Voids** for a bill nobody paid or a payment that didn't happen.
- **Balances and ageing** per supplier.

**Petty cash and transfers:**
- **Petty cash:** topped up by transfer; counted against the books, with any difference approved by someone else.
- **Transfers:** money between the resort's own accounts, with charges.

**Reports:** trial balance, profit and loss, balance sheet, supplier ageing, CSV export.

**Defaults applied** (00-PLAN.md):
- a second person approves money going out and manual journals;
- automatic postings from a books start date;
- receipts post at the order price, with bill differences to purchase price differences;
- no VAT in this phase.

**Permission matrix:** unchanged. The sidebar gains "Finance".

**Module flags:** `accounting` and `finance` are live, both off by default in this template (the brief's values).

**Migrations:** two, both additive:
- `20261013100000_ledger` adds the chart of accounts and `Settings.ledgerStartDate`;
- `20261013110000_payables`.

They apply cleanly to a fresh `resort_test` and to `resort_dev`, with no drift. The payment code is untouched: the ledger only reads payments and refunds.

## Gates (at the final commit)

| Gate | Result |
|---|---|
| `pnpm lint` (ESLint, guard scripts, money check) | 0 problems |
| i18n parity | OK |
| `pnpm test` | 778 passed (634 DB tests skipped without a `*_test` DB) |
| Full suite on a fresh, migrated `resort_test` | 1,411 passed, 1 skipped (the migrations check). This includes the four gateway suites. |
| `pnpm test:db` | 337 passed, three times in a row, after the isolation fix (FF-3) |
| `pnpm build` | Clean. **New dynamic routes:** `/admin/finance` with `journals`, `journals/new`, `journals/[id]`, `manual/[id]`, `accounts`, `accounts/[id]`, `months`, `payables`, `payables/bills/new`, `payables/bills/[id]`, `payables/payments/new`, `payables/payments/[id]`, `petty-cash` and `reports`; `/api/admin/finance/export`; `/api/cron/ledger-posting`. |

**New test files:**
- `ledger/ledger.db.test.ts` (6), `ledger/auto.db.test.ts` (4), `ledger/payables.db.test.ts` (6), `ledger/reports.db.test.ts` (2);
- `ledger/constants.test.ts`, `ledger/auto.test.ts`, `ledger/reports.test.ts`.

**Updated test files:**
- `permission-enforcement.test.ts`: 18 new guarded paths × every role.
- `permissions.test.ts`, `module-flags.test.ts`: sidebar and landing pages.
- `modules.db.test.ts`: the "not built" example is now HR.

## Live check (production build, scratch DB, 360px)

**Data:** a checked-in stay (one night ৳8,000, room service ৳900, a ৳5,000 card payment), a purchase order with 10 kg rice received at ৳120 and 3 kg issued, and an approved ৳3,200 cash fuel expense.

| As | Checked |
|---|---|
| ACCOUNTANT (English) | **Starting:** started the books on 1 Oct. "Post now" gave "Entries posted: 6." Guests owe ৳3,900, which is exactly the folio. **Opening balances:** bank ৳5,00,000, petty cash ৳10,000 and owner's capital ৳5,10,000 showed "Balanced"; submitted, the journal said "You entered this journal, so someone else approves it." **Bill:** the delivery billed at ৳1,250. **Payment:** ৳1,250 by cheque from the bank, allocated ("Allocated ৳1,250 · Advance ৳0"). **Petty cash:** counted ৳6,750 against ৳6,800 in the books, giving "Difference −৳50", waiting, with the own-count message. **Transfer:** a ৳5,000 card settlement less ৳75 charges went to the bank as `JE-202610-00010`. **Ledger:** the bank ledger ran ৳5,00,000 → ৳4,98,750 → ৳5,03,675. **Months:** October open. No overflow on any page. |
| MANAGER (Bengali) | **Sidebar:** ফাইন্যান্স. **Overview:** waiting items (manual journal 1, supplier payment 1). **Approvals:** approved the journal ("JE-202610-00008 হিসেবে পোস্ট হয়েছে"), the payment, and later the petty cash difference (petty cash ৳6,750). **Payables:** nothing owed, and the payment approved. **Reports:** the trial balance balanced at ৳5,18,900 on each side (মিলেছে). Profit and loss: income ৳8,900, costs ৳3,610 (stock used ৳360, price difference ৳50, fuel ৳3,200), "লাভ ৫,২৯০৳". The balance sheet balanced at ৳5,15,290 with profit to date. **Export** refused (403), as the matrix says. No overflow; no tap target under 44px. |
| AUDITOR (English) | **Access:** petty cash with no buttons; the export downloads (200); `/admin/finance/journals/new` shows "403 - Access Denied". |

## Found and fixed during Phase F

| # | Problem | Fix |
|---|---|---|
| FF-1 | **Development:** the balance trigger referred to a field only one of its two tables has, which PL/pgSQL rejects at run time. | Split into `IF` branches before the migration was committed. Caught by the DB tests. |
| FF-2 | **Development:** renaming an account dropped its "holds money" flag (it read the type from the request, not the account). | Uses the stored type. |
| FF-3 | **Order-dependent tests:** `pnpm test:db` failed some runs. The night-audit tests leave a 2001 business day open, so finance tests running after them saw "today" before the books' 2020 start. Some test fixtures also used random 4-digit document numbers that could collide across runs in the shared test database. | The finance DB tests pin their own business day, as the room-service tests do. Fixture numbers come from UUID digits. Passed three runs in a row after the fix. |
| FF-4 | **Live:** "Owed to suppliers" showed "-৳0" (negative zero). | The money formatter normalises −0. |
| FF-5 | **Live:** account names inside journal lines were 17px-high links. | Made 44px tap targets. |
| FF-6 | **Docs:** the Settings › Tax tab said VAT was "Planned for Phase F". | It now says VAT needs the property's VAT details. |

## Limitations and follow-ups

| # | Limitation |
|---|---|
| L1 | **No VAT or supplementary duty.** Prices stay tax-inclusive. This needs the property's VAT registration details (BIN, rates, which services carry SD). |
| L2 | **No bank reconciliation.** There is no bank statement import or gateway settlement matching. Settlements are recorded as transfers, by hand. |
| L3 | **The books start on a date.** Anything recorded earlier isn't posted; opening balances carry it in. The start date is set once, before anything is posted. |
| L4 | **No year-end closing.** The balance sheet shows profit to date with equity; there are no closing entries into retained earnings. |
| L5 | **No fixed assets, depreciation, loans or budgets.** The accountant can add accounts and use manual journals meanwhile. |
| L6 | **Deliveries before the start date can't be billed against "goods received, bill not entered".** Bill them as other costs instead. Stock received without an order also waits there until a bill line clears it. |
| L7 | **Online payments post to one clearing account,** not one per gateway; settlement transfers clear it. |
| L8 | **Single-line limit:** ৳2 crore per journal line and per bill or payment (32-bit columns). Larger opening balances are split over lines. |
| L9 | **Late items:** postings for a closed month land on the current business date with a note, not in that month. |
| L10 | **Crontab:** add the hourly `/api/cron/ledger-posting` line (`docs/DEPLOYMENT.md` §7.2c). The night-audit line is still needed too (Phase B L11). |

## Not merged

`main` is unchanged. Phase F is on `phase-f-finance` for the owner's review.

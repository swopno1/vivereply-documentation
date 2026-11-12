# Phase B §5: verification report

Branch `phase-b-operations`, from `main` at `a76088b`.

| § | Commit | What |
|---|---|---|
| 1 | `b1b02f9` | Business date, `NO_SHOW` status, plan (00-PLAN.md) |
| 2 | `4be43bc` | Guest folio, check-out settlement, `Payment.source`, dashboard fix FB-1 |
| 3 | `6353e48` | Night audit, 04:00 fallback cron |
| 4 | `96e4552` | Daily sheet, notes, print |

## Summary

- **What a manager can now do:** run the day from the system.
  - The front desk works one **business date**, which moves only when the day is closed.
  - Every stay has a **folio**: room nights, extras, discounts, desk payments and refunds, and online payments.
  - **Check-out** can't leave money uncollected without a manager's audited reason.
  - The **night audit** closes the day. Missing arrivals are decided by a manager, and if nobody closes it by 04:00 the cron does.
  - The **daily sheet** puts the day on one printable page.
- **Owner decisions applied:**
  - manual night audit with an automatic fallback;
  - no-shows flagged for a manager, never automatic;
  - desk payments recorded in Phase B.
- **Permission matrix:** unchanged. Every new action maps to an existing `FRONT_DESK` grant (00-PLAN.md).
- **Migrations:** four, all additive: `20261008100000_business_day`, `20261008110000_folio`, `20261008120000_night_audit`, `20261008130000_daily_note`. Applied cleanly to `resort_test` and `resort_dev`. The folio backfill was proven on a scratch database with old-style rows (02-FOLIO.md §5).

## Gates (at `96e4552`)

| Gate | Result |
|---|---|
| `pnpm lint` (ESLint, guard scripts, money check) | 0 problems |
| `pnpm test` | 699 passed (577 DB tests skipped without a `*_test` DB) |
| Full suite on `resort_test` (`--no-file-parallelism`) | 1,275 passed, 1 skipped (the migrations check, which needs a shadow DB) |
| `pnpm test:db` | 201 passed |
| `pnpm build` | Clean, 0 warnings. The new pages are dynamic (ƒ); the public pages are unchanged. |
| Gateway suites, fresh `resort_test` | Nagad 255, SSLCommerz 334, bKash 157, BanglaQR 96, all passed |
| Live: production build, scratch DB, 360px, EN and BN | Folio, check-out, night audit, daily sheet and print checked as OWNER/MANAGER, FRONT_DESK and HOUSEKEEPING (details in 02, 03 and 04) |

New test files:
- `business-day.db.test.ts` (3)
- `no-show.db.test.ts` (2)
- `folio/ledger.test.ts` (5)
- `folio.db.test.ts` (12)
- `night-audit/audit.db.test.ts` (7)
- `daily-sheet/sheet.db.test.ts` (4)

Updated test files:
- `permission-enforcement.test.ts`: 9 new actions × every role
- `metrics.db.test.ts`: FB-1
- `room-units.db.test.ts`: check-out needs a settled folio

## Found and fixed during Phase B

| # | Problem | Fix |
|---|---|---|
| FB-1 | The dashboard counted a manual refund record (written at cancellation, status `REFUNDED`) as **money received**, so a ৳1,000 cash refund showed as ৳1,000 more revenue. | Desk money now comes from the folio; desk record rows aren't money. Tested. |
| FB-2 | Desk payment records could be flipped between Paid, Partial and Unpaid in the booking edit form, which changed nothing real. | Refused for desk records, with a pointer to the folio. |
| FB-3 | A guest kept at the night audit (arriving late) vanished from the Front Desk page and the daily sheet the next day. | Earlier arrivals still due are listed, marked "due {date}". |
| FB-4 | The plan allowed closing the day from 20:00; that would move late arrivals off the Front Desk page while guests were still arriving. | A day closes after midnight; the 04:00 cron is the fallback. Plan updated. |
| FB-5 | The cookie banner printed on top of the daily sheet. | Hidden on paper, as is the admin chrome. |
| FB-6 | Folio entries showed raw codes (`LATE_CHECK_OUT`) and English text in Bengali. | Localized titles per kind, category and night. |

## Limitations and follow-ups

| # | Limitation |
|---|---|
| L1 | **Housekeeping can't read notes aimed at them** yet: the daily sheet needs `FRONT_DESK.view`, which HOUSEKEEPING doesn't have. A housekeeping view comes with the housekeeping module. |
| L2 | **Shift cash close** isn't built. It is the natural next step, on top of the desk payments now recorded. |
| L3 | **VAT and service charge** are not on the folio. Amounts are tax-inclusive until Phase F. There is no tax-invoice numbering yet. The folio prints (Print button, admin chrome hidden), but it isn't designed as a guest invoice. |
| L4 | **Discounts** are manager-only with a reason and capped at the stay's charges; there are no per-role caps or approval thresholds yet. |
| L5 | **Overstays** aren't charged automatically. Room nights stop at the booking's checkout date; a manager extends the booking. The night audit and the daily sheet flag overstays. |
| L6 | **Old part-paid offline sales** never recorded the amount received. The folio shows a notice; the desk must record the actual amount as a payment. |
| L7 | **Past daily sheets** are rebuilt from current data: balances are as of now, and "in house" is stays that covered that night. The authoritative per-day numbers are the night-audit snapshot in the owner summary. |
| L8 | **The dashboard is still calendar-based** (KPIs, collections by calendar day). The business-day record is the night-audit snapshot. |
| L9 | **BanglaQR has no gateway refund table**: a BanglaQR refund is paid manually and recorded as a desk refund. |
| L10 | **Room nights posted at check-out** (when an audit was missed) carry the checking-out user as `createdBy`, not "night audit". |
| L11 | **The night audit cron must be added to the crontab** on the server (docs/DEPLOYMENT.md has the line). Without it, an unclosed day stays open until someone closes it. |
| L12 | **A "keep" decision** applies to one business date. A guest still not arrived the next night appears again for a new decision. This is intended. |
| L13 | **Pre-existing:** the bKash audit test can rarely flag a random token ID as a phone number (seen once in Phase A2). It isn't related to Phase B. |

## Not merged

`main` is unchanged. The four commits are on `phase-b-operations` for the owner's review.

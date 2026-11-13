# Payments — Staff Training Module

**Page:** `/admin/payments` — the money-in doorway.
**Audience:** managers, accountants.
**Time to complete:** about 10 minutes.
**Prerequisite:** the [Bookings](../bookings/) module (statuses).

## Learning objectives

After this module you know what the Payments hub is for — and,
equally important, what it is not.

## 1. What the page is

Two cards, nothing else:

- **BanglaQR verification** — guest QR payments waiting for a human
  check. See [its page](../finance/banglaqr-verification/).
- **Stripe disputes** — card disputes (chargebacks) against Stripe
  payments. An empty hub says *"No disputes on record."*

**What this page is not:** there is no central payments list. Folio
payments live on their booking's folio; gateway transactions live on
the booking detail's payment section; received money is summarised on
the [Finance](../finance/) overview and the dashboard. If you are
looking for "all payments", say which of those you mean — the hub is
the doorway to the two exception queues, not a ledger.

## 2. Troubleshooting

| Symptom | Check first |
|---|---|
| Queue count disagrees with Finance | Counts agree by construction (same rows) — refresh; a mismatch means one page loaded stale data. |
| A payment isn't in either queue | Only BanglaQR receipts awaiting verification and Stripe disputes appear here. Everything else lives on its booking. |

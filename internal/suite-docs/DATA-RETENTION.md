# Data Retention

What payment data this system keeps, for how long, and how it is deleted. It covers the BanglaQR, bKash, Nagad and SSLCommerz payment flows. Other gateways store their records in the same `Payment` table and follow the payment-record rule below.

## Retention periods

| Data | Where | Kept for | How it is removed |
|---|---|---|---|
| BanglaQR receipt images | Private R2 bucket `R2_RECEIPTS_BUCKET_NAME` (`receipts/{bookingId}/{sha256}.{ext}`) | **90 days after check-out** | Daily cron `/api/cron/banglaqr-retention` deletes the object and sets `Payment.receiptDeletedAt` |
| Payment records (`Payment` rows, including receipt hash, claimed amount, masked history) | Postgres | **7 years** (accounting requirement) | Never deleted by the application |
| Payment audit trail (`PaymentAuditLog`) | Postgres | **2 years minimum** (Bangladesh Bank guidance for payment records) | Append-only; the DB trigger refuses deletion of rows younger than 2 years. Rows older than that may be archived or deleted by a DBA |
| Booking log lines (`BookingLog`) | Postgres | Lifetime of the booking | Transaction IDs in these lines are masked |
| Rate-limit counters (`BanglaQRRateLimitHit`) | Postgres | 24 hours | Pruned by `/api/cron/banglaqr-release` |
| Processed webhook IDs (`ProcessedWebhook`) | Postgres | 7 years (part of the payment record) | Never deleted by the application |
| bKash refund ledger (`BkashRefund`) | Postgres | **7 years** (payment record) | Never deleted; a DB trigger refuses DELETE and TRUNCATE outright, and settled outcomes can't change |
| bKash payer data | Not stored | n/a | The guest's phone (already on the booking) is sent to bKash as `payerReference`; bKash's `customerMsisdn`/`debitMSISDN` are never stored or logged. Stored bKash payloads are a masked whitelist (masked trxID, amount, invoice) |
| Nagad refund ledger (`NagadRefund`) | Postgres | **7 years** (payment record) | Never deleted; a DB trigger refuses DELETE and TRUNCATE outright, and settled outcomes (including an owner's resolution of an unconfirmed refund) can't change |
| Nagad payer data | Not stored | n/a | The guest's phone is not sent to Nagad. Nagad's `clientMobileNo` / `merchantMobileNo` are never stored or logged. The stored Nagad summary is a masked whitelist (masked trxID, amount, order ID, status). Nagad's phase-1 challenge is stored only as a sha256 hash |
| SSLCommerz refund ledger (`SSLCommerzRefund`) | Postgres | **7 years** (payment record) | Never deleted; a DB trigger refuses DELETE and TRUNCATE outright, SSLCommerz's refund reference can't change once recorded, and settled outcomes can't change |
| SSLCommerz payer and card data | Not stored beyond the booking | n/a | Card numbers, expiry, CVV, OTPs and wallet PINs are entered on SSLCommerz's hosted page and never reach this server. The truncated card number and tokenisation fields SSLCommerz returns are not parsed. The stored summary is a whitelist: card/wallet type and brand, risk level, amount, currency, masked bank transaction. The guest's name, email and phone (already on the booking) are sent to SSLCommerz as the checkout requires |
| Payment rate-limit counters (`PaymentRateLimitHit`) | Postgres | 24 hours | Pruned by `/api/cron/bkash-reconcile`, `/api/cron/nagad-reconcile` and `/api/cron/sslcommerz-reconcile` |
| Guest NID / passport (`Guest.nidOrPassport`) | Postgres | Kept with the guest/booking record; **no automatic deletion today** — the property sets a purge window with legal advice before going live | Masked to the last 4 characters on the confirmation page and for staff without front-desk edit permission; full value visible only to OWNER, MANAGER, FRONT_DESK, STAFF in `/admin` |

Receipt images are not kept as long as payment records. The image is evidence for verification and short-term disputes. After that it is PII with no remaining purpose. The `Payment` row keeps what accounting needs: amount, transaction ID, status, who verified it, and when.

## What a receipt image may contain

Receipts often show partial bank-account numbers, phone numbers and names. To limit the exposure:

- **Metadata stripped:** every upload is re-encoded, which removes EXIF (GPS, device), XMP, IPTC, ICC profiles and any data appended after the image.
- **Private storage:** images live in a bucket with no public domain. The database stores only the object key and the SHA-256 hash, never a URL.
- **Audited access:** admins see a receipt through a signed URL valid for 5 minutes, generated when they click "View receipt". Each generation writes an `ADMIN_RECEIPT_URL_ISSUED` audit row with the admin's user ID.

## Guest deletion requests (right to deletion, v1)

Bangladesh law does not strictly require this, but honouring deletion requests builds guest trust. The v1 process is manual:

1. The guest asks the property (email, phone or front desk) to delete their payment receipt, and gives their booking code.
2. Staff confirm the requester's identity: they must use the email or phone number on the booking.
3. An **OWNER** opens the booking in the admin panel (`/admin/bookings/{id}`) and clicks **Delete receipt image** on the BanglaQR payment. A reason is required, for example "Guest request by email, 2026-10-02".
4. The image is deleted from storage immediately. The payment record and audit trail stay, because accounting and audit retention rules require them; the guest is told this.

A receipt still under verification (`PENDING_VERIFICATION` or `RECEIPT_REQUESTED`) cannot be deleted until an admin confirms or rejects it, because it is the evidence for that decision.

Each deletion writes an `ADMIN_RECEIPT_DELETED` audit row and a booking-log line.

## Receipts uploaded before the hardening

The pre-hardening code stored receipts in the **public** blog bucket and saved their public URL. Move them once, after the private bucket is configured:

```bash
pnpm exec tsx scripts/banglaqr-migrate-legacy-receipts.ts          # dry run
pnpm exec tsx scripts/banglaqr-migrate-legacy-receipts.ts --apply  # copy to private bucket, delete public copy
```

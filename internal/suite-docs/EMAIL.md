# Email (Resend)

Every email the app sends goes through one function, `sendEmail()` in `src/lib/email/sender.ts`:
- **Guests:** booking confirmations, the bKash, Nagad, SSLCommerz and Bangla QR payment emails, and blog submission updates.
- **Staff:** invitations and password resets.
- **Alerts to the resort:** new leads, payment review and refund alerts, and webhook alerts.

There is no SDK: it's one HTTPS call to `https://api.resend.com/emails`.

## Go-live checklist

1. **Create a Resend account** at <https://resend.com>.
2. **Verify your domain.** Go to Resend → **Domains** → *Add domain* (for example `yourdomain.com`) and add the DNS records it shows (SPF/MX and DKIM; DMARC recommended) at your DNS host. Wait for **Verified**.
   - With Cloudflare: add the records as **DNS-only** (grey cloud), per CLAUDE.md §5.
3. **Create an API key:** Resend → **API Keys** → *Create* with **Sending access**. It starts with `re_`.
4. **Set the environment** on the server (`.env`), then restart the app:
   ```
   RESEND_API_KEY="re_…"
   RESEND_FROM_EMAIL="bookings@yourdomain.com"   # any address on the verified domain
   ```
   `RESEND_FROM_EMAIL` is optional. Without it, production sends from `bookings@<domain in brand.config.ts>`, so that domain must be the one you verified.
5. **Check it from the admin.** Sign in as OWNER and go to **Settings → General → Email (Resend)**:
   - The card should say **Ready to send** and list no problems.
   - Press **Send test email**. It goes to your own address, and the page shows Resend's message id, or Resend's exact refusal (for example "domain is not verified").
   - Each test is audited (`EMAIL_TEST_SENT`).

Nothing else needs configuring. Replies to guest emails go to the resort's contact email from `brand.config.ts`; a lead alert's reply goes to the guest who left the lead.

## Behaviour

| Situation | What happens |
|---|---|
| Key set | Sent. A `429` or `5xx` from Resend, or a network error, is retried once after ~0.75 s with the same `Idempotency-Key`, so the retry can't send a duplicate. Any other `4xx` (bad sender, unverified domain, invalid recipient) fails at once with Resend's message. |
| No key, **production** | **Fails** (`RESEND_API_KEY is not set`). The settings card shows *Not ready*. Invitations and password resets are rolled back and say so. Booking and payment flows carry on, since email is never a reason to lose a booking, and the failure is logged. |
| No key, development | Mocked: logged as `[Mock Resend Email] "<subject>"`, and reported as sent. Invitation and reset links are printed so they can be clicked. |
| `RESEND_API_KEY` still the old `.env.example` placeholder | Treated as no key |
| `RESEND_FROM_EMAIL` invalid (for example `Team <a@b.com>`) | That send fails with a clear error; the card shows the problem. |

**Guarantees:**
- `sendEmail()` never throws.
- Every value a guest or admin typed is HTML-escaped before it goes into an email.
- Subjects have line breaks removed.
- Failures are logged as `[email] not sent: "<subject>": <reason>`, without the recipient or the body.

## Where the emails come from

| Module | Sender name | Recipients |
|---|---|---|
| `email/index.ts` | Reservations / Lead Alert | guest, or the resort's contact email |
| `email/{bkash,nagad,sslcommerz,banglaqr}.ts` | `<Resort> Reservations` | guest; admin alerts go to each gateway's alert email (Settings → Payments) |
| `email/blog.ts` | `<Resort> Blog` | guest author, moderators |
| `email/account.ts` | `<Resort> Team` | invited user, user resetting a password |

## Troubleshooting

| Card or test result | Fix |
|---|---|
| "RESEND_API_KEY is not set" | Add the key to `.env` and restart. |
| "…still has the example value…" | Replace the placeholder with your real key. |
| Resend 403 "domain is not verified" | Finish step 2, or set `RESEND_FROM_EMAIL` to an address on a verified domain. |
| Resend 401/403 "API key is invalid" | Create a new key with *Sending access*. |
| Test arrives but lands in spam | Add DMARC and check the DKIM record in Resend → Domains. |

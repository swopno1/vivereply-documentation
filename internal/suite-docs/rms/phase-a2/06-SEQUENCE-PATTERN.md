# Phase A2 §8: sequence-based booking codes

**The problem (A1 audit F10):** a booking code was `RES-` plus 6 random digits, with a unique constraint and no retry. Two bookings drawing the same number made the second one throw.

**The fix:** `RES-YYYYMM-XXXXX`, numbered per month from a `Sequence` table, inside the transaction that creates the booking. Examples: `RES-202610-00001`, `RES-202610-00002`, then `RES-202611-00001` on 1 November.

## 1. The pattern (reused for invoices, POs and GRNs)

```prisma
model Sequence {
  id        String   @id @default(uuid())
  name      String   // "booking"; later "invoice", "po", "grn"
  period    String   // "202610"
  value     Int      @default(0) // the last number issued
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@unique([name, period])
}
```

`nextSequenceValue(tx, name, period)` in `src/lib/sequence.ts` is a single statement:

```sql
INSERT INTO "Sequence" (id, name, period, value, …) VALUES (…, $name, $period, 1, …)
ON CONFLICT (name, period) DO UPDATE SET value = "Sequence".value + 1
RETURNING value
```

**Rules for every caller:**
1. **Call it inside the transaction that inserts the document.** The `ON CONFLICT DO UPDATE` takes the row lock and holds it until that transaction ends. Concurrent callers queue on it, so no two get the same number. There's no read-then-write race and no unique-violation retry.
2. **A rollback gives the number back.** If the document insert fails, the increment rolls back with it, so failed creates leave no gaps. Gaps still appear if a committed document is later deleted; documents are archived, not deleted (03 conventions).
3. **Take the sequence lock last.** Booking creation takes `assignUnit()`'s per-room-type advisory lock first, then the sequence. A transaction waiting on the counter holds nothing the counter's holder needs, so they can't deadlock. The busiest lock is also held for the shortest time: just the guest and booking inserts after it.
4. **The period is the property's month** (`monthPeriod()`, property timezone, §6). A booking made at 00:30 on 1 November in Dhaka is `RES-202611-…`, even though the server's UTC clock still says October.
5. **Format:** five zero-padded digits. Past 99,999 in one month, a sixth digit appears (`RES-202610-100000`); numbers never wrap or collide.

**Later documents** call the same function with their own name, for example `nextSequenceValue(tx, "invoice", fiscalYear)`. Accounting may want a fiscal-year period (July–June) instead of a month; the period is just a string the caller chooses.

## 2. Where it's used

| Path | Before | Now |
|---|---|---|
| `POST /api/bookings` (guest booking) | random code before the transaction | `nextBookingCode(tx, timeZone)` right after `assignUnit` |
| `createOfflineBooking` (admin) | same | same; the placeholder guest e-mail `<code>@no-email.local` now uses the new code |
| PMS webhook `booking.created` | the PMS's own code, or `PMS-<timestamp>` | **unchanged.** An external booking keeps the external system's reference, which is what the PMS's later `booking.cancelled` call names. |

**Existing bookings keep their codes.** Old `RES-123456` codes and new `RES-202610-00001` codes can't collide: different shape, same unique column. Nothing parses the code. The gateways only embed it, and the new code fits every gateway rule:

| Gateway | Built from the code | New length | Limit |
|---|---|---|---|
| bKash invoice | `RES-202610-00001-AB12` | 21 | 255 |
| Nagad orderId | dashes stripped, 16-char prefix + 4 hex = `RES20261000001AB12` | 18 | 20 (alphanumeric) |
| SSLCommerz tran_id | `RES-202610-00001-AB12` | 21 | 30 |
| Gateway request schemas | `^[A-Za-z0-9-]+$`, 3–32 chars | 16 | 32 |

No payment file was changed.

## 3. Evidence

| Suite | Result |
|---|---|
| `src/lib/sequence.test.ts` | format and padding; a sixth digit past 99,999; gateway character and length rules (including Nagad's 20); the period is the property's month (18:30Z on 31 Oct is November in Dhaka, October in London) |
| `src/lib/sequence.db.test.ts` (`*_test` DB) | starts at 1, counts per (name, period), restarts each month. **50 concurrent transactions got 50 distinct, gap-free numbers 1–50.** A rolled-back transaction gave its number back. `nextBookingCode` uses the Dhaka month. **12 simultaneous `POST /api/bookings` calls** for a 12-unit room all returned 200 with 12 distinct, consecutive `RES-YYYYMM-XXXXX` codes. Passed 3 of 3 consecutive runs. |
| `room-units.db.test.ts` (existing) | offline and public booking paths, unit assignment and races: still green with the new codes |

**Live** (production build, scratch DB `resort_a2s6_test`, 7 Oct 2026): two guest bookings through `POST /api/bookings` returned `RES-202610-00001` and `RES-202610-00002`. The `Sequence` table then held `booking | 202610 | 2`.

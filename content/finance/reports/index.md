# Finance Reports — Staff Training Module

**Page:** `/admin/finance/reports` — the books as reports.
**Audience:** owners, accountants, managers.
**Time to complete:** about 15 minutes.
**Prerequisite:** the [Finance](..) module.

## Learning objectives

After this module you can read the four reports and know which question
each answers.

## 1. The four reports

`?type=trial|pnl|balance|ageing`, with `from`/`to` date ranges:

| Report | Question it answers |
|---|---|
| **Trial balance** | Do the books balance? Every account, debits = credits. The integrity check — read it first. |
| **Profit & loss** | Did we make money in this period? Income vs expenses. |
| **Balance sheet** | What do we own and owe right now? Assets, liabilities, equity. |
| **Ageing** | Who owes us, and for how long? Receivables bucketed by age — the collection priority list. |

## 2. Reading discipline

- **Trial balance first.** If it doesn't balance, nothing downstream is
  trustworthy — stop and find the break before reading P&L.
- **P&L needs a closed context.** A P&L over an open month with unposted
  records is a draft, not a result. Close the queues first.
- **Ageing drives action.** The oldest buckets are collection calls to
  make this week, not numbers to admire.

## 3. Troubleshooting

| Symptom | Check first |
|---|---|
| Trial balance doesn't balance | Unposted records or a failed posting — check the overview and server log. |
| P&L looks thin | Unposted operational records (folio charges post via night audit — has it run?). |
| Ageing empty but guests owe | The guest-receivable postings depend on folio activity — check the source postings. |

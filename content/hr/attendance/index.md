# Attendance — Staff Training Module

**Page:** `/admin/hr/attendance` — daily presence marking.
**Audience:** managers, HR staff.
**Time to complete:** about 10 minutes.
**Prerequisite:** the [HR](..) module.

## Learning objectives

After this module you can mark a day's attendance and read the monthly
view.

## 1. What the page is

One day at a time (`?date=YYYY-MM-DD`, defaulting to the business date;
never the future): every working employee that day, ordered by department
then code, with their presence to mark. Marking needs the create
permission.

## 2. The monthly view

`/admin/hr/attendance/month` aggregates the month: who was present,
absent, or on leave each day. Payroll reads attendance — an unmarked day
is a payroll question, so **mark every day, every day**. End-of-day
marking is the discipline; catching up a week later is reconstruction.

## 3. Troubleshooting

| Symptom | Check first |
|---|---|
| Employee missing from the day | Join date after the date, or left date before it — check the staff record. |
| Can't mark a future date | Correct — attendance is for days that happened. |
| Payroll disputes a day | The monthly view is the record — what was marked then is what counts. |

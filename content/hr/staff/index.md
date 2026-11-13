# Staff Records — Staff Training Module

**Page:** `/admin/hr/staff` — employee records.
**Audience:** managers, owners, HR staff.
**Time to complete:** about 10 minutes.
**Prerequisite:** the [HR](..) module.

## Learning objectives

After this module you can maintain employee records with the discipline
payroll depends on.

## 1. What the page is

Every employee: **code** (e.g. EMP-0007), name (English + Bengali),
**department**, designation, **join date**, left date, status, and
**monthly salary**. Sorted by status then code; exportable (CSV) with the
export permission.

## 2. Opening a record

The employee page gathers everything about one person: role and
department, status and dates, salary and bank account, contact, the
**linked login** (if they sign in to the admin), **leave balances**
(Casual, Sick, Annual, Unpaid — taken vs allowed), this month's
attendance at a glance, and their **payslips** once a payroll is
approved. It is the first place to look when pay, leave, or access
questions come up.

## 3. Record discipline

- **Join date starts everything.** Attendance and payroll both read it —
  a missing join date means missing pay.
- **Left date ends everything.** When someone leaves, set the left date
  *that day*. A missing left date keeps them on headcount, in attendance,
  and in the next payroll run.
- **Salary changes are snapshots.** A record holds one monthly salary —
  no dates, no proration. The payroll run takes whatever salary is on
  the record when it's built, so enter the change before the run, not
  after.
- **Codes are permanent.** Never reuse a departed employee's code.

## 4. Troubleshooting

| Symptom | Check first |
|---|---|
| Ex-employee in attendance | Left date wasn't set — set it. |
| Salary wrong in payroll | The change was entered after the run was built — rebuild or adjust next month per policy. |
| Duplicate employee | Search by code before creating — codes are unique. |

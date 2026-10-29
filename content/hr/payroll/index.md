# Payroll — Staff Training Module

**Page:** `/admin/hr/payroll` — monthly salary runs.
**Audience:** owners, managers, accountants.
**Time to complete:** about 15 minutes.
**Prerequisite:** the [HR](..) module.

## Learning objectives

After this module you understand the payroll run lifecycle and the
payslip.

## 1. What the page is

Payroll **runs**, newest first (60 kept in view): run number, month,
status, **gross**, **net**, headcount. Building a run needs the create
permission; HR.view plus the hr and payroll modules to see.

The page **suggests the month**: last month if it has no valid run yet,
otherwise the current month — so you can't accidentally skip or double a
month.

## 2. The run

Building a run snapshots every working employee's salary and attendance
for the month into **lines**: gross, deductions, net per person. Review
the lines before finalizing — a run built on a wrong staff record pays
wrong.

**Payslips** (`/admin/hr/payroll/[id]/payslip/[lineId]`) are per-person:
what was earned, what was deducted, what was paid. Give each employee
theirs; keep everyone else's private.

**VOID** is how a bad run dies — voided runs are excluded everywhere, and
a fresh run replaces them. Never edit a finalized run's numbers; void and
rebuild.

## 3. Discipline

- Staff records correct *before* the run (join/left dates, salaries).
- Attendance marked for the whole month *before* the run.
- Review lines *before* finalizing.
- Payslips are private documents — one recipient each.

## 4. Troubleshooting

| Symptom | Check first |
|---|---|
| Wrong person in the run | Staff record (join/left dates) at build time. |
| Wrong amount | Salary change entered after the build — void and rebuild, or adjust next month. |
| Suggested month looks off | It suggests the earliest month without a valid run — that's the gap to fill. |

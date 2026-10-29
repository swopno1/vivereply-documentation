# HR — Staff Training Module

**Page:** `/admin/hr` — people, attendance, payroll.
**Audience:** managers, owners, HR staff.
**Time to complete:** about 20 minutes.
**Prerequisite:** none.

## Learning objectives

After this module you can read the HR overview and know which sub-page
handles staff, attendance, and payroll.

## 1. What the page is

*"Who is working, today's attendance, the latest payroll."* The overview
shows **headcount** (working today), **monthly salary total**, breakdown
**by department**, today's attendance marking progress, and the latest
payroll runs.

## 2. The sub-pages

| Page | Docs | What it's for |
|---|---|---|
| `/admin/hr/staff` | [Staff](staff/) | Employee records |
| `/admin/hr/attendance` | [Attendance](attendance/) | Daily presence marking |
| `/admin/hr/payroll` | [Payroll](payroll/) | Monthly salary runs and payslips |

## 3. Permissions

HR.view to see; HR.create to add staff, mark attendance, and build
payroll runs. Salary figures are the property's most sensitive numbers
after guest data — the same privacy discipline applies: never on personal
phones, never in chat, never shared outside the managers who need them.

## 4. Troubleshooting

| Symptom | Check first |
|---|---|
| Headcount looks wrong | Join/left dates — someone left but the left date wasn't set. |
| Payroll module missing | The payroll flag is separate from hr — check the modules tab. |

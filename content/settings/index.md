# Settings — Staff Training Module

**Page:** `/admin/settings` — the property's configuration.
**Audience:** managers, owners.
**Time to complete:** about 20 minutes reading; changes need care.
**Prerequisite:** none.

## Learning objectives

After this module you can navigate the six tabs, know what each controls,
and understand the permission model before changing anything.

## 1. What the page is

Six tabs, each a real link (`?tab=…`), each with its own permission. The
tab bar **shows only the tabs your role can open**, and the page checks
again before rendering. **Viewing** needs the view permission;
**saving** needs SETTINGS.edit (the Users tab uses USERS.* instead).

| Tab | Docs | Permission | What it controls |
|---|---|---|---|
| **General** | [General](general/) | view / edit to save | Property identity, timezone, check-in/out windows, fees, email status |
| **Payments** | [Payments](payments/) | edit (owner-only gateway forms) | Payment gateway configuration |
| **PMS** | [PMS](pms/) | edit | PMS connections |
| **Users** | [Users](users/) | USERS.view / USERS.* to change | Staff accounts and roles |
| **Modules** | [Modules](modules/) | view | Feature flags per module |
| **Tax** | [Tax](tax/) | view | Tax configuration |

## 2. The golden rule of settings

Settings are **slow-moving truths**, not daily controls. The timezone, the
check-in window, the gateway credentials — these change rarely and affect
everything. Before changing any setting, know:

1. **What reads it** (the docs for each tab list the consumers),
2. **Whether it applies going forward or retroactively**,
3. **Who else needs to know** (front desk, at minimum).

A setting changed casually is a bug planted in every screen that reads it.

## 3. Troubleshooting

| Symptom | Check first |
|---|---|
| Tab missing from the bar | Your role can't open it — that's the permission model working. |
| Changes won't save | You need SETTINGS.edit (or USERS.* on the Users tab). |
| Something broke everywhere at once | The last settings change — check what was changed and when. |

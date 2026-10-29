# Modules Settings — Staff Training Module

**Page:** `/admin/settings?tab=modules` — feature flags.
**Audience:** owners.
**Time to complete:** about 10 minutes.
**Prerequisite:** the [Settings](..) module.

## Learning objectives

After this module you understand what module flags do and why they're
gated the way they are.

## 1. What the tab is

One switch per module: frontDesk, housekeeping, roomService, inventory,
expenses, accounting, blog, rooms, and more. A disabled module's nav item
vanishes and its pages show the gate — the property runs without that
department's screens.

## 2. The one critical exception

**Disabling a module never breaks guests' money.** The gateway payment
admin (BanglaQR queue, refunds, status checks) keeps working even with the
finance flag off — payments must never depend on a feature flag. The flag
gates only the new finance screens.

## 3. When to touch it

Module flags are for real operational changes: the property stops offering
room service, the blog is retired, a department closes for renovation.
They are not for hiding a page you don't like — that's a training issue,
not a flag issue. And like all settings: change rarely, tell the staff the
same day.

## 4. Troubleshooting

| Symptom | Check first |
|---|---|
| Nav item vanished | Its module flag is off — check this tab. |
| Page shows a gate message | Same — the module is disabled for this property. |
| Payments broken after disabling finance | Should be impossible — the gateway admin is flag-independent. Report it as a bug. |

# Users Settings — Staff Training Module

**Page:** `/admin/settings?tab=users` — staff accounts and roles.
**Audience:** owners, managers (with user rights).
**Time to complete:** about 15 minutes.
**Prerequisite:** the [Settings](..) module.

## Learning objectives

After this module you can manage staff accounts with the least-privilege
discipline the permission model expects.

## 1. What the tab is

Every staff login: name, email, **role**, active flag. Roles are the
permission bundles from the roles documentation — OWNER, MANAGER,
FRONT_DESK, STAFF, HOUSEKEEPING, AUDITOR, and friends. Everything a user
can see and do in the admin flows from their role.

**Writes here need USERS.\*** — separate from SETTINGS.edit, deliberately:
who can create accounts is a different question from who can change the
timezone.

## 2. Account discipline

- **Least privilege.** A housekeeper gets HOUSEKEEPING, not MANAGER.
  Every permission in the manuals ("needs the approve permission…") traces
  back to this tab.
- **One account per person.** Shared logins destroy the audit trail —
  every "by \{name}" in the system depends on accounts being personal.
- **Deactivate, don't delete**, when someone leaves. History keeps their
  name; a deleted account orphans it.
- **Default passwords are an emergency**, not a practice. Changed on first
  login, always.

## 3. Troubleshooting

| Symptom | Check first |
|---|---|
| Staff can't see a page | Their role lacks the module/permission — check the role against the manuals. |
| "By Unknown" in history | The account was deleted instead of deactivated. |
| Tab missing | You need USERS.view — separate from settings permissions. |

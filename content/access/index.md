# Signing In — Staff Training Module

**Pages:** `/admin/login`, `/admin/accept-invite`, `/admin/forgot-password`,
`/admin/reset-password`, `/admin/setup-2fa`, `/admin/welcome` — getting
into the system.
**Audience:** all staff.
**Time to complete:** about 10 minutes.
**Prerequisite:** none. Read this on your first day.

## Learning objectives

After this module you can sign in, set up two-factor authentication, and
recover a lost password — securely.

## 1. First login

Your account is created by an owner (see [Users](../settings/users/)) —
only owners can invite staff.
You'll receive an **invite** (`/admin/accept-invite`): open it, set your
password, and you're in. Most roles land straight on the first page
they're allowed to see; the welcome page (`/admin/welcome`) appears only
for roles with no module to open yet — then read the training modules
for your role before touching real data.

**Your first-day checklist:**

1. Accept the invite and set a strong password.
2. **Turn on two-factor authentication** (`/admin/setup-2fa`) — owners
   must have it on before they can open sensitive areas (Settings,
   Payments, user management), and it's strongly recommended for
   everyone. Your phone's authenticator app; keep the backup codes
   somewhere safe, not on the phone.
3. Read the modules for the screens your role opens.

## 2. Every day after

Sign in at `/admin/login` with your email and password (+ the
authenticator code if 2FA is on). **One account per person** — shared
logins destroy the audit trail, and every "by \{name}" in the system
depends on accounts being personal.

**Lost password?** Use `/admin/forgot-password` (linked from the login
page) — a reset link goes to your email. (`/admin/reset-password` is
only the page the link in that email opens.) Never ask a colleague for
their password, and never share yours. If you suspect someone else knows
your password, reset it immediately and tell your manager.

## 3. Session discipline

- **Sign out** on shared computers. Always. No exceptions.
- Don't stay signed in on a personal phone the property doesn't manage —
  or if you do, lock the phone.
- If your authenticator app is lost, tell an owner *before* you need
  to sign in — recovery is an owner task, not a workaround. There is no
  reset button for a lost authenticator, so don't wait until you're
  locked out.

## 4. Troubleshooting

| Symptom | Check first |
|---|---|
| Invite link expired | Ask an owner to re-send it. |
| 2FA code rejected | Phone clock wrong is the classic cause — check the time is automatic. |
| Locked out entirely | An owner can reset your access — that's what they're for. |

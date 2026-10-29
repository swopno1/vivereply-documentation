# Signing In — Staff Training Module

**Pages:** `/admin/login`, `/admin/accept-invite`, `/admin/reset-password`,
`/admin/setup-2fa`, `/admin/welcome` — getting into the system.
**Audience:** all staff.
**Time to complete:** about 10 minutes.
**Prerequisite:** none. Read this on your first day.

## Learning objectives

After this module you can sign in, set up two-factor authentication, and
recover a lost password — securely.

## 1. First login

Your account is created by a manager or owner (see [Users](../settings/users/)).
You'll receive an **invite** (`/admin/accept-invite`): open it, set your
password, and you're in. The welcome page (`/admin/welcome`) orients you —
then read the training modules for your role before touching real data.

**Your first-day checklist:**

1. Accept the invite and set a strong password.
2. **Turn on two-factor authentication** (`/admin/setup-2fa`) — required
   for owners, strongly recommended for everyone. Your phone's authenticator
   app; keep the backup codes somewhere safe, not on the phone.
3. Read the modules for the screens your role opens.

## 2. Every day after

Sign in at `/admin/login` with your email and password (+ the
authenticator code if 2FA is on). **One account per person** — shared
logins destroy the audit trail, and every "by \{name}" in the system
depends on accounts being personal.

**Lost password?** Use `/admin/reset-password` — a reset link goes to
your email. Never ask a colleague for their password, and never share
yours. If you suspect someone else knows your password, reset it
immediately and tell your manager.

## 3. Session discipline

- **Sign out** on shared computers. Always. No exceptions.
- Don't stay signed in on a personal phone the property doesn't manage —
  or if you do, lock the phone.
- If your authenticator app is lost, tell your manager *before* you need
  to sign in — recovery is a manager task, not a workaround.

## 4. Troubleshooting

| Symptom | Check first |
|---|---|
| Invite link expired | Ask your manager to re-send it. |
| 2FA code rejected | Phone clock wrong is the classic cause — check the time is automatic. |
| Locked out entirely | Your manager can reset your access — that's what they're for. |

# Phase A2 §4: user management

The owner invites, re-roles, deactivates and resets staff from `/admin/settings?tab=users`. Nobody edits the database to add a user any more.

This file is numbered 08 because the brief assigns 04–07 to later sections.

## 1. Who can do what

Every Server Action calls `requirePermission("USERS", <action>)` in its own body, outside any `try`, and then `requireMfa()` (an OWNER must have 2FA). `pnpm lint` fails if any exported action in `src/app/actions/user-actions.ts` lacks the call. `permission-enforcement.test.ts` calls all six actions as each of the ten roles plus an unknown role, and shows that refusals happen before the database is touched.

| Surface | Permission | OWNER | AUDITOR | Everyone else |
|---|---|---|---|---|
| Users tab (list) | `USERS.view` (+ `SETTINGS.view` for the page) | ✅ | ✅ read-only, no controls | 403 |
| Invite, resend invitation | `USERS.create` | ✅ | ❌ | ❌ |
| Change role, send password reset, Force 2FA | `USERS.edit` | ✅ | ❌ | ❌ |
| Deactivate / reactivate, cancel invitation | `USERS.delete` | ✅ | ❌ | ❌ |

`USERS.delete` covers deactivation because deactivating removes all access. Nothing is deleted.

**Rules enforced in `src/lib/users/accounts.ts`:**
- **No changing yourself.** The owner cannot change their own role or deactivate themselves.
- **Last active OWNER.** The last active OWNER cannot be demoted or deactivated.
- **No STAFF.** The role picker and the server accept only `ASSIGNABLE_ROLES`.
- **Concurrent role changes.** A role change is conditional on the role the server just read, so a concurrent change is not silently overwritten.

## 2. User states

The states are stored on Better Auth's admin-plugin fields (baseline N9). The plugin's own `session.create` hook refuses to sign in a banned user, and the login page shows its message: "This account is not active. Ask the owner to activate it." in English and Bengali.

| State | `banned` | `banReason` | Password | Shown as |
|---|---|---|---|---|
| Invited | true | `INVITE_PENDING` | none | Invited (with link expiry), or "Invitation expired" |
| Active | false | null | set | Active |
| Deactivated | true | `DEACTIVATED` | kept | Deactivated |

**New columns** (migration `20261001130000_user_management`, additive):
- `User.lastLoginAt`: stamped by a Better Auth `databaseHooks.session.create.after` hook. A session is created on every sign-in, after the TOTP step when 2FA is on. The stamp is best effort and never blocks sign-in.
- `User.twoFactorRequired`: set by Force 2FA.
- An index on `Verification(identifier)`.

Both columns are declared as Better Auth `additionalFields` with `input: false`, so they appear on the session user but can't be set through Better Auth's endpoints.

## 3. Invitations and reset links: tokens in the existing `Verification` table

No `Invitation` model was needed. A Verification row holds everything a token needs:

| Column | Invitation | Password reset |
|---|---|---|
| `identifier` | `user-invite:` + SHA-256(token) | `user-password-reset:` + SHA-256(token) |
| `value` | the user's id | the user's id |
| `expiresAt` | now + **72 h** (brief) | now + **24 h** |

**The token itself:**
- 32 random bytes in base64url (256 bits), placed in the link as `?token=`.
- Only its hash is stored, so reading the database gives no usable link.
- A malformed token is rejected before any query.

**Separate from Better Auth.** The prefixes differ from Better Auth's own (`reset-password:` and so on), so its endpoints can never consume these rows, and vice versa. Better Auth's self-service "forgot password" stays off: `sendResetPassword` is not configured, so resets are OWNER-initiated only, as the brief says.

**Single use.**
- A token is consumed by `deleteMany({ id })` inside the transaction that sets the password. Only the caller that actually deleted the row proceeds, so three simultaneous submissions produce exactly one account (tested).
- Accepting an invitation also deletes any other invitation tokens for that user. A new invitation or reset link replaces older ones, but only after the new email has been sent.

**Public endpoints.** `POST /api/account/accept-invite` and `POST /api/account/reset-password` are public route handlers, not Server Actions, because the caller has no session yet. They live outside `/api/admin`, so the admin-route guard check doesn't apply; the token is the credential.
- They allow 10 attempts per 15 minutes per IP (in memory, per process). The IP comes from the proxy-set `x-real-ip` or the last `x-forwarded-for` entry, never the client-controlled first entry.
- The pages `/admin/accept-invite` and `/admin/reset-password` are added to the middleware's public list. They check the token read-only, show the form or "This link doesn't work", and render without the admin shell.

### Invitation flow
1. The OWNER enters an email, a role (each role shows its description) and an optional note (500 characters at most).
2. The server creates the user as **Invited** (name = the part of the email before `@`) and a token, in one transaction.
3. The email is sent (§4). On success, `USER_INVITED` is audited, with the note and the expiry.
4. The invitee opens the link, sets their name and a password (8 to 128 characters, Better Auth's own limits), and submits. In one transaction:
   - the token is consumed;
   - a Better Auth credential account is created (the password is hashed with `auth.$context.password.hash`);
   - the user becomes Active with `emailVerified = true`;
   - `USER_INVITE_ACCEPTED` is audited.
5. The page signs them in and offers "Set up 2FA now" or "Continue without 2FA". Setup-2fa now continues to the user's own landing page, not always Settings. An OWNER, or a user an OWNER forced, cannot skip 2FA.

**Resend:** use "Resend invitation" on the card, which invites the same email again, optionally with a new role. **Cancel:** deletes the Invited user and their tokens (`USER_INVITE_CANCELLED`).

### Password reset flow
- **Sending.** The OWNER chooses "Reset password". This is only allowed for Active users; an invitee needs a resend instead, and a deactivated user must be reactivated first. The email carries a 24-hour link, and `PASSWORD_RESET_SENT` is audited.
- **Completing.** The user sets a new password. In one transaction the token is consumed, the credential password is replaced, **every session of the user is deleted**, and `PASSWORD_RESET_COMPLETED` is audited. The old password stops working; the new one works.
- **Deactivation** also deletes any pending reset links.

## 4. Email, and what happens when it fails

**Sender.** `getEmailFrom(label)`, new in `src/lib/email/sender.ts` (baseline N7). It reads `RESEND_FROM_EMAIL` and falls back to `onboarding@resend.dev`.
- A value that isn't a bare address (for example `Name <x@y>`, or anything containing CR/LF) **throws**, so the send fails instead of going out from a wrong or injectable header.
- Characters that would break the `From` header are removed from the label.
- The new invitation and reset emails use it, and so do the existing booking, lead and blog emails in `email/index.ts` and `email/blog.ts` (sender line only).
- ~~The four payment email modules still hard-code the default.~~ Fixed by FU-5 (2026-10-07): every module uses `sendEmail()`, and production defaults to `bookings@<brand domain>`. See docs/EMAIL.md.

**Sending.** `sendEmail()`:
- **No `RESEND_API_KEY` in production:** the send **fails**. Before, the booking emails reported a mocked success in that case, which is unchanged for them.
- **No key outside production:** it logs a mocked send, and the account emails also log the link so development works without Resend.
- It has a 10-second timeout, and anything but a 2xx response with an `id` counts as a failure.

**Content.** `src/content/emails/invitation.ts` and `password-reset.ts` hold the copy in English and Bangla. Every email contains both languages, because the recipient's language isn't known. The role appears in each language's label, and every interpolated value is HTML-escaped (the note and names are typed by people).

**Failure policy (decided): roll back.** When the invitation email can't be sent:
- For a **first invitation**, the new User row and its token are deleted.
- For a **resend**, only the new token is deleted; the earlier link keeps working, and the role is not changed.
- `USER_INVITE_FAILED` is audited with the email, the role, the error, and what was rolled back (`user_and_token` or `token`).
- The OWNER sees "The email could not be sent, so nothing was saved…" inside the invite dialog.
- No half-created account is ever left behind, and retrying is the same action as the first attempt.

**Why rollback rather than invalidating the token:** an Invited user whose token is dead can never become active. It would sit in the list as clutter and block that email address until someone cancelled it. With rollback, the database matches what the OWNER believes happened.

**Password reset** follows the same rule: a failed send deletes its token (nothing else had changed) and audits `PASSWORD_RESET_FAILED`. The user's current password keeps working.

## 5. Audit trail (module `USERS`, entity `User`, written in the same transaction as the change)

| Action | When | `diff` |
|---|---|---|
| `USER_INVITED` | invitation (or resend) sent | `before`: null or `{role,status}`; `after`: `{role, status:"invited"}` |
| `USER_INVITE_FAILED` | email not sent, rolled back | metadata: error, `rolledBack` |
| `USER_INVITE_ACCEPTED` | invitee set a password (actor = invitee) | `{status}` before/after |
| `USER_INVITE_CANCELLED` | OWNER cancelled | before `{role,status}`, after null |
| `USER_ROLE_CHANGED` | role changed | `{role}` before/after |
| `USER_DEACTIVATED` / `USER_REACTIVATED` | status toggled | `{active}` before/after |
| `PASSWORD_RESET_SENT` / `PASSWORD_RESET_FAILED` | reset email | metadata: email, expiry or error |
| `PASSWORD_RESET_COMPLETED` | user set a new password (actor = user) | — |
| `USER_2FA_REQUIRED` / `USER_2FA_REQUIREMENT_REMOVED` | Force 2FA toggled | `{twoFactorRequired}` before/after |

Every row carries the actor (`userId`), the request IP and the user agent. The new `auditRow()` in `src/lib/audit.ts` builds the row so it can be written inside the business transaction; `logAudit()` now uses it too.

## 6. Force 2FA

"Require 2FA" sets `User.twoFactorRequired`. `requireAuth()`, which every `requirePermission()` goes through, then sends a user who hasn't enrolled to `/admin/setup-2fa` **on their next request**, not only at the next login. So the user can open nothing else until they enrol. The setup page uses the new `requireSignedIn()` so it doesn't loop.
- OWNERs are always required (`requireMfa`), so the button isn't shown for them.
- Removing the requirement doesn't turn off 2FA a user has already set up.

## 7. Evidence

### Automated
| Suite | What it proves |
|---|---|
| `src/lib/users/accounts.db.test.ts` (16, `*_test` DB) | Invite creates an Invited, sign-in-blocked user with a hashed 72 h token and audit. **An email failure rolls back the user and token** (a mutation that skips the rollback fails the test, checked). A failed resend keeps the old link and role; a successful one replaces them. Taken email, STAFF, bad email and an over-long note are refused. Accept: bad input doesn't use up the token; one accept wins a 3-way race; expired links refused; sign-in works and stamps `lastLoginAt`. The public route answers 400/200/429. Cancel. Role change audit; self and last-OWNER refusals. Deactivate deletes sessions and reset links, blocks sign-in, and reactivate restores it. Reset: 24 h, single use, old password refused, sessions revoked. A failed reset email deletes its token. Force 2FA audit. |
| `src/app/actions/permission-enforcement.test.ts` | All 6 user actions × 10 roles + an unknown role match the matrix, with the refusal before any DB access. |
| `src/lib/auth-helpers.test.ts` | Force 2FA redirects every guard to setup-2fa until enrolled; the setup page does not loop; users who are not forced are unaffected. |
| `src/lib/email/sender.test.ts`, `account.test.ts` | `getEmailFrom` default, env, rejection of a non-bare address or header injection, and label stripping. The production no-key case fails. Resend success and failure parsing. Both languages, escaping, links, expiries. |
| `src/lib/users/tokens.test.ts` | Token shape, hashing, prefixes, TTLs; a malformed token never queries the DB. |

### Live (scratch DB `resort_a2s4_test`, since dropped)
The dev server (`next dev`, no Resend key, so links are logged) was used for the success path, and a production build (`next start`) for the failure path and the 403s. Everything ran at a 360px viewport. The owner was `test-owner@demo.resort` with 2FA really enrolled (TOTP computed in the page).

- **Users tab:** 9 seeded users listed, no horizontal scroll (`scrollWidth` 345 at 360), and also checked in Bengali. The invite dialog is 328px wide.
- **Invite** `rina.frontdesk@example.com` as FRONT_DESK with a note. The UI showed "Invitation sent to rina.frontdesk@example.com." and the card showed "Invited | Front Desk | … | Link expires Oct 4, 2026, 3:47 AM". Logged:
  ```
  [Mock Resend Email] "You're invited to the Client Resort & Spa admin | Client Resort & Spa অ্যাডমিনে যোগ দেওয়ার আমন্ত্রণ" to rina.frontdesk@example.com from Client Resort & Spa Team <onboarding@resend.dev>
  [Mock Resend Email] Invitation link: http://localhost:3100/admin/accept-invite?token=…
  ```
- **Accept** in a separate signed-out browser. The form showed the email read-only; after submitting, it showed "Your account is active." with the 2FA offer. "Continue without 2FA" landed on `/admin/bookings`. Reopening the link showed "This link doesn't work".
- **Require 2FA** (confirmation dialog, then the "2FA required" badge). Rina signed in and requested `/admin/bookings`, and landed on `/admin/setup-2fa` ("Set Up Two-Factor Authentication"). This proves the session user carries the flag.
- **Change role** FRONT_DESK → HOUSEKEEPING, then **reset password**, then **deactivate**. Rina now had `banned=true, DEACTIVATED`, **0 sessions, 0 tokens** (the pending reset link was revoked). The login form showed "This account is not active. Ask the owner to activate it. / এই অ্যাকাউন্টটি সক্রিয় নয়। …". The revoked reset link showed "This link doesn't work".
- **Reactivate**, then a new reset. On the reset page, a mismatched confirmation showed "The two passwords don't match."; the correct one showed "Your password has been changed…". Then the **old password returned 401 and the new one 200**.
- **AUDITOR:** 10 users listed, the "View only" notice, and 0 invite, action or role controls. **MANAGER and FRONT_DESK:** `NEXT_HTTP_ERROR_FALLBACK;403` on `/admin/settings?tab=users`.
- **Production build without `RESEND_API_KEY`:** inviting `undelivered.kitchen@example.com` showed "The email could not be sent, so nothing was saved. Check the email settings and try again." inside the dialog. The database then had 0 users with that email, 0 orphan invitation tokens, and:
  ```
  USER_INVITE_FAILED|{"email":"undelivered.kitchen@example.com","role":"KITCHEN","resent":false,"error":"RESEND_API_KEY is not set","rolledBack":"user_and_token"}
  ```
- **Audit trail of the run:**
  ```
  USER_INVITED|test-owner@demo.resort|{"after": {"role": "FRONT_DESK", "status": "invited"}, "before": null}
  USER_INVITE_ACCEPTED|rina.frontdesk@example.com|{"after": {"status": "active"}, "before": {"status": "invited"}}
  USER_2FA_REQUIRED|test-owner@demo.resort|{"after": {"twoFactorRequired": true}, "before": {"twoFactorRequired": false}}
  USER_ROLE_CHANGED|test-owner@demo.resort|{"after": {"role": "HOUSEKEEPING"}, "before": {"role": "FRONT_DESK"}}
  PASSWORD_RESET_SENT|test-owner@demo.resort|
  USER_DEACTIVATED|test-owner@demo.resort|{"after": {"active": false}, "before": {"active": true}}
  USER_REACTIVATED|test-owner@demo.resort|{"after": {"active": true}, "before": {"active": false}}
  PASSWORD_RESET_SENT|test-owner@demo.resort|
  PASSWORD_RESET_COMPLETED|rina.frontdesk@example.com|
  ```

### Found and fixed during the live run
1. **The floating concierge button covered the last card's buttons** at 360px. The panel now has bottom padding; the last card's buttons were confirmed tappable.
2. **Invite errors were hidden behind the dialog overlay.** They now show inside the dialog; the alert was confirmed within the viewport.

## 8. Limits and follow-ups
- **The rate limit is per process and in memory.** It is enough given 256-bit tokens, but it isn't shared across PM2 instances.
- **The settings tab bar has only General and Users.** Section 5 adds Payments, PMS, Modules and Tax, and folds in `/settings/payments` and `/settings/integrations`.
- **The General tab still has its non-functional Save** until Section 5.
- **Resend was not called for real,** because there is no API key locally. Success and failure parsing are unit-tested with the Resend response shape. The first real invitation on a deployed site should be sent to an address the owner controls.
- **The site-wide cookie-consent banner** covers form buttons at 360px until it is dismissed, on every page, not only these. This is pre-existing and not changed here.

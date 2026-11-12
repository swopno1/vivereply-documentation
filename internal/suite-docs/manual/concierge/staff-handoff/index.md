# Concierge — Staff Handoff

**What:** the staff side of the Concierge — the handoff queue and how
the bridge key is secured.
**Audience:** front desk, managers, owners (setup).
**Time to complete:** about 15 minutes.
**Prerequisite:** the [Concierge overview](..).

## Learning objectives

After this module you can work handoffs from the Suite and understand
the bridge-key security model.

## 1. The handoff queue

When the Concierge can't resolve something, the conversation lands in
the handoff queue at **`/admin/chatbot-admin`** with its full
transcript: list, filter, read transcripts, add notes, assign, close and
reopen. (The old `/admin/concierge-handoffs` address redirects there, so
old bookmarks keep working.)

**Permission:** FRONT_DESK.view to see the queue — owners, managers,
front desk, staff, and auditors. Assigning, noting, and closing need
FRONT_DESK.edit, so auditors are read-only. A handoff is a guest
waiting: treat the queue like the verification queue — **work it the
moment entries appear**.

## 2. How the queue is secured

The queue is a native Suite board over the bridge API — no iframe, no
embed tokens:

- **Bridge keys** are minted in the Concierge app's Settings → Bridge
  keys, named per consumer (e.g. "demo1 dashboard") and scoped to one
  tenant. The key is **shown once** — like a password, it's never pasted
  in chat or email.
- The key lives on the Suite's server — in **Settings → Chatbot**
  (stored encrypted) or the `CONCIERGE_BRIDGE_KEY` environment variable,
  which takes precedence — and **never reaches the browser**.

**Setup (owner, one time):** (1) mint the bridge key in the Concierge
settings, (2) paste it into the Suite's **Settings → Chatbot** (no
redeploy needed) or set `CONCIERGE_BRIDGE_KEY` in the hosting
environment. Until then, the page shows a setup notice.

## 3. Working a handoff — discipline

1. **Read the transcript first.** The guest already explained themselves
   once — never make them repeat it.
2. **Continue in the guest's language.** The transcript shows which.
3. **Resolve or escalate, then close.** A closed handoff with no
   resolution is a guest ignored — the audit trail will show it.
4. **Notes are for the next shift.** What was promised, what's pending.

## 4. Troubleshooting

| Symptom | Check first |
|---|---|
| Setup notice: missing key | The bridge key was never set — owner task: Settings → Chatbot, or the env var. |
| "The Chatbot did not respond" | The key was revoked or the Chatbot app is unreachable — check the key, then refresh. |
| Handoff has no transcript | Report it — every handoff should carry its conversation. |

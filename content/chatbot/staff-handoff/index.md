# Chatbot — Staff Handoff

**What:** the staff side of the Chatbot — the handoff queue and how the
embed is secured.
**Audience:** front desk, managers, owners (setup).
**Time to complete:** about 15 minutes.
**Prerequisite:** the [Chatbot overview](..).

## Learning objectives

After this module you can work handoffs from the Suite and understand
the bridge-key security model.

## 1. The handoff queue

When the Chatbot can't resolve something, the conversation lands in
**`/admin/concierge-handoffs`** with its full transcript. This page is
also the **manage path** for the Chatbot's conversations: list, filter,
read transcripts, add notes, assign, close and reopen.

**Permission:** FRONT_DESK.view — owners, managers, front desk, staff,
and auditors can work it. A handoff is a guest waiting: treat the queue
like the verification queue — **work it the moment entries appear**.

## 2. How the embed is secured

The staff widget is an iframe to the Chatbot (Chatbot) app (`{CONCIERGE_URL}/staff/embed`),
and it's locked down in layers:

- **Bridge keys** are minted in the Chatbot (Chatbot) app's Settings → Bridge
  keys, named per consumer (e.g. "demo1 dashboard") and scoped to one
  tenant. The key is **shown once** — like a password, it's never pasted
  in chat or email.
- The key lives in the Suite's server environment
  (`CONCIERGE_BRIDGE_KEY`) and **never reaches the browser**.
- Each page load mints a fresh **15-minute embed token** via a
  server-side call — the iframe gets the token, never the key.

**Setup (owner, one time):** (1) mint the bridge key in the Chatbot
settings, (2) set `CONCIERGE_BRIDGE_KEY` in the Suite's hosting
environment, (3) redeploy. Until then, the page shows a setup notice
explaining what's missing — missing key vs. bad origin are distinguished
so you're never guessing.

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
| Setup notice: missing key | The bridge key was never minted or the env var isn't set — owner task. |
| Setup notice: bad origin | The Suite's domain isn't approved for the tenant — see [Setup](setup/). |
| Handoff has no transcript | Report it — every handoff should carry its conversation. |
| Token expired mid-session | Tokens live 15 minutes per page load — reload the page for a fresh one. |

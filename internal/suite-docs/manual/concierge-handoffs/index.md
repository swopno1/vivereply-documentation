# Concierge Handoffs — Staff Training Module

> **Naming note:** `/admin/concierge-handoffs` now redirects to
> `/admin/chatbot-admin`, where the queue lives as a native Suite board.
> The workflow described here stays the same.

**Page:** `/admin/chatbot-admin` (the old `/admin/concierge-handoffs`
address redirects here) — AI concierge conversations that need a human.
**Audience:** front desk, managers, staff, auditors.
**Time to complete:** about 15 minutes.

## Learning objectives

After this module you can:

- Explain what a "handoff" is and why it lands on this page.
- Work a handoff on the board: read the transcript, add notes, assign,
  close/reopen.
- Know what to do when the page shows a setup notice or a connection
  error.

## 1. What a handoff is

Vivereply Concierge (the AI front-desk agent on the booking site) handles
most guest questions itself — availability, quotes, booking drafts. When it
can't, or shouldn't, it **hands the conversation to a human**: a tricky
request, an upset guest, something outside its tools. Those conversations
appear here.

This page is a native Suite board over the bridge API — list/filter
tabs, transcript, follow-up notes, assign, close/reopen. One tool, one
record, no divergence.

## 2. Security model (why it works this way)

The queue talks to the Concierge app over the bridge API. One deliberate
choice:

- **The bridge key never reaches the browser.** The page is a server
  component: the key stays on the server (Settings → Chatbot, encrypted,
  or the `CONCIERGE_BRIDGE_KEY` env var) and every queue action goes
  through server-side calls. Staff never see or handle any key.

## 3. Working a handoff

Inside the board: pick a handoff from the list, **read the full transcript
first** (never reply blind), add a follow-up note if needed, **assign** it
to whoever owns the answer, and **close** it when resolved. Reopen if the
guest comes back.

**Discipline:** a handoff is a guest waiting. Triage new ones at the start
of every shift alongside the daily sheet.

## 4. Setup and troubleshooting

| What you see | Meaning | What to do |
|---|---|---|
| Setup notice: no bridge key | The dashboard isn't connected to Concierge yet | Manager/owner task: mint a key in Concierge Settings → Bridge keys ("demo1 dashboard", shown once), paste it into Settings → Chatbot (encrypted, no redeploy) — or set the `CONCIERGE_BRIDGE_KEY` env var, which takes precedence. |
| "The Chatbot did not respond" | Key revoked or Concierge unreachable | Check the key is still active in Bridge keys, then refresh. |

**Who sees this page.** Front-desk view permission: owner, manager,
front desk, staff, auditor.

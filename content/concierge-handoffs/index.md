# Concierge Handoffs — Staff Training Module

> **Naming note:** this page documents the Suite screen that works the
> **ViveReply Chatbot's** handoff queue (current build: *ViveReply
> Concierge* — hence the route name). The workflow described here stays
> the same even if labels change later.

**Page:** `/admin/concierge-handoffs` — AI concierge conversations that need
a human.
**Audience:** front desk, managers, staff, auditors.
**Time to complete:** about 15 minutes.

## Learning objectives

After this module you can:

- Explain what a "handoff" is and why it lands on this page.
- Work a handoff inside the widget: read the transcript, add notes, assign,
  close/reopen.
- Know what to do when the widget asks you to refresh, or shows a setup
  notice.

## 1. What a handoff is

ViveReply Chatbot (the AI front-desk agent on the booking site — current
build: *ViveReply Concierge*) handles
most guest questions itself — availability, quotes, booking drafts. When it
can't, or shouldn't, it **hands the conversation to a human**: a tricky
request, an upset guest, something outside its tools. Those conversations
appear here.

This page doesn't re-implement the handoff tools — it embeds the Chatbot's
own **staff widget** (list/filter, transcript, follow-up notes, assign,
close/reopen). One tool, one record, no divergence.

## 2. Security model (why it works this way)

The widget runs inside the Chatbot (Concierge) app, not the demo — this page is a
window into it. Two deliberate choices:

- **The bridge key never reaches the browser.** The page is a server
  component: the key is read on the server, which mints a fresh **15-minute
  embed token** on every page load and renders the widget with it. Staff
  never see or handle any key.
- **An expired widget tells you to refresh the page** — which mints a fresh
  token. It never asks you for credentials.

## 3. Working a handoff

Inside the widget: pick a handoff from the list, **read the full transcript
first** (never reply blind), add a follow-up note if needed, **assign** it
to whoever owns the answer, and **close** it when resolved. Reopen if the
guest comes back.

**Discipline:** a handoff is a guest waiting. Triage new ones at the start
of every shift alongside the daily sheet.

## 4. Setup and troubleshooting

| What you see | Meaning | What to do |
|---|---|---|
| Setup notice: no bridge key | The dashboard isn't connected to Concierge yet | Manager/owner task: mint a key in Concierge Settings → Bridge keys ("demo1 dashboard", shown once), set `CONCIERGE_BRIDGE_KEY` in the demo's Vercel env, redeploy. |
| Setup notice: origin | The dashboard's origin isn't a usable https origin | Set `CONCIERGE_DASHBOARD_ORIGIN` to the dashboard's full https origin, redeploy. |
| "Concierge did not return a token" | Key inactive or Concierge unreachable | Check the key is still active in Bridge keys, then refresh. |
| Widget asks to refresh | The 15-minute token expired | Reload the page — a fresh token is minted automatically. |

**Who sees this page.** Front-desk view permission: owner, manager,
front desk, staff, auditor.

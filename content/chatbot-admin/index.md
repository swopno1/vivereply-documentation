# Chatbot Admin — Staff Training Module

> **Naming note:** this page documents the Suite screen that works the
> **ViveReply Chatbot's** handoff queue (current build: *ViveReply
> Concierge* — hence the old route name). `/admin/concierge-handoffs`
> now redirects to `/admin/chatbot-admin`, where the queue lives as a
> native Suite board. The workflow described here stays the same.

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

ViveReply Chatbot (the AI front-desk agent on the booking site — current
build: *ViveReply Concierge*) handles
most guest questions itself — availability, quotes, booking drafts. When it
can't, or shouldn't, it **hands the conversation to a human**: a tricky
request, an upset guest, something outside its tools. Those conversations
appear here.

This page is a native Suite board over the bridge API — list/filter
tabs, transcript, follow-up notes, assign, close/reopen. One tool, one
record, no divergence.

## 2. Security model (why it works this way)

The queue talks to the Chatbot (Concierge) app over the bridge API. One deliberate
choice:

- **The bridge key never reaches the browser.** The page is a server
  component: the key stays on the server (Settings → Chatbot, encrypted,
  or the `CONCIERGE_BRIDGE_KEY` env var) and every queue action goes
  through server-side calls. Staff never see or handle any key.

## 3. The board

The page opens with its own one-line brief: *"Guests talk to the chatbot
first. When it can't answer, the guest is handed to the front desk. Your
team answers on this page."*

Three tabs — **Open**, **In progress**, **Closed** — each with its count,
plus a search box (*Name, room, booking or message*) and a priority
filter. Each handoff card carries badges for what the guest already did
(*Incoming booking*, *Contact shared*) and the note/reply counts, so you
can triage without opening everything.

**Discipline:** a handoff is a guest waiting. Triage new ones at the start
of every shift alongside the daily sheet.

## 4. Working a handoff

Open a handoff and read the **full transcript first** — never reply blind.
The detail view has, top to bottom:

- **Guest Info**: name, phone, booking, and a verification flag.
- **Guest Contact**: the contact details the guest shared in chat. If the
  guest shared a phone number, it appears here — that is the number to
  call back on.
- **Transcript**: Guest, Chatbot and system lines in order, including who
  joined the conversation.
- **Internal notes** with **Add note**: follow-up notes are internal — the
  guest never sees them. Note the answer you gave and anything the next
  shift must know.
- **Assign to me** (or **Assign to…** + Assign): whoever owns the answer.
- **Start progress** / **Close** / **Reopen**: closing hands the guest back
  to the chatbot; reopening pauses the chatbot for that guest again.

A standing warning in the detail panel: **DO NOT share payment details
with guests.** Never send payment links, account numbers, or transaction
IDs in chat — direct the guest to pay through the website or at the desk.

## 5. Replying to the guest

The reply composer is **gated behind Reopen**: on a closed handoff you
first see *Reopen to compose a reply*. Reopening pauses the chatbot for
that guest, so only reopen when you are ready to write — the guest is
yours from that moment until you close again.

The composer itself is deliberately small:

- Heading **REPLY TO GUEST** with the subtext *"The guest sees this in
  the chat, under your name."*
- One text area (*Write to the guest…*) and a **Send reply** button that
  stays disabled until you have written something.
- No templates, no attachments, no character count in this version:
  write plainly, keep it short, and re-read once before sending.

After sending, add an internal note recording what you promised, then
**Close** the handoff to hand the guest back to the chatbot.

## 6. Setup and troubleshooting

| What you see | Meaning | What to do |
|---|---|---|
| Setup notice: no bridge key | The dashboard isn't connected to Concierge yet | Manager/owner task: mint a key in Chatbot Settings → Bridge keys ("demo1 dashboard", shown once), paste it into Settings → Chatbot (encrypted, no redeploy) — or set the `CONCIERGE_BRIDGE_KEY` env var, which takes precedence. |
| "The Chatbot did not respond" | Key revoked or Concierge unreachable | Check the key is still active in Bridge keys, then refresh. |

**Who sees this page.** Front-desk view permission: owner, manager,
front desk, staff, auditor.

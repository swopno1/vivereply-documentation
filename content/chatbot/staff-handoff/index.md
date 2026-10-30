# Chatbot — Staff Handoff

**What:** the staff side of the Chatbot — the handoff queue, how to work
it, and how the bridge-key security model works.
**Audience:** front desk, managers, owners (setup).
**Time to complete:** about 20 minutes.
**Prerequisite:** the [Chatbot overview](..).

## Learning objectives

After this module you can work handoffs from the Suite admin, from your
own dashboard via the Bridge API, and understand the bridge-key security
model.

## 1. What a handoff is

When the Chatbot can't resolve something — a 25-person group booking, a
special request, a complaint, a confused guest — it doesn't guess. It
summarizes the conversation, saves the full transcript, and creates a
**handoff**: a work item for your staff with everything they need to take
over.

A handoff has:
- **Reason** — why the AI handed off (e.g. "Group booking — 25 guests")
- **Summary** — what the guest wants, in a paragraph
- **Transcript** — the full conversation, on demand
- **Status** — `OPEN` → `IN_PROGRESS` → `CLOSED`
- **Assignee** — which staff member owns it
- **Notes** — follow-up notes from staff

## 2. Working the queue in the Suite admin

Open **/admin/chatbot-admin** in your Suite admin. (The old
`/admin/concierge-handoffs` URL redirects here.)

**Permission:** `FRONT_DESK.view` — owners, managers, front desk, staff,
and auditors can work it.

The page shows three tabs — **Open**, **In progress**, **Closed** — with
counts. Each row expands to show:

1. **Guest transcript** — loaded on demand; what the guest actually said.
2. **Follow-up notes** — what staff have recorded.
3. **Assign** — type a staff name and assign. An unassigned handoff is
   nobody's job.
4. **Status buttons** — Start progress, Close, Reopen.
5. **Add a note** — the note is attributed to you (the signed-in staff
   member), never a free-form name.

**The golden rule:** a handoff is a guest waiting. Work the queue the
moment entries appear — triage twice daily at minimum. An OPEN handoff
older than 24 hours is a failure.

### Workflow

1. **Open** the tab, pick the oldest OPEN handoff.
2. **Read** the transcript — understand what the guest wants.
3. **Assign** it to yourself (or the right person).
4. **Act** — call the guest, check the booking in your admin, do the work.
5. **Note** what you did ("Called guest, offered Nov 14–16 alternative").
6. **Close** with a reason. "Guest booked via phone" beats silence.

## 3. Working handoffs from your own dashboard

If your team lives in another dashboard, use the
[Bridge API](../bridge-api): list, read with transcript, assign, close,
and add notes — all as JSON from your own servers.

## 4. How the bridge is secured

Bridge keys are minted in the Chatbot app's **Settings → Bridge keys**,
named per consumer (e.g. `demo1 dashboard`) and scoped to one property.
The key is **shown once** — like a password, never paste it in chat or
email.

- The key lives in the Suite's server environment (`CONCIERGE_BRIDGE_KEY`)
  and **never reaches the browser**.
- Each key sees **only its own property's** handoffs.
- Revoking a key in Settings kills it instantly.

**Setup (owner, one time):**
1. Mint the bridge key in the Chatbot Settings → Bridge keys.
2. Set `CONCIERGE_BRIDGE_KEY` in the Suite's hosting environment variables.
3. Redeploy. The queue loads on next visit.

Until the key is configured, the page shows a setup notice instead of a
broken queue.

## 5. Best practices

- **Assign by name, immediately.** The queue is triage, not a inbox to
  admire.
- **Note actions, not thoughts.** "Called guest" > "following up."
- **Close with a reason.** Future-you will thank present-you.
- **Audit keys monthly.** Revoke what you don't recognize.

More: [Best Practices](../best-practices).

## Related

- [Guest Chat](../guest-chat) — what the guest experienced
- [Bridge API](../bridge-api) — the developer reference
- [Verification & Privacy](../verification-privacy)

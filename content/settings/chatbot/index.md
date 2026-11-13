# Chatbot Settings — Staff Training Module

**Page:** `/admin/settings?tab=chatbot` — connecting the website chatbot.
**Audience:** owners (only).
**Time to complete:** about 15 minutes.
**Prerequisite:** the [Settings](..) module.

## Learning objectives

After this module you can connect (or disconnect) the AI chatbot on the
booking website and the staff handoff board — and you know which piece
each field controls.

## 1. What the tab is

The tab opens with its own 4-step setup guide: create the property in
the Chatbot app, take the property key, mint a bridge key, paste both
here and test. Follow the steps in order — each one unlocks the next.

## 2. The fields

- **Chatbot Status** — whether the widget is on or off. Off means no
  chatbot on the website at all.
- **Property key** — which property the chatbot answers for. One key,
  one property; the wrong key answers for the wrong place.
- **Bridge key** — the server-to-server credential that powers the
  [staff handoff board](../../chatbot-admin/). It is **stored**
  (encrypted) and shown as stored — never displayed again after saving.
  Mint it in the Chatbot app's Bridge keys screen; a revoked key breaks
  the board until replaced.
- **Show chatbot** — the widget switch. Off hides the chatbot from the
  website without deleting any configuration.

**Test the connection** after any change: the tab reports success or
tells you which side (key, URL, reachability) failed.

## 3. Who can touch it

Owner-only, like payment credentials. The bridge key is a server
credential with guest-conversation scope — it never reaches the
browser (the handoff board is server-rendered for exactly this
reason) and it never belongs in chat, email, or screenshots.

## 4. Troubleshooting

| Symptom | Check first |
|---|---|
| Widget missing from the website | Status off, or the Show switch is off — check both. |
| Handoff board shows a setup notice | No bridge key saved — mint one and paste it here. |
| "The Chatbot did not respond" | The stored key was revoked, or the Chatbot app is unreachable — check the key first, then the app URL. |
| Tab missing | Owner-only — your role can't open it. |

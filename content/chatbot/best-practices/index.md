# Best Practices

Advice from running the Chatbot on a live demo property. These are
operational habits, not features — they determine whether the Chatbot earns
trust or creates work.

## For owners

### Keep your catalogue accurate

The Chatbot can only quote rooms in your catalogue, at your catalogue's
rates. A stale rate means a wrong quote — and the quote is a promise.

- Update nightly rates **before** the season changes, not after.
- If a room is under renovation, remove it from the catalogue or mark it
  unavailable. "The AI said it was free" is a dispute you will lose.
- Room names guests type won't always match yours ("villa" vs "Terracotta
  Villa"). The Chatbot corrects common variants, but keep names simple and
  distinctive.

### Keep the stored email accurate

Booking verification emails go to the address **on the booking**. A typo at
check-in means the guest can't verify by email later. Treat the email field
as infrastructure, not paperwork.

### Review handoffs every morning

Handoffs are your highest-value conversations — guests who wanted something
beyond one room. A same-day response turns them into bookings; a three-day
silence turns them into lost guests. See
[Staff Handoff](/chatbot/staff-handoff) for the workflow.

### Don't promise what the roadmap hasn't shipped

The Chatbot is an MVP. Today it does six things well (see
[Capabilities](/chatbot/capabilities)). Seasonal rates, payments, and
WhatsApp are roadmap items — don't advertise them to guests yet.

## For staff

### Work the queue, don't watch it

- **Triage twice daily** (morning + evening). OPEN handoffs older than 24
  hours are failures — assign or close them.
- **Assign by name.** An unassigned handoff is nobody's job.
- **Note what you did, not what you think.** "Called guest, offered Nov 14–16
  alternative" beats "following up."

### Trust the transcript, verify the booking

The handoff transcript shows what the guest **said**. For anything involving
money or dates, re-check the booking in your own admin before acting. The
transcript is context, not a system of record.

### Close with a reason

A closed handoff with no note is a mystery next month. One line — "guest
booked via phone", "duplicate", "no longer needed" — is enough.

## For developers (bridge integrators)

- **Mint one key per integration** (e.g. `demo1 dashboard`, `mobile app`).
  When you rotate, you know exactly what breaks.
- **Never log the key.** If it appears in an error message, that's a bug —
  fix the logging, then rotate the key.
- **Poll, don't hammer.** The list endpoint is newest-first; poll on an
  interval that matches your staffing (e.g. every 5 minutes during the day),
  not every second.
- **Handle 401 by alerting, not retrying.** A 401 almost always means the key
  was revoked. Retry loops against a dead key are noise — page a human.

## Data hygiene checklist (monthly)

- [ ] Catalogue rates match the current season
- [ ] Unavailable rooms removed or blocked
- [ ] Staff list current (remove departed staff from assignees)
- [ ] Bridge keys audited (revoke unused ones)
- [ ] Handoff queue at zero OPEN older than 7 days

## Related

- [Capabilities](/chatbot/capabilities)
- [Staff Handoff](/chatbot/staff-handoff)
- [Troubleshooting](/chatbot/troubleshooting)
- [Bridge API](/chatbot/bridge-api)

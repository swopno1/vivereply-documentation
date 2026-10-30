# Chatbot — Guest Chat

**What:** what the guest experiences in the chat widget, step by step.
**Audience:** front desk, managers — know what the Chatbot tells guests
so you can back it up.
**Time to complete:** about 15 minutes.
**Prerequisite:** the [Chatbot overview](..).

## Learning objectives

After this module you can describe the guest's conversation flow, explain
what happens at each step, and answer "the chat told me X — is that right?"

## 1. Opening the chat

The guest clicks the chat button on the property's website — a small
pill in the bottom-right corner. A panel opens with the property's
branding. No login, no app download — it's a conversation, the way they'd
talk to a front-desk agent.

![Chat widget button on the resort website](/images/chatbot/widget-button.png)

The open panel greets the guest and offers suggestion chips to start —
including a Bengali option:

![Open chat panel with greeting and suggestions](/images/chatbot/widget-open.png)

The guest types in their own words, in **English or Bengali**. There are no
menus to navigate and no commands to learn. *"Do you have a villa free next
weekend?"* works. So does *"আগামী সপ্তাহে ভিলা খালি আছে?"*

## 2. The conversation, step by step

### Availability — "What's free?"

*Guest: "Do you have anything free Oct 29–31?"*

The Chatbot calls `check_availability` against the **live** booking data
and answers with what's actually free — room types and unit counts. While
it checks, the guest sees an honest status line ("Checking availability"),
not a fake typing delay.

**Tip for staff:** if a guest says "the chat said 4 available," believe
them — that was the live count at that moment. Availability changes as
drafts are held.

### Quote — "How much?"

*Guest: "How much for the Terracotta Villa?"*

`get_quote` computes the exact total from the room's live nightly rate ×
nights. The guest sees a **quote card**: room, dates, rate × nights, total
(e.g. ৳14,500 × 2 = ৳29,000).

The number the Chatbot quotes is the number the folio will carry — same
engine, same source. **If a guest quotes a chat price at the desk, honor
it.** If it was wrong, the room price changed mid-conversation — that's a
data issue, not a guest issue.

### Draft — "Hold it for me."

*Guest: "Book it. I'm Md Amir, amir@example.com, +8801XXXXXXXXX."*

`create_booking_draft` creates a **PENDING** hold with a booking code (e.g.
`RES-202610-00004`). **A draft is not a booking** — it's a hold awaiting
confirmation and payment, exactly like a phone reservation written on a
slip.

Rules the Chatbot follows:
- It always quotes **before** drafting (never holds without a price).
- One draft per conversation.
- The draft appears in the property's admin with the same code, dates, and
  totals.

### Verification — "Is my booking confirmed?"

*Guest: "My code is RES-202610-00004."*

The chat shows **dates + first name + status only**. For full details, the
guest can ask by email — details go to the **address already on the
booking**, never to an address supplied in chat. See
[Verification & Privacy](../verification-privacy) for the full design.

### Handoff — "I need a human."

Anything beyond one room — a 25-person group, a special request, a
complaint, a confused guest — becomes a `request_handoff`. The Chatbot
summarizes, saves the full transcript, and the conversation lands in the
[staff handoff queue](../staff-handoff).

## 3. What the Chatbot never does

- **Never takes payment.** Drafts hold; payment happens through the booking
  journey or at the desk. (Payment links are on the
  [roadmap](../roadmap).)
- **Never invents.** No availability, no price, no policy comes from its
  training — only from live tool calls. If the tools don't answer, it says
  so and offers the handoff.
- **Never leaks.** Staged verification means a stranger can't
  social-engineer another guest's details out of the chat.

## 4. What staff need to know

- **Drafts appear in Bookings** as PENDING — work them like phone
  reservations: confirm, take payment, or release.
- **The Chatbot doesn't replace the front desk** — it deflects the routine
  (availability, prices, "is my booking confirmed?") so the desk handles
  the human.
- **Bengali works fully.** Bengali questions get Bengali answers with
  Bengali digits. Don't ask guests to switch to English.

## 5. Troubleshooting

| Symptom | Check first |
|---|---|
| Guest says the chat quoted a wrong price | The room's price per night — did it change? The quote was live at the time. |
| Draft exists but guest never paid | Normal — drafts are holds. Follow up like any pending reservation. |
| Guest couldn't verify their booking | They need the booking code from their confirmation — resend it from the booking detail. |
| Chat answered in the wrong language | Short messages ("hi") may not carry enough signal — the guest just continues in their language. |

More: [Troubleshooting](../troubleshooting).

## Related

- [Capabilities](../capabilities) — each tool explained
- [Verification & Privacy](../verification-privacy)
- [Staff Handoff](../staff-handoff)

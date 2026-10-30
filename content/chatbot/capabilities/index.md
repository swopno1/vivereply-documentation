# Chatbot Capabilities — In Detail

Every capability below is working in the live MVP at
[app.vivereply.com](https://app.vivereply.com). Each one is a tool the AI
calls against your property's **live** booking data — nothing is cached,
guessed, or invented.

## How a capability works

When a guest asks something, the Chatbot doesn't answer from memory. It
runs a loop: **think → call a tool → read the live result → think again**
(up to 6 rounds). The tools are built fresh for each request from your
property's own room catalogue, so the AI can only ask about rooms you
actually have.

## The six capabilities

### 1. Live availability check

**What the guest experiences:** *"Is the Terracotta Villa free Nov 10–12?"*
→ the chat shows a brief "Checking availability" status, then answers with
the real number of free units.

**How it works:** the `check_availability` tool queries your booking backend
over HTTP at the moment of the question. The answer reflects current holds,
confirmed bookings, and housekeeping blocks — the same data your front desk
sees.

**Best practice:** availability is live, so it can change between the
guest's question and their confirmation. The quote card shows the count at
check time; the draft step re-validates before holding.

### 2. Exact price quotes

**What the guest experiences:** a quote card showing the room, dates, nightly
rate × nights, and the total — e.g. Terracotta Villa, Nov 10–12, ৳14,500 × 2
= **৳29,000**.

**How it works:** the `get_quote` tool multiplies your catalogue's nightly
rate by the night count. The quote card is built **only** from what the tool
returned — the card can never display a price the tool didn't say.

**Important:** rates are flat nightly prices in the current build. Seasonal
rates are on the [roadmap](/chatbot/roadmap).

### 3. Booking drafts (holds)

**What the guest experiences:** after confirming, the guest shares name,
email, and phone → the Chatbot holds a **PENDING** draft and returns a
booking code like `RES-202610-00003`.

**How it works:** the `create_booking_draft` tool sends the hold to your
booking backend. The draft appears in your property's own admin panel with
the same code, dates, and totals. No payment is taken — your staff confirms
the booking in the morning.

**Rules the AI follows:**
- A quote must come **before** any draft (quote-first guardrail).
- One draft per conversation (prevents duplicate holds).
- A returned booking code is treated as confirmed — if a later check shows
  "0 available" for those dates, that's expected (the draft holds the unit),
  not a bug.

### 4. Private booking verification

**What the guest experiences:** quoting a booking code shows stay dates,
first name, and status — **and nothing else**. Asking by email or phone gets
one generic reply whether or not a booking exists.

**How it works:** two tools with different privacy levels:
- `verify_booking` / `lookup_booking_by_code` — the server strips everything
  except dates + first name + status before the chat layer sees it, so the
  AI *cannot* leak more even if asked.
- `request_booking_details` — never shows details in chat. Details go only
  to the email address already stored on the booking.

**Why this matters:** a guest's booking details are PII. The design assumes
the chat is semi-public — the privacy guarantee is enforced server-side, not
by asking the AI to be careful.

### 5. Bengali and English conversations

**What the guest experiences:** the Chatbot detects the guest's language from
their message and replies in it — Bengali questions get Bengali answers with
Bengali digits (e.g. ৳১৭,০০০).

**How it works:** language is detected from the message text (the ৳ symbol
alone never flips it). Totals are rendered in the guest's language and digit
system.

**Best practice:** the Chatbot corrects wrong room names in the guest's
language rather than failing. If it can't match a room, it asks for
clarification instead of guessing.

### 6. Staff handoff

**What the guest experiences:** for anything beyond one room — a 25-person
group, a special request, a complaint — the Chatbot says it needs a human,
summarizes the conversation, and creates a handoff record.

**How it works:** the `request_handoff` tool saves the full transcript with
a reason and summary. Your staff works it in the
[staff handoff queue](/chatbot/staff-handoff): assign, add notes, resolve.

**Best practice:** review handoffs every morning. They're your highest-value
conversations — guests who wanted something the AI couldn't do alone.

## What the Chatbot will never do

- Invent a room, price, availability, or booking.
- Answer from its training data when live data is available.
- Show one property's data to another property's guests (tenant isolation).
- Take a payment itself or invent a payment URL (payment links are
  server-minted; see [roadmap](/chatbot/roadmap) for payments status).

If it doesn't know, it says so and offers a human. A wrong answer is worse
than silence — it creates overbookings and disputes.

## Related

- [Guest Chat](/chatbot/guest-chat) — what the conversation looks like
- [Verification & Privacy](/chatbot/verification-privacy) — the privacy design
- [Staff Handoff](/chatbot/staff-handoff) — working the queue
- [Bridge API](/chatbot/bridge-api) — connecting your own dashboard

# Troubleshooting

Common issues and what to do about them. If your issue isn't here, check the
[Bridge API](/chatbot/bridge-api) error table or contact support.

## Guest chat issues

### The widget doesn't appear on my website

1. Check the embed snippet is pasted correctly — one `<script>` tag, no
   modifications.
2. Check your domain is in the property's **approved domains** list
   (Settings → Widget). The widget refuses unapproved origins silently.
3. Check the browser console for errors. A `401` means the widget key is
   wrong; a domain error names the expected origin.

### The chatbot gives a wrong price

The quote comes from your catalogue's nightly rate × nights, checked live.
A wrong price means a wrong catalogue rate — fix it in Settings →
Catalogue. The Chatbot never invents prices; if the price was wrong, the
data was wrong.

### The chatbot says a room is unavailable but it looks free

Check for holds: PENDING drafts hold units. A draft created yesterday still
holds its room until confirmed or cancelled. Check your admin's draft list
before assuming a bug.

### The chatbot answered in the wrong language

Language is detected from the guest's message text. Very short messages
("hi", "ok") may not carry enough signal. The guest can just continue in
their language — detection re-runs every turn.

## Staff / bridge issues

### Bridge API returns 401

The key is missing, wrong, or **revoked**. Check Settings → Bridge keys:
if the key isn't listed, it was revoked — mint a new one and update your
server secret. Never retry a 401 in a loop; alert a human.

### Handoff list is empty but guests asked for humans

1. Check you're querying the right property's key (keys are per-property).
2. Check the `status` filter — a handoff you closed won't appear under
   `?status=OPEN`.
3. Check the Chatbot app is reachable ([status](https://app.vivereply.com)).

### A handoff's transcript won't load

The detail endpoint (`GET /api/bridge/handoffs/<id>`) returns the
transcript. If it 404s, the ID is wrong or belongs to another property's
key. If it 401s, see above.

## Account issues

### Can't log in

- Check caps lock and the exact email (owner emails are case-sensitive for
  login).
- After repeated failures you may see a human-verification check — complete
  it and try again.
- Still stuck? Use **Forgot password** on the login page.

### Didn't receive the verification email

- Check spam/junk.
- Verify the owner email has no typo (Settings → Profile, once logged in).
- The link expires — request a new one from the login page.

## Reporting a bug

Include: property name, what you did, what you expected, what happened, and
the time (with timezone). Screenshots of the chat help. Send to
[support@vivereply.com](mailto:support@vivereply.com).

## Related

- [Setup](/chatbot/setup) — connecting a property
- [Bridge API](/chatbot/bridge-api) — error reference
- [Best Practices](/chatbot/best-practices) — preventing issues

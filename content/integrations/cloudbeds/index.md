# Connect ViveReply Concierge with Cloudbeds

ViveReply Concierge is an AI front-desk chatbot for hotels and resorts. When you connect it to Cloudbeds, the chatbot works from your live Cloudbeds data: it answers guest questions, checks availability, quotes real rates, and creates reservations in Cloudbeds for you — on your own website, in English and Bengali, around the clock.

## What the integration does

- **Live availability and rates.** Before quoting any price, the chatbot checks your Cloudbeds availability and rates, and quotes in your property's currency. It never quotes from stale or cached prices.
- **Reservations in Cloudbeds.** When a guest books through the chat, the reservation is created directly in your Cloudbeds account, so your front desk sees it like any other booking.
- **Booking lookup.** A guest can ask about their booking in the chat. For privacy, the chat shows limited details only; full booking details are sent to the guest's email.
- **Staff handoff.** When a guest needs a human — or the chatbot cannot answer — the conversation is handed to your staff with the full transcript, and the chatbot steps aside until your team closes the handoff.
- **Your room catalogue, synced.** Your Cloudbeds room types and rooms are synced into the chatbot automatically when you connect, and you can re-sync at any time from the booking-system settings.

## How to sign up for ViveReply Concierge

1. Go to https://app.vivereply.com and create your account.
2. Add your property and complete the short setup checklist.
3. New accounts start with a 30-day free trial — no card required.

## How to connect ViveReply Concierge with Cloudbeds for the first time

You need admin access to your Cloudbeds account.

1. **In Cloudbeds:** open the App Directory (Marketplace), find **ViveReply**, and click **Connect**. Follow the authorization prompt to grant ViveReply access to your property. Depending on your account setup, your property's API key is then delivered to ViveReply automatically, or emailed to you.
2. **In ViveReply Concierge:** open your property's **Booking system** settings and choose **Cloudbeds**. If an API key was emailed to you, paste it here.
3. Click **Test connection**. You should see your Cloudbeds property name — this confirms the connection works.
4. Click **Connect**. Your room catalogue syncs automatically.
5. Open your guest chat and ask "What rooms do you have?" — the answer should list your real Cloudbeds rooms. The integration is live.

If you later switch your booking system to a different provider, the chatbot uses the new system after a fresh room sync; bookings are unavailable in chat until that sync completes.

## Limitations

- **One booking system per property.** A property can be connected to Cloudbeds or another supported system at a time — not two at once.
- **Payments stay in Cloudbeds.** The chatbot never takes card payments. Guests pay through your normal Cloudbeds payment arrangements.
- **Group accounts.** Cloudbeds group (multi-property) accounts are not supported yet. Connect each property individually.
- **Languages.** The guest chatbot speaks English and Bengali.
- **If Cloudbeds is unreachable,** the chatbot tells the guest that booking is temporarily unavailable and offers a staff handoff instead of guessing.

## How to disconnect

**From ViveReply Concierge:** open **Booking system** settings → **Cloudbeds** → **Disconnect**. The chatbot immediately stops checking Cloudbeds availability and creating reservations. It can still answer general questions about your property and hand conversations to your staff.

**From Cloudbeds:** you can also remove ViveReply from your Cloudbeds account at any time — see Cloudbeds' own guide: [Disconnect an app from myfrontdesk](https://myfrontdesk.cloudbeds.com/hc/en-us/articles/219774407-Disconnect-an-app-from-myfrontdesk). If you disconnect on the Cloudbeds side, your API key is revoked; ViveReply will show the connection as broken and stop using it. Reconnect at any time by repeating the steps above.

## How to get support

- **Email:** support@vivereply.com
- **In the app:** the **Support** section of your ViveReply Concierge dashboard
- **WhatsApp:** +880 1819-062270

Tell us your property name and what you were trying to do, and include a screenshot if you can — it helps us solve it faster.

## FAQs

**Does the chatbot take payments from guests?**
No. Reservations are created in Cloudbeds; payment follows your normal Cloudbeds setup.

**Which languages does the chatbot speak?**
English and Bengali.

**What happens if Cloudbeds is down?**
The chatbot says booking is temporarily unavailable and offers to hand the guest to your staff. It never invents availability or prices.

**Can I connect more than one property?**
Yes — connect each property separately from that property's booking-system settings.

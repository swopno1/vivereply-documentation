# Blog Settings — Staff Training Module

**Page:** `/admin/blog/settings` — how the blog behaves.
**Audience:** owners only (the page needs the owner-only settings
permission).
**Time to complete:** about 15 minutes.
**Prerequisite:** the [Blog](..) module.

## Learning objectives

After this module you can configure the blog's publishing rules, guest
story rules, and presentation — and explain each choice.

## 1. Publishing rules

- **Staff posts auto-publish** — when on, staff can publish directly;
  when off, every staff post goes through the [moderation queue](../pending/).
  Off is safer for a new team; on is faster for a trusted one.
- **Photos per staff post** — the image cap for staff-written posts.
- **Posts per page** — listing pagination (minimum 3).
- **Show author name** — bylines on posts.
- **RSS feed** — on/off for the site's feed.

## 2. Guest stories

- **Accept guest submissions** — the master switch for the website's
  story form (`/blog/submit`). Off means no new guest stories at all.
- **Review guest posts before publishing** — when off, clean guest
  stories go live immediately instead of landing as PENDING. (Stories the
  spam filter holds always wait for review, whatever this says.)
- **Confirmation email** — guests get *"we received your story"* on
  submit when this is on. (The *"it's published"* and rejection emails
  always send, regardless.) Keep it on; silence kills contributors.
- **Allowed categories** — which shelves guest stories may sit on.
- **Length limits** — minimum/maximum characters; the guidelines quote
  them to authors.
- **Photos** — min/max count, max size each, allowed types
  (JPEG/PNG/WebP). Every photo needs a description — the setting can't
  enforce quality, only the editor can.
- **Spam protection** — submissions allowed per IP per hour and per 24
  hours, whether links are allowed in stories, the maximum links before a
  story is rejected, and the ALL-CAPS word count that holds a story for
  review.
- **Email for new guest submissions** — the admin alert address. Leave
  empty to turn alerts off.

## 3. Changing settings safely

Settings apply **going forward** — already-published posts don't change.
Turning auto-publish off doesn't unpublish anything; tightening photo
limits doesn't shrink existing photos. When you change a rule, tell the
writers the same day — a writer discovering the new limit at submit time
is a preventable frustration.

## 4. Troubleshooting

| Symptom | Check first |
|---|---|
| Staff can't publish directly | Auto-publish is off — they submit for review instead. That's the setting working. |
| Guest uploads failing | Check allowed types and max size against what they're sending. |
| Too many/too few guest submissions | Length and photo requirements are the dials — too strict chokes supply, too loose floods the queue. |

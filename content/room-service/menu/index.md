# Room-Service Menu — Staff Training Module

**Page:** `/admin/room-service/menu` — managing what can be ordered.
**Audience:** managers (items, prices), kitchen (sold-out flags).
**Time to complete:** about 10 minutes.
**Prerequisite:** the Room Service module.

## Learning objectives

After this module you can add, edit, price, and retire menu items — and use
the sold-out flag correctly.

## 1. Permissions

- **Adding, editing, pricing, removing items:** manager (approve
  permission).
- **Marking sold out / back on the menu:** kitchen (edit permission) — this
  is the daily operational control and deliberately doesn't need a manager.

## 2. Managing items

Each item has: **name (English)**, name in Bengali (optional — fill it; the
staff and many guests read Bengali first), **category** (Breakfast, Mains,
Snacks, Desserts, Drinks, Other), description (optional), **price in taka**
(must be more than zero), and **sort order** (position in the list —
breakfast items first in the morning section, etc.).

**Removing an item is non-destructive:** *"Remove \{name} from the menu?
Past orders keep their copy."* History is never rewritten — old tickets
still show what was actually ordered.

## 3. The sold-out flag

The kitchen's real-time lever: when the last portion goes, **mark sold
out** immediately — the ordering page blocks it and front desk stops
promising it. When it's back, **mark available**. A stale sold-out flag
loses sales; a missing one creates angry guests. Treat it like the room
board: the flag is the truth.

**Rule of thumb:** prices and items change rarely (manager, deliberate);
sold-out changes constantly (kitchen, instant).

## 4. Troubleshooting

| Symptom | Check first |
|---|---|
| Can't add or price items | You need the approve permission — a manager task. |
| "Enter a price in taka, more than zero" | Prices are positive numbers; check for typos. |
| Removed item still on old tickets | Correct — past orders keep their copy by design. |
| Item shows sold out but it's available | Someone forgot to mark it back — flip the flag. |

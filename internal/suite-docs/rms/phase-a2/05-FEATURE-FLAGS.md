# Phase A2 §7: feature flags for RMS modules

Each client turns on the parts of the RMS they use. **Flags decide whether a module exists for this property; permissions decide who may use it** (01-ROLES-AND-PERMISSIONS.md principle 5). A module that is off is refused for every role, OWNER included.

## 1. Where the values come from

| Layer | Where | Who changes it |
|---|---|---|
| Client defaults | `brand.config.ts` → `rms.modules` and `rms.roles.enabledRoles` | the developer, per client deployment |
| Runtime overrides | `Settings.rmsModules` (JSONB, nullable), edited in **Settings → Modules** | OWNER (`SETTINGS.edit` + 2FA) |

**An override wins.** A key missing from the overrides inherits the config, and NULL means no overrides at all. Migration `20261001150000_settings_rms_modules` adds the column; it is additive and nullable, so on first deploy everything follows the config.

**The `brand.config.ts` block** is the brief's §7 values plus `rooms: true`. `rooms` is the flag that 01-ROLES-AND-PERMISSIONS.md §3 assigns to the ROOMS module, and your "Module disabled page on /admin/rooms" needs it to exist. `payroll` is in the brief; the Section 5 placeholder list had left it out.

```ts
rms: {
  modules: {
    frontDesk: true, rooms: true, housekeeping: true, roomService: true, inventory: true,
    purchase: false, expenses: true, finance: false, accounting: false, hr: false,
    payroll: false, reports: true, ownerDashboard: true, auditLog: true,
  },
  roles: { enabledRoles: ["OWNER", "MANAGER", "FRONT_DESK", "HOUSEKEEPING", "KITCHEN", "STOREKEEPER", "ACCOUNTANT", "HR", "AUDITOR"] },
}
```

## 2. The API (`src/lib/rms/module-flags.ts`)

| Function | Use |
|---|---|
| `resolveModuleFlags(overrides, brand)` | Pure: the overrides on top of the config, with the source (`settings` or `brand`) of each value. Unit-tested. |
| `getModuleFlags()` | The effective flags; one database read per request (React `cache`) |
| `isModuleEnabled(key)` | `true`/`false`; an unknown key is `false` |
| `getDisabledModules()` | For the sidebar and landing page |
| `requireModule(key)` | Server Actions: throws `ModuleDisabledError` ("This module is switched off for this property."), which the action returns as its error |
| `moduleDisabledResponse(key)` | Route handlers: a `404` response when the module is off, else `null` |
| `moduleGate(key)` (`components/admin/ModuleGate.tsx`) | Pages, first line: returns the **Module disabled** page when the module is off |

**Fail closed:**
- An unknown key is off.
- A malformed override (a non-boolean value, an unknown key, a non-object) is ignored and the config default applies; it is never read as "on".
- A module missing from the config is off.

**Why pages check the flag themselves, not a layout.** Next renders layouts and pages in parallel, and a client navigation can fetch a page segment without re-running its layout. A layout-only gate would not be fail-closed. With `moduleGate()` at the top of the page, the page's own queries never run. It also requires a signed-in user first, so the page tells an anonymous visitor nothing.

**A "Module disabled" page instead of a 404 for pages.** This follows your direction for `/admin/rooms`. The page names the module; an OWNER gets a link to Settings → Modules and everyone else is told to ask the owner. Route handlers do answer **404**, which is the brief's rule, as if the route didn't exist. Server Actions return the refusal as their error.

## 3. What each flag gates today

Only four modules have screens today. The rest are listed read-only in Settings → Modules with the phase that builds them. A switch that changed nothing would be a silent no-op, so `updateModuleFlagsAction` refuses those keys with `not_available`.

| Flag | Gates | Sidebar item |
|---|---|---|
| `frontDesk` | `/admin/front-desk` (added 2026-10-07), `/admin/guests`, `updateGuestNotes`, and `updateBookingStatus` for check-in/check-out moves (not confirm or cancel, which are BOOKING) | Front Desk, Guests |
| `rooms` | `/admin/rooms`, `/admin/rooms/[id]`, and the room actions (`createOrUpdateRoom`, `toggleRoomStatus`, `addRoomUnit`, `updateRoomUnit`, `setRoomUnitStatus`, `removeRoomUnit`) | Rooms |
| `reports` | `GET /api/admin/reports/payments` (404 when off); the dashboard's CSV link goes with the dashboard | — |
| `ownerDashboard` | `/admin` KPIs. When off, `/admin` sends everyone to their next permitted, enabled page (`landingPathFor(role, disabled)`), for an OWNER that's Bookings. | Dashboard |
| `housekeeping`, `roomService`, `inventory`, `purchase`, `expenses`, `finance`, `accounting`, `hr`, `payroll`, `auditLog` | nothing yet. Each phase that builds a module calls `moduleGate`/`requireModule` and moves the key into `LIVE_MODULES`. | — |

**Never gated by a flag:**
- **Core:** Bookings, Settings, Users and the Blog have no flag.
- **Guests:** the public site, booking, `/api/rooms/[id]/availability` and every payment flow. `grep` shows `module-flags` is imported only under `src/app/admin`, `src/app/actions` and one admin API route.
- **The existing gateway payment admin**, including the Bangla QR queue. Guests' payments must never depend on an RMS flag (01 §3 note 1). The `finance` flag will gate only the new Phase F screens.
- **Rooms off still lets guests book.** Availability and unit assignment run in `src/lib/rooms/availability.ts`, which has no flag; only the admin screens for managing rooms are hidden.

## 4. The sidebar and landing page

`NAV_RULES` in `src/lib/permissions.ts` gives each item an optional `moduleFlag`. `visibleNav(role, disabledModules)` hides an item when its module is off, before the permission check, so OWNER loses it too. `src/app/admin/layout.tsx` passes `getDisabledModules()` to `AdminShell`. `landingPathFor()` takes the same list, and so do `/admin`, `/admin/welcome` and the 2FA setup "continue" link.

## 5. Enabled roles

`rms.roles.enabledRoles` limits which roles can be **assigned** (`src/lib/rms/roles.ts`):
- The invite and role-change pickers offer only these.
- `inviteUser()` and `changeUserRole()` refuse any other role with `invalid_input`.
- **OWNER is always included,** so a config mistake can't make the owner role unassignable.
- STAFF is never offered (deprecated, §3).

Existing users keep the role they have; switching a role off doesn't lock anyone out. There is no runtime override for roles; the brief puts them only in the config.

## 6. Settings → Modules

- **Who sees what:** OWNER sees a switch (44px tap target) for each live module. AUDITOR (`SETTINGS.view`) sees the same list without switches, plus a view-only notice.
- **Badges:** each row shows where its value comes from: "Default (brand.config.ts)", or "Set in Settings" together with the default value.
- **Save** sends only the changed rows. **Reset all to defaults** clears every override, which stores NULL.
- **Each save** writes the row and a `MODULES_UPDATED` audit entry in one transaction. The entry has module `SETTINGS`, a `diff {before, after}` of `{enabled, source}` per changed module, and the actor, IP and user agent. Saving with nothing changed writes nothing.
- **Planned modules** are listed underneath with their phase and their config value.

## 7. Evidence

### Automated
| Suite | Result |
|---|---|
| `src/lib/rms/module-flags.test.ts` | Config defaults equal the brief's block plus `rooms`. Every key is either live or planned. Overrides win in both directions. Junk overrides are ignored (fail closed). A missing config key is off. Sidebar: a disabled module is hidden for OWNER too, core items can't be hidden, and every nav flag is a real key. Landing with the dashboard off. Enabled roles, including that OWNER can't be removed. |
| `src/app/actions/modules.db.test.ts` (`*_test` DB) | With no overrides, the disabled list is `purchase, finance, accounting, hr, payroll`. Switching Rooms off persists, wins over the config and is audited with the diff and IP; re-saving writes nothing. `null` resets one module and an empty map stores NULL. Planned modules, unknown keys and non-booleans are refused with nothing written. With Rooms and Front desk off, `addRoomUnit` and `updateGuestNotes` are refused **for OWNER**. With Reports off, the CSV route returns 404, and 200 again after reset. |
| `permission-enforcement.test.ts` | `updateModuleFlagsAction` for each of the 10 roles and an unknown role: only OWNER passes |

### Live (production build, scratch DB `resort_a2s6_test`, 360px)
The OWNER was `test-owner@demo.resort`, with 2FA really enrolled (TOTP computed in the page).

- **Settings → Modules:** 4 switches, all on. The sidebar showed `/admin, /admin/bookings, …/banglaqr-verification, /admin/blog, /admin/rooms, /admin/guests, /admin/settings`.
- **Rooms off → Save:** "Saved. The menu updates on the next page load." After reload:
  - the Rooms switch was off with badges "Set in Settings | Default: On";
  - the sidebar was `/admin, /admin/bookings, …/banglaqr-verification, /admin/blog, /admin/guests, /admin/settings`;
  - `/admin/rooms` and `/admin/rooms/new` both showed **"Module disabled — The Rooms module is switched off for this property. You can switch it back on in Settings > Modules."**
- **Reports and Owner dashboard off:** `/admin` landed on `/admin/bookings`, and `GET /api/admin/reports/payments?format=csv` returned **404**.
- **MANAGER** (separate session): landed on `/admin/bookings`. The sidebar was `/admin/bookings, …/banglaqr-verification, /admin/blog, /admin/guests`, and `/admin/rooms` showed "Module disabled … Ask the owner if you need it."
- **Guests unaffected** while Rooms was off: `/` returned 200, and `/api/rooms/<id>/availability` returned 200 with `"available":6`.
- **Audit rows:**
  ```
  MODULES_UPDATED | SETTINGS | test-owner@demo.resort | {"after": {"rooms": {"source": "settings", "enabled": false}}, "before": {"rooms": {"source": "brand", "enabled": true}}}
  MODULES_UPDATED | SETTINGS | test-owner@demo.resort | {"after": {"reports": {…false}, "ownerDashboard": {…false}}, "before": {"reports": {…true}, "ownerDashboard": {…true}}}
  ```
  Stored value: `{"rooms": false, "reports": false, "ownerDashboard": false}`.
- **Reset all to defaults:** the stored value went back to `NULL` (a third audit row), and `/admin/rooms` was back to "Room Inventory".
- **Bengali:** the Modules tab and the disabled page ("মডিউল বন্ধ | এই প্রপার্টির জন্য রুম মডিউল বন্ধ করা আছে।") rendered with `scrollWidth` 345 at 360px.

## 8. Not done here

- **Brief §9.2's "/admin/inventory returns 404" can't be checked yet:** there is no inventory page. Inventory is listed as planned (Phase D). When it ships, its pages call `moduleGate("inventory")` and its actions call `requireModule("inventory")`.
- **Cron jobs:** none belong to a flagged module yet. The convention is that a module's cron calls `isModuleEnabled()` and exits quietly when the module is off.

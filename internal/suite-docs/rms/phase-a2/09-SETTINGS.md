# Phase A2 §5: settings rebuild with tabs

`/admin/settings` is now one page with six tabs: **General | Payments | PMS | Users | Modules | Tax**. It replaces the old single view, whose Save button did nothing. This file is numbered 09 because the brief assigns 04–07 to other sections.

## 1. Tabs and who can open them

Each tab is a real link (`?tab=…`) and its own server render. The page needs `SETTINGS.view` plus OWNER 2FA. It then checks the tab's own permission from `src/app/admin/settings/tabs/registry.ts`, the same list the tab bar uses to decide what to show. An unknown `?tab=` value shows General.

| Tab | Opens with | OWNER | AUDITOR | Everyone else |
|---|---|---|---|---|
| General | `SETTINGS.view` (save: `SETTINGS.edit`) | edit | read-only, no Save button | 403 |
| Payments | `SETTINGS.edit` | ✅ | 403 (tab hidden) | 403 |
| PMS | `SETTINGS.edit` | ✅ | 403 (tab hidden) | 403 |
| Users | `USERS.view` (actions: `USERS.*`, §4) | ✅ | read-only | 403 |
| Modules | `SETTINGS.view` (save: `SETTINGS.edit`, §7) | ✅ | ✅ | 403 |
| Tax | `SETTINGS.view` (placeholder) | ✅ | ✅ | 403 |

**MANAGER** has no `SETTINGS` access in the matrix: 01-ROLES-AND-PERMISSIONS.md §4.1 settled the brief's "MANAGER to view" against §9.2. So MANAGER gets 403 on every tab, as before.

**Every settings write goes through `requirePermission("SETTINGS", "edit")`**, except Users, which stays on `USERS.*`:
- General: `updateGeneralSettingsAction`.
- Payments: the existing `update*SettingsAction`s in the payment action files. They are deferred payment code, still on `requireRole("OWNER")`, which the §5.3 mapping equates to `SETTINGS.edit`, and they were not touched.
- PMS: `POST /api/admin/pms/test-connection`, already on `SETTINGS.edit`.

## 2. General tab: what persists, and why most fields are read-only

**The `Settings` singleton.** This is the brief's model, with one deliberate change: the override columns are **nullable**, and NULL means "inherit from `brand.config.ts`".
- Migration `20261001140000_settings_singleton` creates the table and inserts the row with every override NULL and `timezone = 'Asia/Dhaka'`. It changes nothing on first deploy.
- `prisma/seed.ts` upserts the row without overwriting it (§5.8).

The brief's non-null defaults (`checkInTime "14:00"`, …) would have stored a copy at install time, and that copy would win forever, even after a later `brand.config.ts` change. `brand.config.ts` is not modified.

**Reading.** `getSettings()` in `src/lib/settings.ts` merges the row over `brand.config.ts`, so a non-null column wins at read time. Each value carries its source, which the tab shows as a "From brand.config.ts" or "Set in Settings" badge. The merge itself is the pure function `mergeSettings()` and is unit-tested.

**Editable vs read-only (the "no silent no-ops" rule).** A field is editable only if every place that reads it goes through `getSettings()`.

> **Updated by FU-6 (10-RUNTIME-SETTINGS.md):** the contact email, phone, WhatsApp number, check-in/out times and early/late fees are now editable, and every reader uses the runtime values. The name, address and cancellation policy stay config-only. The table below records the §5 state.

| Field | Readers today | On the tab |
|---|---|---|
| `timezone` | admin date display (Users tab, "last saved"), and the §6 dashboard's business day | **Editable** |
| `propertyName`, `contactEmail`, `contactPhone`, `address` | 100+ files: the public site (prerendered, ○ in the build), JSON-LD, metadata, emails, client components via `BrandProvider`, the NAP check | Read-only, with value and source |
| `checkInTime`, `checkOutTime`, `earlyCheckInFeePoisha`, `lateCheckOutFeePoisha` | the public FAQ and FAQPage schema (`content/faq.ts`), lodging JSON-LD, the press kit, client-side answers (`content/answers.ts`) | Read-only |
| `cancellationPolicy` | no brand default; the public text is the `/refund-policy` page | Read-only ("As published on the Refund Policy page") |

Saving a database value for a read-only field would not reach the prerendered public site, so the tab doesn't offer it. `updateGeneralSettingsAction` also **refuses** any field outside `EDITABLE_GENERAL_FIELDS` with `{ error: "read_only", field }` rather than dropping it (tested). Making those fields editable is **FU-6**, which needs your decision because it changes how the public site renders.

**Timezone.**
- **The picker** lists `Intl.supportedValuesOf("timeZone")` (418 zones in this runtime), sorted, always including `Asia/Dhaka`. It shows a live "Time there now" preview.
- **Validation** is `Intl.DateTimeFormat` only, no library. The value must be a named IANA zone (not `UTC`, an `Etc/` zone or a fixed offset), and it is stored in the runtime's canonical spelling: `asia/dhaka` becomes `Asia/Dhaka`.
  - Node's ICU uses a few legacy spellings, such as `Asia/Calcutta` and `Asia/Katmandu`. The stored value always matches a picker option.
- **Not affected:** payment gateways keep their own protocol time zone, for example Nagad's mandatory Dhaka timestamps in `payments/nagad/time.ts`.

**Saving.**
- **What a save writes:** in one transaction, the row (with `updatedBy` = the user) and a `SETTINGS_UPDATED` audit row. The audit row has module `SETTINGS` and `diff {before:{timezone}, after:{timezone}}`, plus the actor, IP and user agent.
- **No-op saves:** saving the same value writes nothing. The Save button stays disabled until something changes.
- **Missing row:** a save re-creates the singleton if it is missing.

## 3. Payments and PMS folded into tabs

- **Payments:** `src/app/admin/settings/payments/page.tsx` was moved (`git mv`) to `tabs/PaymentsTab.tsx`. Only the wrapper changed: imports, the heading (now from `t.adminSettings`), and the guard, `requireRole("OWNER")` → `requirePermission("SETTINGS", "edit")` under the standing rule.
  - **Untouched:** the forms and the client panel (`PaymentSettingsClient`, the four `*SettingsForm` components, still in `settings/payments/`), the reconciliation health checks, and the payment actions.
  - The file is off the `requireRole` allowlist, so **10 deferred files** remain. All four gateway suites pass (§5).
  - The payment forms' own text is English only. It is part of the payment components, which were not touched.
- **PMS:** the placeholder page `settings/integrations/page.tsx` is replaced by the PMS tab, with the same content, now in English and Bengali. It is still a placeholder; PMS sync is a later phase.
- **Old URLs** redirect in `next.config.ts` with a temporary 307, so browsers don't cache the move forever:
  - `/admin/settings/payments` → `/admin/settings?tab=payments`
  - `/admin/settings/integrations` → `/admin/settings?tab=pms`
- The payment actions still call `revalidatePath("/admin/settings/payments")`. It is harmless: the page is dynamic, and that path now only redirects.

## 4. Modules and Tax (placeholders)

- **Modules:** wired in §7 (05-FEATURE-FLAGS.md): switches for the four modules that exist today, the rest listed with their phase. The tab table above still applies: OWNER edits, AUDITOR views.
- **Tax:** documents the Phase F plan: VAT and SD rates with effective dates, tax-inclusive or tax-exclusive prices, the BIN on invoices, tax lines and a VAT collected/paid report. It notes that the client's VAT and SD obligations must be confirmed by their accountant first.

Both render in English and Bengali without error (§5).

## 5. Evidence

### Automated
| Suite | Result |
|---|---|
| `src/lib/settings.test.ts` | No row → every field from `brand.config.ts`. A non-null column wins; NULL inherits; `0` is a value. A later `brand.config.ts` change shows through. Only `timezone` is editable. Timezone validation (canonical case, aliases, and rejection of junk, offsets, `Etc/`, `UTC` and non-strings); the zone list; the two redirects in `next.config.ts`. |
| `src/app/actions/settings.db.test.ts` (`*_test` DB) | The migration's singleton inherits everything. Save persists, `getPropertyTimezone()` reads it back, and the audit row has the diff and IP. Re-saving the same value writes nothing. Read-only fields and invalid zones are refused, with the row unchanged. A missing row is re-created. |
| `permission-enforcement.test.ts` | `updateGeneralSettingsAction` × 10 roles + an unknown role: only OWNER passes, refused before any DB access. |
| Gateway suites (payment file moved) | `test:nagad:db` 255/255, `test:sslcommerz:db` 334/334, `test:bkash:db` 157/157, `test:banglaqr:db` 96/96 |
| Full suite on `resort_test` | 80 files, 1,133 passed, 1 skipped (the migrations check, which needs a shadow DB) |

### Live (production build, scratch DB `resort_a2s5_test`, since dropped)
The scratch database had all migrations deployed and the seed run. The owner was `test-owner@demo.resort` with 2FA really enrolled. Everything ran at a 360px viewport.

- **Singleton after migrate and seed:** `singleton||||||||||Asia/Dhaka|…|system:migration`. The seed did not overwrite it.
- **Redirects:**
  ```
  /admin/settings/payments -> 307 http://localhost:3100/admin/settings?tab=payments
  /admin/settings/integrations -> 307 http://localhost:3100/admin/settings?tab=pms
  ```
- **All 6 tabs × EN and BN:** every one rendered with the right heading and tab labels and no error. The page `scrollWidth` was 345 or 360 at a 360 viewport, so nothing scrolls sideways; the tab bar scrolls inside itself.
- **General save (OWNER):** before any change the Save button was disabled; there are no text inputs, only the timezone select (418 options). Choosing `Europe/London` showed "Time there now: 7 Oct 2026, 02:21". After Save and a reload, the value was `Europe/London` with the "Set in Settings" badge and "Last saved Oct 7, 2026, 2:21 AM", shown in the new zone. Audit row: `SETTINGS_UPDATED|SETTINGS|test-owner@demo.resort|{"after": {"timezone": "Europe/London"}, "before": {"timezone": "Asia/Dhaka"}}`. The row's `propertyName` stayed NULL (still inheriting).
- **AUDITOR:** tabs shown were `General,Users,Modules,Tax`. General is view-only (the select is disabled, there is no Save, and the notice is shown). `?tab=payments` and `?tab=pms` return 403.
- **MANAGER:** all six tabs return `NEXT_HTTP_ERROR_FALLBACK;403`.

### Found and fixed during the live run
**The guest chat widget covered the General tab's Save button at 360px.** It is the same fixed button that covered user actions in §4. `FloatingWidgets` already hid itself under `/admin`, but `ChatWidget` didn't. It now hides there too; verified with 0 instances on `/admin/settings` and 1 on the public homepage. This makes the §4 padding workaround unnecessary, but it is harmless and left in place.

## 6. Follow-ups
- **FU-6:** done. See 10-RUNTIME-SETTINGS.md.
- **FU-5:** inconsistent email behaviour without a Resend key (07-VERIFICATION.md). Logged at your direction; not fixed.
- The payment forms' own text is still English only (payment internals, not touched).

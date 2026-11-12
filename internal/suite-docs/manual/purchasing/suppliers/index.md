# Suppliers — Staff Training Module

**Page:** `/admin/purchasing/suppliers` — who the property buys from.
**Audience:** managers, storekeepers.
**Time to complete:** about 10 minutes.
**Prerequisite:** the [Purchasing](..) module.

## Learning objectives

After this module you can maintain the supplier list and read what it
shows.

## 1. What the page is

Every supplier: name, contact details, and **open order count** — how many
purchase orders are still in play with them. Adding needs the create
permission; changing and archiving need edit.

## 2. Supplier discipline

- **One record per supplier.** Duplicates split order history and payable
  balances — search before creating.
- **Archive, don't delete**, when a supplier relationship ends. History
  (orders, bills, payments) keeps pointing at the record.
- **You can't archive a supplier with open orders.** The system blocks it —
  close or cancel the orders first. This is the same open-order protection
  that guards stock items.
- Keep contact details current — the expected-date chase runs on them.

## 3. How suppliers connect

- **Purchasing** — orders are placed with suppliers; receiving keys off
  the supplier's deliveries.
- **Payables** — supplier bills and the ranked "who is owed" list read
  the same supplier records. The supplier you receive from and the
  supplier you pay must be the same record, or balances split.

## 4. Troubleshooting

| Symptom | Check first |
|---|---|
| Can't archive a supplier | Open purchase orders exist — close or cancel them first. |
| Payables show a different balance | The bill was recorded against a duplicate supplier record — merge discipline. |
| Supplier missing from PO form | It's archived — archived suppliers can't take new orders. |

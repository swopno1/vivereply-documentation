# PMS Settings — Staff Training Module

**Page:** `/admin/settings?tab=pms` — PMS connections.
**Audience:** owners.
**Time to complete:** about 10 minutes.
**Prerequisite:** the [Settings](..) module.

## Learning objectives

After this module you know what the PMS tab is for and when to touch it.

## 1. What it is

Connections to external Property Management Systems — where this
installation syncs with (or is driven by) an outside PMS. For a property
running this system as its PMS, the tab is informational: there is nothing
to connect.

## 2. When to touch it

Only when the property's setup actually involves an external PMS — a
migration, a chain integration, a two-system transition period. Like all
settings, changes here are slow-moving truths: know what reads the
connection before changing it, and coordinate with whoever runs the other
system.

## 3. Troubleshooting

| Symptom | Check first |
|---|---|
| Tab missing | Owner-level edit permission required. |
| Sync not running | The connection details on this tab, then the other system's status — and `/admin/system` job heartbeats. |

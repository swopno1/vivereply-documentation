# Section 0: Main Verification — 2026-10-09

Verdict up front: **the correction is right.** `main` is the canonical, fully-merged state.
Every phase branch listed in the task (A1 through the go-live stack, plus all four payment
hardening branches and this session's own `hardening/production-finalization`) is confirmed an
ancestor of `main` via `git merge-base --is-ancestor <branch> main`. The stale language is
confined to doc prose (§0.3), not the code.

## 0.1 Merge chain

`main` has 317 commits (2026-09-18 → 2026-10-09). The RMS rebuild (Phase A1 onward) is almost
entirely **linear, fast-forwarded commits** — no `merge(phase-...)` commit objects for most
phases, meaning each phase branch was fast-forwarded onto `main` directly rather than merged
with a merge commit. The only merge commits in the full history are from GitHub PRs predating
the RMS rebuild (`#79`, `#80`, `#81` — Bolt/Jules automated PRs, memoization and a rate-limiter
IP-spoofing fix).

Tail of `git log --oneline main` (most recent first), confirming the full phase sequence in
order, with this session's own commits (`cc6e35f`..`40cdb6f`) sitting between B2 and C:

```
8bf77b8 docs(rms): go-live report, per-client go-live checklist, readiness addendum, RMS index
0607120 feat(rms): go-live system health, job heartbeats, sign-in rate limits
b98ca47 feat(rms): Phase A3 audit log viewer, append-only audit log, sign-ins audited
7d617a2 docs(rms): Phase G §3 verification report and RMS index
6aa8e53 feat(rms): Phase G §2 HR screens
affccdb feat(rms): Phase G §1 staff records, attendance and payroll
5cca3f9 docs(rms): Phase F §6 verification, live-check fixes, test isolation
830d58a feat(rms): Phase F §5 trial balance, profit and loss, balance sheet, ageing
69a3181 feat(rms): Phase F §4 finance screens
e60c0a1 feat(rms): Phase F §3 supplier bills and payments, petty cash, transfers
81c84c0 feat(rms): Phase F §2 automatic postings to the books
bf459dc feat(rms): Phase F §1 chart of accounts, journal entries, months
3357500 docs(rms): Phase E §5 verification report and RMS index
6ba4805 feat(rms): Phase E §4 expense screens and CSV export
f0ba17f feat(rms): Phase E §3 purchasing screens and CSV export
5e03a4d feat(rms): Phase E §2 expenses
8cca4d5 feat(rms): Phase E §1 suppliers and purchase orders
288b05b docs(rms): Phase D §3 verification report
01f0581 fix(rms): file cash voids after a shift's count without comparing clocks
0c1d570 feat(rms): Phase D §2 inventory screens and CSV export
c9a7c46 feat(rms): Phase D §1 inventory items, stock ledger and stock counts
1d39b43 docs(rms): Phase C §3 verification report
1c8ab86 feat(rms): Phase C §2 room-service screens
a0a3b36 feat(rms): Phase C §1 room-service menu and orders
40cdb6f docs: production readiness report + RMS documentation index
243e315 perf(fonts): remove duplicate manual preload for playfair-display
0d9b190 feat(seo): add HowTo schema on /how-to-reach and a per-client llms.txt
a14f418 feat(ops): add pnpm check:env, a production-readiness checklist script
6c01973 fix(auth): fail closed on missing BETTER_AUTH_SECRET in production
cc6e35f fix(booking): mask NID/passport and drop internal logs on confirmation page
2a46543 docs(rms): Phase B2 §5 verification report
...
```

Full `--graph` output confirms: no branch/merge topology anywhere in the RMS-rebuild section —
it is one straight line. The only graph structure is the three old GitHub-PR merges below it.

## 0.2 Phase presence checklist

Checked directly against the current working tree (`git status` clean, on `main`):

| Phase | Key files/directories | Present on main? | Evidence |
|---|---|---|---|
| A1 | `prisma/migrations/*_init_postgres`, `src/lib/money.ts` | ✓ | `20260929033828_init_postgres/`; `money.ts` exists |
| A2 | `src/lib/permissions.ts`, `src/lib/rms/module-flags.ts`, `RoomUnit` in schema | ✓ | all three present; `model RoomUnit` at `prisma/schema.prisma:157` |
| B | `src/lib/front-desk/`, `src/lib/folio/`, `src/lib/night-audit/`, `src/lib/daily-sheet/` | ✓ | all four directories present |
| B2 | `src/lib/housekeeping/`, `src/lib/cash/` | ✓ | both present |
| C | `src/lib/room-service/` | ✓ | present |
| D | `src/lib/inventory/` | ✓ | present |
| E | `src/lib/purchasing/`, `src/lib/expenses/` | ✓ | both present |
| F | `src/lib/ledger/`, `src/app/admin/finance/` | ✓ | both present |
| G | `src/lib/hr/`, `src/app/admin/hr/` | ✓ | both present |
| A3 | Audit log | ✓ | `src/lib/audit.ts`, `src/lib/audit/viewer.ts`, `src/app/admin/audit/` (the task's suggested path `src/lib/audit-log` doesn't exist — it's `src/lib/audit.ts` + `src/lib/audit/`, confirmed by content, not just name) |

No ❌. Every phase's code is on `main` right now, not just in history.

## 0.3 Doc vs code reconciliation

**Stale "not merged" language found in 5 docs** — all refer to branches now confirmed merged:

| Doc | Line | Current text | Correction needed |
|---|---|---|---|
| `docs/rms/INDEX.md` | 20 | `G \| ... \| Done on \`phase-g-hr\`, not merged \|` | → `Done, merged` |
| `docs/rms/INDEX.md` | 21 | `A3 \| ... \| Done on \`phase-a3-audit\` (stacked on G), not merged \|` | → `Done, merged` |
| `docs/rms/INDEX.md` | 22 | `Go-live \| ... \| Done on \`phase-h-golive\` (stacked on A3), not merged \|` | → `Done, merged` |
| `docs/PAYMENTS-BANGLAQR-VERIFICATION.md` | 6 | `**Branch** \| \`hardening/banglaqr\` (not merged to \`main\`, awaiting owner review) \|` | → note merge, keep branch name for history |
| `docs/PAYMENTS-BKASH-VERIFICATION.md` | 6 | `**Branch** \| \`hardening/bkash\` (not merged; awaiting owner review) \|` | → note merge |
| `docs/PAYMENTS-NAGAD-VERIFICATION.md` | 6 | `**Branch** \| \`hardening/nagad\` (not merged; awaiting owner review) \|` | → note merge |
| `docs/PAYMENTS-SSLCOMMERZ-VERIFICATION.md` | 6 | `**Branch** \| \`hardening/sslcommerz\` ... not merged, not pushed \|` | → note merge |

No doc says "main is unchanged" verbatim. Also checked: `docs/rms/INDEX.md`'s own §9 ("Not yet
built") list is accurate against `module-flags.ts`'s current `PLANNED_PHASE` — HR/payroll and
audit log have shipped (Phase G/A3) and are correctly no longer listed there; the remaining
entries (Room Service listed as done in one place but the index's phase table already says
"Done, merged" for C — consistent) were spot-checked and are current.

**Not fixed yet, per instructions** — corrections are deferred to Section 9.

## 0.4 Leftover branches

67 local/remote branches total. Cross-checked every one against `main` with
`git log main..<branch> --oneline`. **61 are fully represented on `main`** (zero unmerged
commits). Six are not:

| Branch | Unmerged commits | Finding |
|---|---|---|
| `client/ecoza-hill-retreat` | 50 | **Expected, not a gap.** A per-client deployment fork (homepage redesign, client-specific build config) diverging from `main` at `f5e45bb`. This branch is intentionally never merged back — it *is* that client's production branch. |
| `client/the-wave-resorts` | 48 | Same pattern, diverging at `cf7bbea`. |
| `landing_page` | 1 | `feat: transform landing page into clean professional marketing site` — predates the current landing page. Likely superseded, not diff-verified line-by-line. |
| `phase_10` | 2 | `feat: implement Phase 10 admin authentication & core dashboard` — old numbering scheme (pre-RMS-rebuild `phase_1`..`phase_10`), superseded by the A1–A2 rebuild's own auth/dashboard work. |
| `phase_7` | 2 | `feat: verify phase 7 client-ready hardening completion` — same old scheme, superseded. |
| `phase_8_wip` | 2 | `feat: execute Phase 8 Local SEO & Monetization Layer` (chat widget, area guide map, Google reviews) — same old scheme. **Worth a closer look before archiving**: the current `src/components/chat/ChatWidget.tsx` and `src/components/travel/InteractiveReachMap.tsx` exist on `main` already, suggesting this was superseded rather than lost, but this was not diffed line-by-line to prove zero unique code was dropped. |

**Recommendation, not yet executed:** the two `client/*` branches are not a merge-chain gap —
they're correctly separate. The four `phase_7`/`phase_8_wip`/`phase_10`/`landing_page` branches
are pre-rebuild artifacts; Section 11 (archive branches → tags) is the right place to convert
them, after a confirming diff rather than assuming.

## 0.5 Tag

Not yet run — holding until this report is reviewed, per the task's "stop and report" gate.
Command to run on confirmation:

```bash
git tag pre-release-audit
git push origin pre-release-audit
```

---

## Stop and report

Per the task's instruction, stopping here. Summary for owner review:

- **Main is complete.** Every phase A1 through go-live, and all four payment hardening passes,
  are confirmed present and merged — not just in git history, in the actual current file tree.
- **5 docs have stale "not merged" language** that needs a one-line fix each (listed in §0.3,
  deferred to Section 9 per the task's instructions).
- **No branch has unmerged RMS/payment work that was silently dropped.** The only branches with
  commits not on `main` are two intentional client forks and four old pre-rebuild branches whose
  functionality appears superseded (not yet diff-verified).
- **Not yet tagged** (`pre-release-audit`) — waiting for this report to be read first.

Everything in this section ran locally against the real repository; no infrastructure was
needed and none was assumed.

**One thing to flag before Section 3**: that section requires provisioning a real cloud VPS, a
real public domain, and a real Let's Encrypt SSL certificate. I don't have a cloud provider
account, DNS control, or a domain to put this on — those need to come from the owner (or
explicit instructions for which provider/domain to use and credentials to reach it). Sections 1
(build/lint/test), 2 (env/secrets audit) and most of 4 (cron route inventory, static checks) are
fully runnable locally and I can proceed with those now while that's sorted out. Sections 3, and
the live parts of 6/7 that require a running deployed instance over HTTPS, are blocked on that
infrastructure access.

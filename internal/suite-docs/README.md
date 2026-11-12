# Suite docs archive (moved from travel-scaffold)

On 2026-11-13 the Suite documentation and runbooks were consolidated
here from `swopno1/travel-scaffold`. Source of truth for this copy:
`client/demo1` at `4bc6bbf8d4263423f45090ececccad26a11780c5`.

- `internal/suite-docs/` holds demo1's entire `docs/` tree, byte-for-byte,
  paths preserved (`docs/X` → `internal/suite-docs/X`).
- demo13 contributed nothing unique: its `docs/` tree was file-identical
  to demo1's except `GO-LIVE-CHECKLIST.md`, `CLIENT-ONBOARDING.md` and
  `DEPLOYMENT.md`, whose demo1 versions win (they carry the merged
  production-gate amendments; demo13's copies are stale). No
  `from-demo13/` directory exists because zero files qualified for it.
- Neither branch had a root-level `documentation/` directory.

`vivereply-documentation` is now the single home for all ViveReply Suite
documentation and runbooks. The travel-scaffold branches no longer
carry docs — their removal happens in a separate, later step; until
then, treat this tree (not the travel-scaffold copies) as canonical.

The `internal/` tree is an internal archive/runbook store. It sits
outside the Nextra `content/` directory on purpose: nothing under it is
published to the docs site. Several files here are internal records
(payment security reviews, verification dossiers) and must never be
published — do not move them under `content/` or link them from
published pages.

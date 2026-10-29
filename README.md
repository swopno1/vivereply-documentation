# vivereply-documentation

The documentation site for everything Vivereply — published at
**docs.vivereply.com**. Built with [Nextra 4](https://nextra.site) (Next.js +
React).

## What's inside

| Section | Content |
|---|---|
| `/` | Docs home: the two faces — Suite + Chatbot |
| `/chatbot/*` | ViveReply Chatbot — the AI front-office assistant (current build: ViveReply Concierge), plus roadmap |
| Everything else | Vivereply Suite training manual (admin, finance, HR, website, …) |

Content lives in `content/` as Markdown with Nextra `_meta.ts` files for
navigation. The data-flow reference (`/data-flow`) is the living technical
map — update it whenever a module changes behavior.

## Develop

```bash
pnpm install
pnpm dev      # http://localhost:3000
```

## Build

```bash
pnpm build
pnpm start
```

## Deploy

Connect the repo to Vercel (framework preset: Next.js). Production domain:
`docs.vivereply.com`.

## Known patch

`patches/nextra-theme-docs@4.6.1.patch` (via `pnpm.patchedDependencies`)
works around an upstream bug: the theme's `Layout` strips `children` out
of its props and then Zod-validates the rest against a schema that
requires `children` — every page 500s on an unpatched install. The patch
validates the full props object instead. Re-check on every
`nextra-theme-docs` upgrade; drop the patch if upstream fixes it.

## Conventions

- One folder per module under `content/`; each folder has `index.md` and
  `_meta.ts`.
- Write from the actual product behavior — never invent features.
- Keep the data-flow reference in sync with every behavior change.

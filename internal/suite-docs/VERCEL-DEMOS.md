# Vercel Demo Hosting (Manual Deploys, One Project Per Branch)

Each demo branch deploys to its own Vercel project, **only** via an explicit
CLI command. There is no git integration — pushing to GitHub never triggers a
Vercel build.

| Branch          | Vercel project | Dashboard                                                        |
| --------------- | -------------- | ---------------------------------------------------------------- |
| `client/demo1`  | `demo-1`       | https://vercel.com/md-amir-hossains-projects/demo-1              |
| `client/demo2`  | `demo-2`       | https://vercel.com/md-amir-hossains-projects/demo-2              |
| `client/demoN`  | `demo-N`       | https://vercel.com/md-amir-hossains-projects/demo-N              |

## How the per-branch link works

Two config files, two jobs — do not confuse them:

- `vercel.json` (tracked, already differs per branch) controls **how** Vercel
  builds: framework, install/build commands, region, crons, and
  `git.deploymentEnabled: false` (safety: even if someone reconnects the git
  integration, pushes still won't auto-deploy).
- `.vercel/project.json` (tracked **on purpose** via the `.gitignore`
  exception) controls **where** `vercel deploy` sends the build: it holds the
  `orgId` + `projectId` of that branch's demo project. Each branch commits its
  own copy, so checking out `client/demo2` automatically retargets deploys to
  `demo-2`. The IDs are not secrets (visible in the dashboard URLs).

## One-time setup (this machine)

Run these in your own terminal (the CLI needs browser auth, which automation
cannot do):

```bash
npm install -g vercel   # if the CLI is missing
vercel login            # browser auth; personal account md-amir-hossains-projects
```

## Disconnect git on every demo project (once per project, in the dashboard)

For `demo-1` through `demo-10`: open the project →
**Settings → Git → Disconnect**. After this, `git push` can never trigger a
build anywhere. `vercel.json` additionally sets `git.deploymentEnabled: false`,
so even an accidental reconnect stays inert.

## Link this branch to its project (once per branch)

On `client/demo1`, with the `demo-1` project already existing in the dashboard:

```bash
git checkout client/demo1
vercel link --yes --project demo-1 --scope md-amir-hossains-projects
node -e "console.log(JSON.parse(require('fs').readFileSync('.vercel/project.json','utf8')).projectId)" > .vercel/pinned-project-id
git add .vercel/project.json .vercel/pinned-project-id vercel.json
git commit -m "chore(demo1): link branch to vercel project demo-1"
git push
```

If `vercel link` asks interactively, pick the matching `demo-N` project.
Use plain `vercel link` (single-project file), **not** `vercel link --repo` —
repo linking maps directories to projects and is wrong for this
branch-per-project setup.

`.vercel/pinned-project-id` records demo-1's project ID. From then on the
pre-deploy guard rejects any link file pointing at a different project —
even a valid link to a sibling demo.

## Deploy (manual, only when needed)

```bash
git checkout client/demo1   # make sure you're on the right branch
pnpm deploy:prod            # → demo-1 production URL, and nothing else
```

`pnpm deploy:prod` runs `scripts/vercel-check.sh` first, which aborts unless the
branch is `client/demoN`, the committed `.vercel/project.json` exists, and its
project ID matches the pinned ID. The deploy itself is pinned to
`--scope md-amir-hossains-projects`. Use `pnpm deploy:preview` for a
throwaway preview URL instead.
Verify: `vercel inspect <deployment-url>` or the project dashboard.

## Replicate for demo-2 … demo-10 (per branch, once)

```bash
git checkout client/demo2
# copy this branch's vercel.json as the starting point, keep its crons as needed
git show client/demo1:vercel.json > vercel.json
vercel link --yes --project demo-2 --scope md-amir-hossains-projects
node -e "console.log(JSON.parse(require('fs').readFileSync('.vercel/project.json','utf8')).projectId)" > .vercel/pinned-project-id
git add .vercel/project.json .vercel/pinned-project-id vercel.json .gitignore package.json scripts/vercel-check.sh
git commit -m "chore(demo2): link branch to vercel project demo-2"
git push
```

`.gitignore` (with the `.vercel/` exceptions), the `deploy:*` scripts in
`package.json`, and `scripts/vercel-check.sh` should be identical on every demo
branch — cherry-pick or copy them over the first time. Only
`.vercel/project.json`, `.vercel/pinned-project-id`, and `vercel.json` differ
per branch.

## Environment variables

The Vercel `buildCommand` runs `pnpm db:deploy && pnpm build`, so every demo project needs its own
production env in **dashboard → project → Settings → Environment Variables**,
at minimum `DATABASE_URL` (each demo should point at its own database),
`BETTER_AUTH_SECRET`, `CRON_SECRET`, plus whatever brand config enables
(`pnpm check:env` lists them). Redeploy after changing them.

## Rules

- Never reconnect git integration on the demo projects. If Vercel asks to
  "connect a git repository", decline — deploys go through `pnpm deploy:prod` only.
- Never commit `.vercel/` anything **except** `project.json` and
  `pinned-project-id`.
- Never copy one branch's `.vercel/project.json` onto another branch — always
  `vercel link` to the matching project, then re-record the pin.

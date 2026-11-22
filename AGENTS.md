# AGENTS.md

Serverless Framework plugin that bundles Lambda handlers with esbuild and packs external dependencies via npm/yarn/pnpm.

- This repo uses pnpm only (pinned in `packageManager`). `pnpm test` runs lint first, then unit tests. `pnpm typecheck` is separate and not part of `pnpm test`.
- Do not commit or push unless the user asks.

## More guidance

- [Testing (unit, e2e, Node version limits)](docs/agents/testing.md)
- [Architecture & code conventions (Effect-TS, esbuild compatibility)](docs/agents/architecture.md)
- [Tooling (pnpm, Node versions, lockfile, workspace config)](docs/agents/tooling.md)
- [Git workflow (commits, releases)](docs/agents/git-workflow.md)

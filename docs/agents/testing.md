# Testing

- Unit tests live in `src/tests/` (jest `rootDir` is `src`). To run one file without lint: `pnpm exec jest src/tests/bundle.test.ts` (add `-t "name"` to filter).
- ts-jest type-checks tests: a missing or undeclared type import fails the whole suite (e.g. TS2307 for `type-fest`).
- Unit tests use `mock-fs`, which breaks on Node >= 26.8.0. CI tests Node 22, 24 and 26.7.0.
- `pnpm test:e2e` (`e2e/Makefile`) builds the plugin, copies each `examples/*` into `.test-artifacts/`, installs dependencies with npm, yarn or pnpm (all three must be installed), runs `sls package`, then snapshot-tests the zips via `jest.config.e2e.js`. It is slow (~6 min) and needs network access.
- Run one example: `make -f e2e/Makefile test-e2e-minimal|individually|complete|config`. `config` only checks that `sls package` succeeds and has no snapshot test. Other tools needed on PATH: `make`, `rsync`, `unzip`.
- E2E snapshots live in `e2e/__snapshots__`.
- `examples/*` are fixtures with their own `package.json`, not part of the pnpm workspace. Each covers a packager: `config` uses `pnpm`, `individually` uses `yarn`, the others use `npm`. A new example must also be added to `e2e/Makefile`.

## e2e workarounds (don't undo these)

Examples are copied into `.test-artifacts/` inside the repo, so pnpm and Corepack walk up and find the repo's `package.json` and `pnpm-workspace.yaml`. Because of that:

- `e2e/Makefile` exports `COREPACK_ENABLE_STRICT=0` (Corepack shims) and `SKIP_YARN_COREPACK_CHECK=1` (real yarn classic 1.22.x, as on CI runners). Otherwise yarn refuses to run because the root `packageManager` says pnpm. A local run can pass on the first variable alone while CI fails, so keep both.
- The `config` step creates its own empty `pnpm-workspace.yaml`. Without it the plugin's own `pnpm install` attaches to the repo workspace and writes `.test-artifacts/...` into `pnpm-lock.yaml`.
- The `config` step passes `--config.strictDepBuilds=false`, because pnpm 11 fails installs on unapproved dependency build scripts (`ERR_PNPM_IGNORED_BUILDS`). `.npmrc` cannot set this.
- After any e2e run, confirm `grep -c test-artifacts pnpm-lock.yaml` prints `0`.

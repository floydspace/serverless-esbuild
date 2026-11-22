# Testing

- Unit tests live in `src/tests/` (the `unit` Vitest project in `vitest.config.mts`). To run all unit tests without lint: `pnpm test:unit`. To run one file: `pnpm test:unit src/tests/bundle.test.ts` (add `-t "name"` to filter). Plain `vitest` also includes the `e2e` project, which fails without `.test-artifacts`.
- Vitest does not type-check tests. `pnpm lint` runs eslint and `tsc --noEmit` in parallel, and `tsconfig.json` includes `src` and `e2e`, so type errors in tests fail lint (and so `pnpm test`). `examples/` is excluded from `tsconfig.json` because its dependencies are not installed.
- Unit tests use `mock-fs`, which breaks on Node >= 26.8.0. CI tests Node 22, 24 and 26.7.0.
- `pnpm test:e2e` (`e2e/Makefile`) builds the plugin, copies each `examples/*` into `.test-artifacts/`, installs dependencies with npm, yarn or pnpm (all three must be installed), runs `sls package`, then snapshot-tests the zips via the `e2e` Vitest project. It is slow (~6 min) and needs network access.
- Run one example: `make -f e2e/Makefile test-e2e-minimal|individually|complete|config`. `config` only checks that `sls package` succeeds and has no snapshot test. Other tools needed on PATH: `make`, `rsync`, `unzip`.
- E2E snapshots live in `e2e/__snapshots__`.
- `examples/*` are fixtures with their own `package.json`, not part of the pnpm workspace. Each covers a packager: `config` uses `pnpm`, `individually` uses `yarn`, the others use `npm`. A new example must also be added to `e2e/Makefile`.

## e2e workarounds (don't undo these)

Examples are copied into `.test-artifacts/` inside the repo, so pnpm and Corepack walk up and find the repo's `package.json` and `pnpm-workspace.yaml`. Because of that:

- `e2e/Makefile` exports `COREPACK_ENABLE_STRICT=0` (Corepack shims) and `SKIP_YARN_COREPACK_CHECK=1` (real yarn classic 1.22.x, as on CI runners). Otherwise yarn refuses to run because the root `packageManager` says pnpm. A local run can pass on the first variable alone while CI fails, so keep both.
- The `config` step creates its own empty `pnpm-workspace.yaml`. Without it the plugin's own `pnpm install` attaches to the repo workspace and writes `.test-artifacts/...` into `pnpm-lock.yaml`.
- The `config` step passes `--config.strictDepBuilds=false`, because pnpm 11 fails installs on unapproved dependency build scripts (`ERR_PNPM_IGNORED_BUILDS`). `.npmrc` cannot set this.
- After any e2e run, confirm `grep -c test-artifacts pnpm-lock.yaml` prints `0`.

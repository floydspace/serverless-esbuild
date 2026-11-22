# Tooling: pnpm, Node, lockfile

## Versions

- pnpm is pinned in `packageManager` (11.x). pnpm 11 requires Node >=22.13.
- The plugin itself must still work on Node 18+ (see `engines` and the README), even though dev tooling needs 22.13+. Don't use newer-Node-only APIs in `src/`.
- Stay on pnpm 11 unless the user asks to upgrade. pnpm 12 adds a second YAML "boot document" at the top of `pnpm-lock.yaml`, which dependency scanners may not read.
- When you change the pnpm or Node requirement, update `CONTRIBUTING.md` (Prerequisites section) to match.

## Settings live in `pnpm-workspace.yaml`

- pnpm 11 reads only auth, registry, TLS and proxy settings from `.npmrc`. Everything else goes in `pnpm-workspace.yaml`.
- `packages: ['.']` must stay. Without it pnpm treats every `examples/*` folder as a workspace project and writes them into the lockfile.
- Dependency build scripts are approved with `allowBuilds` (currently only `esbuild`). An unapproved build script fails install with `ERR_PNPM_IGNORED_BUILDS`.
- The eslint version is a catalog entry, used by `overrides` and by `devDependencies`.

## Dependencies and lockfile

- Add dependencies with `pnpm add`, and commit `pnpm-lock.yaml`. CI runs `pnpm install --frozen-lockfile` and fails on a stale lockfile.
- Declare every package you import. pnpm's strict `node_modules` does not expose undeclared packages (this is how `type-fest` was found missing).
- `pnpm audit signatures` verifies registry signatures and needs pnpm 11+. On pnpm 10 it silently runs a plain `pnpm audit`. `npm audit signatures` does not work on pnpm's `node_modules` layout.

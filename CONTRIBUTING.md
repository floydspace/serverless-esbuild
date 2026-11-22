# Contributing

Thanks for helping improve `serverless-esbuild`! This guide covers how to set up the repo, run checks and open a pull request.

## Prerequisites

- Node.js v18 or newer, the same range the plugin supports (see the [README](README.md#features)). CI runs v22, v24 and v26.7.0, so v18 is not covered by CI.
  - Avoid Node.js v26.8+ for now: `mock-fs` breaks on it (see the comment in `.github/workflows/pull.yml`).
- [pnpm](https://pnpm.io/installation) v10. The exact version is pinned in the `packageManager` field of `package.json`, and pnpm downloads it automatically when yours differs.
  - Node.js v25+ no longer bundles Corepack. Install pnpm directly, for example `npm install -g pnpm`.
  - Use pnpm only. Do not run `npm install` or `yarn install` in the repo root, and do not commit `package-lock.json` or `yarn.lock`.
- For the e2e tests only: `make`, `rsync`, `unzip` and `yarn` available in your `PATH`.

## Setup

```sh
pnpm install
```

This also installs the Git hooks (via `husky`):

- `pre-commit` runs `prettier` and `eslint` on staged `*.ts` files.
- `commit-msg` validates your commit message (see [Commit messages](#commit-messages)).

## Commands

| Command          | What it does                                                            |
| ---------------- | ----------------------------------------------------------------------- |
| `pnpm test`      | Runs `eslint`, then the unit tests (`jest`, files in `src/tests`)       |
| `pnpm lint`      | Runs `eslint` only                                                      |
| `pnpm typecheck` | Type-checks without emitting files                                      |
| `pnpm build`     | Cleans `dist` and compiles TypeScript                                   |
| `pnpm dev`       | Compiles TypeScript in watch mode                                       |
| `pnpm test:e2e`  | Builds the plugin and packages every project in `examples/` (see below) |

### End-to-end tests

`pnpm test:e2e` copies each project in `examples/` to `.test-artifacts/`, installs it with the packager that the example is meant to cover (npm, yarn or pnpm), runs `sls package` and checks the output with the tests in `e2e/`.

- It is slow, several minutes, because every example installs its own dependencies.
- The `.test-artifacts/` folder is removed after each run, except for `config`, which only checks that packaging succeeds. It is git-ignored, so you can delete it by hand.
- If you add an example, add it to `e2e/Makefile` as well.

## Dependencies

- Add or update dependencies with pnpm, for example `pnpm add -D <package>`, and commit the changes to `pnpm-lock.yaml`. CI installs with `--frozen-lockfile` and fails if the lockfile is out of date.
- Declare every package you import. pnpm's strict `node_modules` layout does not expose packages that are not listed in `package.json`.
- Settings that apply to the whole repo (such as `overrides`) live in `pnpm-workspace.yaml`.

## Commit messages

Commits follow [Conventional Commits](https://www.conventionalcommits.org/), enforced by `commitlint`. [`semantic-release`](https://github.com/semantic-release/semantic-release) reads them to decide the next version and generate release notes, so the type matters:

- `fix: ...` publishes a patch release.
- `feat: ...` publishes a minor release.
- A `BREAKING CHANGE:` footer or `!` after the type publishes a major release.
- `docs:`, `chore:`, `ci:`, `test:`, `refactor:` and similar do not publish a release.

## Pull requests

1. Fork the repo and create a branch from `master`.
2. Make your change, and add or update tests in `src/tests` for any behavior change.
3. Run `pnpm test` and, if you changed packaging behavior, `pnpm test:e2e`.
4. Open a pull request against `master`. CI runs `pnpm test`, `pnpm test:e2e` and `pnpm build` on Node.js v22, v24 and v26.7.0.
5. If you change documented behavior or options, update the [README](README.md) in the same pull request.

Releases are automated: when a pull request is merged into `master`, `semantic-release` publishes the new version. Contributors do not bump the version or edit a changelog by hand.

## Reporting issues

Use the [issue templates](https://github.com/floydspace/serverless-esbuild/issues/new/choose) for bug reports and feature requests.

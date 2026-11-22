# Git workflow

- Commit messages must follow Conventional Commits (enforced by commitlint). semantic-release publishes from `master` based on them. Use `chore:`, `ci:`, `docs:` or `test:` for changes that must not publish a release.
- The husky pre-commit hook runs lint-staged (prettier + eslint on `*.ts`). Hooks run through `pnpm exec`.
- PRs target `master`. CI (`.github/workflows/pull.yml`) runs `pnpm test`, `pnpm test:e2e` and `pnpm build`.
- Releases are automatic from `master`, `beta` and `alpha` through `.github/workflows/release.yml`: `pnpm audit signatures`, then semantic-release. Don't bump versions or edit a changelog by hand.
- Do not commit or push unless the user asks.

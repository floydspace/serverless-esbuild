# .test-artifacts lives inside the repo, so corepack (local) and yarn classic itself (CI) would otherwise force the root packageManager (pnpm) onto yarn
export COREPACK_ENABLE_STRICT=0
export SKIP_YARN_COREPACK_CHECK=1

test-e2e: test-e2e-minimal test-e2e-individually test-e2e-complete test-e2e-config test-e2e-async-config test-e2e-no-functions test-e2e-exclude

PATCH_REQUIRE = sed -i.bak "s/ERR_REQUIRE_ESM/ERR_REQUIRE_ESM' || error.code === 'ERR_REQUIRE_ASYNC_MODULE/" node_modules/serverless/lib/utils/require-with-import-fallback.js

build:
	pnpm build

test-e2e-minimal: build
	rm -fr ./.test-artifacts && mkdir -p ./.test-artifacts/minimal && rsync -r ./examples/minimal/ ./.test-artifacts/minimal/
	cd ./.test-artifacts/minimal && npm install && $(PATCH_REQUIRE) && npx sls package
	cd ./.test-artifacts/minimal/.serverless && unzip minimal-example.zip
	pnpm exec vitest run --project e2e e2e/minimal.test.ts
	rm -fr ./.test-artifacts

test-e2e-individually: build
	rm -fr ./.test-artifacts && mkdir -p ./.test-artifacts/individually && rsync -r ./examples/individually/ ./.test-artifacts/individually/
	cd ./.test-artifacts/individually && yarn install && $(PATCH_REQUIRE) && npx sls package
	cd ./.test-artifacts/individually/.serverless && unzip hello1.zip && unzip hello2.zip
	pnpm exec vitest run --project e2e e2e/individually.test.ts
	rm -fr ./.test-artifacts

test-e2e-complete: build
	rm -fr ./.test-artifacts && mkdir -p ./.test-artifacts/complete && rsync -r ./examples/complete/ ./.test-artifacts/complete/
	cd ./.test-artifacts/complete && npm install && $(PATCH_REQUIRE) && npx sls package
	cd ./.test-artifacts/complete/.serverless && unzip complete-example.zip
	pnpm exec vitest run --project e2e e2e/complete.test.ts
	rm -fr ./.test-artifacts

test-e2e-config: build
	rm -fr ./.test-artifacts && mkdir -p ./.test-artifacts/config && rsync -r ./examples/config/ ./.test-artifacts/config/
	cd ./.test-artifacts/config && touch pnpm-workspace.yaml && pnpm install --config.strictDepBuilds=false && $(PATCH_REQUIRE) && npx sls package
	cd ./.test-artifacts/config/.serverless && unzip hello1.zip && unzip hello2.zip
	pnpm exec vitest run --project e2e e2e/config.test.ts
	rm -fr ./.test-artifacts

test-e2e-async-config: build
	rm -fr ./.test-artifacts && mkdir -p ./.test-artifacts/async-config && rsync -r ./examples/async-config/ ./.test-artifacts/async-config/
	cd ./.test-artifacts/async-config && npm install && $(PATCH_REQUIRE) && npx sls package
	cd ./.test-artifacts/async-config/.serverless && unzip async-config-example.zip
	pnpm exec vitest run --project e2e e2e/config-async.test.ts
	rm -fr ./.test-artifacts

test-e2e-no-functions: build
	rm -fr ./.test-artifacts && mkdir -p ./.test-artifacts/no-functions && rsync -r ./examples/no-functions/ ./.test-artifacts/no-functions/
	cd ./.test-artifacts/no-functions && npm install && $(PATCH_REQUIRE) && npx sls package
	pnpm exec vitest run --project e2e e2e/no-functions.test.ts
	rm -fr ./.test-artifacts

test-e2e-exclude: build
	rm -fr ./.test-artifacts && mkdir -p ./.test-artifacts/exclude && rsync -r ./examples/exclude/ ./.test-artifacts/exclude/
	cd ./.test-artifacts/exclude && npm install && $(PATCH_REQUIRE) && npx sls package
	cd ./.test-artifacts/exclude/.serverless && unzip hello.zip
	pnpm exec vitest run --project e2e e2e/exclude.test.ts
	rm -fr ./.test-artifacts

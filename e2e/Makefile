test-e2e: test-e2e-minimal test-e2e-individually test-e2e-complete

build:
	npm run build
	npm link

test-e2e-minimal: build
	rm -fr ./e2e/.test-artifacts && mkdir -p ./e2e/.test-artifacts/minimal && rsync -r ./examples/minimal/ ./e2e/.test-artifacts/minimal/
	cd ./e2e/.test-artifacts/minimal && npm ci && npm link serverless-esbuild && npx sls package
	cd ./e2e/.test-artifacts/minimal/.serverless && unzip minimal-example.zip
	npx jest -c jest.config.e2e.js --ci ./e2e/minimal.test.ts
	rm -fr ./e2e/.test-artifacts

test-e2e-individually: build
	rm -fr ./e2e/.test-artifacts && mkdir -p ./e2e/.test-artifacts/individually && rsync -r ./examples/individually/ ./e2e/.test-artifacts/individually/
	cd ./e2e/.test-artifacts/individually && yarn install --frozen-lockfile && npm link serverless-esbuild && npx sls package
	cd ./e2e/.test-artifacts/individually/.serverless && unzip hello1.zip && unzip hello2.zip
	npx jest -c jest.config.e2e.js --ci ./e2e/individually.test.ts
	rm -fr ./e2e/.test-artifacts

test-e2e-complete: build
	rm -fr ./e2e/.test-artifacts && mkdir -p ./e2e/.test-artifacts/complete && rsync -r ./examples/complete/ ./e2e/.test-artifacts/complete/
	cd ./e2e/.test-artifacts/complete && npm ci && npm link serverless-esbuild && npx sls package
	cd ./e2e/.test-artifacts/complete/.serverless && unzip complete-example.zip
	npx jest -c jest.config.e2e.js --ci ./e2e/complete.test.ts
	rm -fr ./e2e/.test-artifacts

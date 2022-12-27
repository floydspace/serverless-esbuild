test-e2e: test-e2e-minimal test-e2e-individually test-e2e-complete

build:
	npm run build

test-e2e-minimal: build
	rm -fr ./.test-artifacts && mkdir -p ./.test-artifacts/minimal && rsync -r ./examples/minimal/ ./.test-artifacts/minimal/
	cd ./.test-artifacts/minimal && npm install && npx sls package
	cd ./.test-artifacts/minimal/.serverless && unzip minimal-example.zip
	npx jest -c jest.config.e2e.js --ci ./e2e/minimal.test.ts
	rm -fr ./.test-artifacts

test-e2e-individually: build
	rm -fr ./.test-artifacts && mkdir -p ./.test-artifacts/individually && rsync -r ./examples/individually/ ./.test-artifacts/individually/
	cd ./.test-artifacts/individually && yarn install && npx sls package
	cd ./.test-artifacts/individually/.serverless && unzip hello1.zip && unzip hello2.zip
	npx jest -c jest.config.e2e.js --ci ./e2e/individually.test.ts
	rm -fr ./.test-artifacts

test-e2e-complete: build
	rm -fr ./.test-artifacts && mkdir -p ./.test-artifacts/complete && rsync -r ./examples/complete/ ./.test-artifacts/complete/
	cd ./.test-artifacts/complete && npm install && npx sls package
	cd ./.test-artifacts/complete/.serverless && unzip complete-example.zip
	npx jest -c jest.config.e2e.js --ci ./e2e/complete.test.ts
	rm -fr ./.test-artifacts

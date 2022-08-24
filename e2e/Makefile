test-e2e: test-e2e-minimal test-e2e-individually test-e2e-complete

build:
	npm run build
	npm link

test-e2e-minimal: build
	rm -fr ./e2e/minimal && mkdir ./e2e/minimal && rsync -r ./examples/minimal/ ./e2e/minimal/
	cd ./e2e/minimal && npm ci && npm link serverless-esbuild && npx sls package
	cd ./e2e/minimal/.serverless && unzip minimal-example.zip
	npx jest -c jest.config.e2e.js --ci ./e2e/minimal.test.ts


test-e2e-individually: build
	rm -fr ./e2e/individually && mkdir ./e2e/individually && rsync -r ./examples/individually/ ./e2e/individually/
	cd ./e2e/individually && npm ci && npm link serverless-esbuild && npx sls package
	cd ./e2e/individually/.serverless && unzip hello1.zip && unzip hello2.zip
	npx jest -c jest.config.e2e.js --ci ./e2e/individually.test.ts


test-e2e-complete: build
	rm -fr ./e2e/complete && mkdir ./e2e/complete && rsync -r ./examples/complete/ ./e2e/complete/
	cd ./e2e/complete && npm ci && npm link serverless-esbuild && npx sls package
	cd ./e2e/complete/.serverless && unzip complete-example.zip
	npx jest -c jest.config.e2e.js --ci ./e2e/complete.test.ts

clean:
	rm -fr ./e2e/complete
	rm -fr ./e2e/individually
	rm -fr ./e2e/minimal

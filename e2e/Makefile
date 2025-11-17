test-e2e: test-e2e-minimal test-e2e-individually test-e2e-complete test-e2e-config

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
	cd ./.test-artifacts/individually && touch yarn.lock && yarn set version classic && yarn install && npx sls package
	cd ./.test-artifacts/individually/.serverless && unzip hello1.zip && unzip hello2.zip
	npx jest -c jest.config.e2e.js --ci ./e2e/individually.test.ts
	rm -fr ./.test-artifacts
	node -e "const f='./package.json',p=require(f);delete p.packageManager;require('fs').writeFileSync(f,JSON.stringify(p,null,2))"

test-e2e-complete: build
	rm -fr ./.test-artifacts && mkdir -p ./.test-artifacts/complete && rsync -r ./examples/complete/ ./.test-artifacts/complete/
	cd ./.test-artifacts/complete && npm install && npx sls package
	cd ./.test-artifacts/complete/.serverless && unzip complete-example.zip
	npx jest -c jest.config.e2e.js --ci ./e2e/complete.test.ts
	rm -fr ./.test-artifacts

test-e2e-config: build
	rm -fr ./.test-artifacts && mkdir -p ./.test-artifacts/config && rsync -r ./examples/config/ ./.test-artifacts/config/
	cd ./.test-artifacts/config && pnpm install && npx sls package

test-e2e-berry: build
	rm -fr ./.test-artifacts && mkdir -p ./.test-artifacts/berry && rsync -r ./examples/berry/ ./.test-artifacts/berry/
	node -e "const fs=require('fs'),f='./package.json',p=require(f);p.workspaces=['.test-artifacts/berry','.test-artifacts/berry/.esbuild/.build'];fs.writeFileSync(f,JSON.stringify(p,null,2))"
	cd ./.test-artifacts/berry && yarn set version berry && yarn install && npx sls package
	cd ./.test-artifacts/berry/.serverless && unzip hello1.zip && unzip hello2.zip
	npx jest -c jest.config.e2e.js --ci ./e2e/berry.test.ts
	rm -fr ./.test-artifacts && rm -fr ./.yarn yarn.lock
	node -e "const f='./package.json',p=require(f);delete p.packageManager;delete p.workspaces;require('fs').writeFileSync(f,JSON.stringify(p,null,2))"

# 💨 serverless-esbuild

[Serverless Framework](https://www.amazon.com/gp/search?ie=UTF8&tag=floydspace-20&linkCode=ur2&linkId=3c35aeea87e6a2d913a5f2110d6a2620&camp=1789&creative=9325&index=books&keywords=Serverless%20Framework) plugin for zero-config JavaScript and TypeScript code bundling using promising fast & furious [`esbuild`](https://github.com/evanw/esbuild) bundler and minifier

[![serverless](http://public.serverless.com/badges/v3.svg)](https://www.serverless.com/plugins/serverless-esbuild)
[![npm version](https://img.shields.io/npm/v/serverless-esbuild?color=brightgreen&label=npm%20package)](https://www.npmjs.com/package/serverless-esbuild)
[![npm downloads](https://img.shields.io/npm/dm/serverless-esbuild)](https://www.npmjs.com/package/serverless-esbuild)
[![build status](https://img.shields.io/github/actions/workflow/status/floydspace/serverless-esbuild/release.yml?branch=master)](https://github.com/floydspace/serverless-esbuild/actions)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)

## Features

- Zero-config: Works out of the box without the need to install any additional plugins
- Works with Typescript and Javascript projects
- Guaranteed to work in Node.js v18 and higher environments
- Supports `sls package`, `sls deploy`, `sls deploy function`
- Integrates with [`Serverless Invoke Local`](https://www.serverless.com/framework/docs/providers/aws/cli-reference/invoke-local) & [`serverless-offline`](https://github.com/dherault/serverless-offline)

## Table of Contents

- [Install](#install)
- [Configuration](#configuration)
  - [Examples](#examples)
  - [Options](#options)
    - [Default Esbuild Options](#default-esbuild-options)
    - [Packager Options](#packager-options)
    - [Watch Options](#watch-options)
- [Supported Runtimes](#supported-runtimes)
- [Advanced Configuration](#advanced-configuration)
  - [Including Extra Files](#including-extra-files)
  - [External Dependencies](#external-dependencies)
  - [Esbuild Plugins](#esbuild-plugins)
- [Usage](#usage)
  - [Automatic Compilation](#automatic-compilation)
  - [Serverless Offline](#serverless-offline)
    - [Serverless Dynamodb Local](#serverless-dynamodb-local)
  - [Invoke Local](#invoke-local)
- [External Tools](#external-tools)
- [Contributors](#contributors)

## Install

```sh
# install `serverless-esbuild` and `esbuild`
yarn add --dev serverless-esbuild esbuild
# or
npm install -D serverless-esbuild esbuild
# or
pnpm install -D serverless-esbuild esbuild
```

Add the following plugin to your `serverless.yml`:

```yaml
plugins:
  - serverless-esbuild
```

## Configuration

By default, no configuration is required, but you can override the default behavior via the `custom.esbuild` section in the `serverless.yml` file.

```yml
custom:
  esbuild:
    bundle: true
    minify: false
```

### Examples

See [example folder](examples) for some example configurations.

### Options

| Option                 | Description                                                                                                                                                                                        | Default                                             |
|------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------|
| Esbuild Options        | This plugin can take almost any [Esbuild Javascript Build Option](https://esbuild.github.io/api/#build-api).                                                                                       | [Default Esbuild Options](#default-esbuild-options) |
| `concurrency`          | The number of concurrent bundle operations to run at once. eg. `8`. _NOTE_: This can be memory intensive and could produce slower builds.                                                          | `Infinity`                                          |
| `zipConcurrency`       | The number of concurrent zip operations to run at once. eg. `8`. _NOTE_: This can be memory intensive and could produce slower builds.                                                             | `Infinity`                                          |
| `exclude`              | An array of dependencies to exclude from the Lambda. This is passed to the esbuild `external` option. Set to `*` to disable packaging `node_modules`                                               | `['aws-sdk']`                                       |
| `installExtraArgs`     | Optional arguments passed to npm or yarn for `external` dependency resolution. eg. `['--legacy-peer-deps']` for npm v7+ to use legacy `peerDependency` resolution behavior                         | `[]`                                                |
| `keepOutputDirectory`  | Keeps the `.esbuild` output folder. Useful for debugging.                                                                                                                                          | `false`                                             |
| `nativeZip`            | Uses the system's `zip` executable to create archives. _NOTE_: This will produce non-deterministic archives which causes a Serverless deployment update on every deploy.                           | `false`                                             |
| `outputBuildFolder`    | The output folder for Esbuild builds within the work folder. You will also need to manually override the watch ignore config if used.                                                              | `'.build'`                                          |
| `outputWorkFolder`     | The output folder for this plugin where all the bundle preparation is done. You will also need to manually override the watch ignore config if used.                                               | `'.esbuild'`                                        |
| `outputFileExtension`  | The file extension used for the bundled output file. This will override the esbuild `outExtension` option                                                                                          | `'.js'`                                             |
| `packagePath`          | Path to the `package.json` file for `external` dependency resolution.                                                                                                                              | `'./package.json'`                                  |
| `packager`             | Packager to use for `external` dependency resolution. Values: `npm`, `yarn`, `pnpm`                                                                                                                | `'npm'`                                             |
| `packagerOptions`      | Extra options for packagers for `external` dependency resolution.                                                                                                                                  | [Packager Options](#packager-options)               |
| `watch`                | Watch options for `serverless-offline`.                                                                                                                                                            | [Watch Options](#watch-options)                     |
| `skipBuild`            | Avoid rebuilding lambda artifacts in favor of reusing previous build artifacts.                                                                                                                    | `false`                                             |
| `skipRebuild`          | A boolean defining whether rebuild is avoided. Generally rebuild produces faster builds but in some context scenarios with many lambdas or low memory computer (like Github Actions) it can cause memory leaks.                                    | `false`                                             |
| `skipBuildExcludeFns` | An array of lambda names that will always be rebuilt if `skipBuild` is set to `true` and bundling individually. This is helpful for dynamically generated functions like serverless-plugin-warmup. | `[]`                                                 |
| `stripEntryResolveExtensions` | A boolean that determines if entrypoints using custom file extensions provided in the `resolveExtensions` ESbuild setting should be stripped of their custom extension upon packing the final bundle for that file. Example: `myLambda.custom.ts` would result in `myLambda.js` instead of `myLambda.custom.js`.
| `disposeContext` | An option to disable the disposal of the context.(Functions can override the global `disposeContext` configuration by specifying their own `disposeContext` option in their individual configurations.) | `true`
#### Default Esbuild Options

The following `esbuild` options are automatically set.

| Option        | Default    | Notes                                                                  |
| ------------- | ---------- | ---------------------------------------------------------------------- |
| `bundle`      | `true`     | Esbuild requires this for use with `external`                          |
| `entryPoints` | N/A        | Cannot be overridden                                                   |
| `outDir`      | N/A        | Cannot be overridden                                                   |
| `platform`    | `'node'`   | Set `format` to `esm` to enable ESM support                            |
| `target`      | `'node18'` | We dynamically set this. See [Supported Runtimes](#supported-runtimes) |
| `watch`       | N/A        | Cannot be overridden                                                   |

#### Packager Options

| Option           | Description                                                                                                                                                                             | Default     |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `scripts`        | A string or array of scripts to be executed, currently only supports 'scripts' for npm, pnpm and yarn                                                                                   | `undefined` |
| `noInstall`      | [Yarn only] A boolean that deactivates the install step                                                                                                                                 | `false`     |
| `ignoreLockfile` | [Yarn, npm only] A boolean to bypass lockfile validation, typically paired with `external` dependencies because we generate a new package.json with only the externalized dependencies. | `false`     |

#### Watch Options

| Option     | Description                                                                                          | Default                                               |
| ---------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `pattern`  | An [anymatch-compatible definition](https://github.com/es128/anymatch) for the watcher to respond to | `./**/*.(js\|ts)` (watches all `.js` and `.ts` files) |
| `ignore`   | An [anymatch-compatible definition](https://github.com/es128/anymatch) for the watcher to ignore     | `['.esbuild', 'dist', 'node_modules', '.build']`      |
| `chokidar` | Any [Chokidar option](https://github.com/paulmillr/chokidar#api)                                     | `{ ignoreInitial: true }`                             |

#### Function Options

| Option        | Description                                                          | Default     |
| ------------- | -------------------------------------------------------------------- | ----------- |
| `skipEsbuild` | Set this property to `true` on a function definition to skip esbuild | `undefined` |

## Supported Runtimes

This plugin will automatically set the esbuild `target` for the following supported Serverless runtimes:

### AWS 

| Runtime      | Target   |
| ------------ | -------- |
| `nodejs22.x` | `node22` |
| `nodejs20.x` | `node20` |
| `nodejs18.x` | `node18` |
| `nodejs16.x` | `node16` |
| `nodejs14.x` | `node14` |
| `nodejs12.x` | `node12` |

### Google

This plugin is compatible with the [serverless-google-cloudfunctions](https://github.com/serverless/serverless-google-cloudfunctions) plugin, and will set the runtimes accordingly.

| Runtime      | Target   |
| ------------ | -------- |
| `nodejs24`   | `node24` |
| `nodejs22`   | `node22` |
| `nodejs20`   | `node20` |
| `nodejs18`   | `node18` |
| `nodejs16`   | `node16` |
| `nodejs14`   | `node14` |
| `nodejs12`   | `node12` |

### Azure

This plugin is compatible with the [serverless-azure-functions](https://github.com/serverless/serverless-azure-functions) plugin, and will set the runtimes accordingly.

| Runtime      | Target   |
| ------------ | -------- |
| `nodejs18`   | `node18` |
| `nodejs16`   | `node16` |
| `nodejs14`   | `node14` |
| `nodejs12`   | `node12` |

**Please Note** When using this package in conjunction with the `serverless-azure-functions` plugin, the following additional configuration is required to ensure function apps are built correctly:

```yml
package:
	patterns: ["host.json", "**/function.json"],
```

### Non-Node functions

If you wish to use this plugin alongside non Node functions like Python or functions with images, this plugin will automatically ignore any function which does not contain a handler or use a supported Node.js runtime.

_Note:_ If you are using Python functions with Serverless Offline you will need to change the `outputWorkFolder` and `outputBuildFolder` to folder names without fullstops.

## Advanced Configuration

### Config file

Esbuild configuration can be defined by a config file.

```yml
custom:
  esbuild:
    config: './esbuild.config.js'
```

```js
// esbuild.config.js
module.exports = (serverless) => ({
  external: ['lodash'],
  plugins: [],
});
```

### Including Extra Files

[Serverless Package Configuration](https://www.serverless.com/framework/docs/providers/aws/guide/packaging#package-configuration) will behave in the same way as native packaging. You can use `patterns`, `include` and `exclude` to include extra files into your bundles.

### External Dependencies

Packages that are marked as `external` and exist in the package.json's `dependencies` will be installed and included with your build under `node_modules`. You can customize this with a number of options.

```yml
custom:
  esbuild:
    external:
      - lodash
    packager: yarn
    packagePath: absolute/path/to/package.json
    packagerOptions:
      scripts:
        - echo 'Hello World!'
        - rm -rf node_modules
    installExtraArgs:
      - '--legacy-peer-deps'
```

To easily mark all the `dependencies` in `package.json` as `external`, you can utilize `esbuild-node-externals` [plugin](https://www.npmjs.com/package/esbuild-node-externals).

To mark one or more individual packages as external, use the following configuration:

```yml
custom:
  esbuild:
    external:
      - 'my-package-name'
      - 'another-package-name'
```

### Esbuild Plugins

_Note: The [Esbuild plugins API](https://esbuild.github.io/plugins/) is still experimental_

You can configure esbuild plugins by passing a plugins' configuration file:

```yml
custom:
  esbuild:
    plugins: plugins.js
```

The plugins' configuration file must be a javascript file exporting an array of plugins (see `examples/individually/plugins.js` for a dummy plugin example):

```javascript
let myPlugin = {
  name: 'my-plugin',
  setup(build) {
    // plugin implementation
  },
};

// default export should be an array of plugins
module.exports = [myPlugin];
```

or a function that accepts `serverless` instance and returns an array of plugins (see [issue #168](https://github.com/floydspace/serverless-esbuild/issues/168) for an example):

```javascript
module.exports = (serverless) => {
  const myPlugin = {
    name: 'my-plugin',
    setup(build) {
      // plugin implementation with `serverless` instance access
      console.log('sls custom options', serverless.service.custom);
    },
  };

  // an array of plugins must be returned
  return [myPlugin];
};
```

## Usage

### Automatic compilation

As long as the plugin is properly installed, all regular Serverless operations `sls package`, `sls deploy`, `sls deploy function`, `sls invoke local`, `sls offline` will automatically compile using `serverless-esbuild`.

### Specify a custom entrypoint for a function

You can specify a custom entrypoint for ESBuild by specifying the `esbuildEntrypoint` field in your function definition.
```typescript
export const myLambdaFunction = {
  handler: '/opt/nodejs/node_modules/my_custom_extension/handler.handler',
  esbuildEntrypoint: './handler.main',
};
```

### Serverless Offline

The plugin integrates very well with [serverless-offline](https://github.com/dherault/serverless-offline) to
simulate AWS Lambda and AWS API Gateway locally.

Add the plugins to your `serverless.yml` file and make sure that `serverless-esbuild`
precedes `serverless-offline` as the order is important:

```yaml
plugins: ...
  - serverless-esbuild
  ...
  - serverless-offline
  ...
```

Run `serverless offline` or `serverless offline start` to start the Lambda/API simulation.

In comparison to `serverless offline`, the `start` command will fire an `init` and a `end` lifecycle hook which is needed for `serverless-offline` and e.g. `serverless-dynamodb-local` to switch off resources (see below)

Automatic compilation is available while using the plugin with `serverless-offline`.

```yml
custom:
  esbuild:
    watch:
      pattern: ['src/**/*.ts'] # match only typescript files in src directory
      ignore: ['temp/**/*']
```

Note: When overriding the ignore pattern, remember to ignore `.build` directory to avoid endless compilation.

#### Serverless Dynamodb Local

Configure your service the same as mentioned above, but additionally add the `serverless-dynamodb-local`
plugin as follows:

```yaml
plugins:
  - serverless-esbuild
  - serverless-dynamodb-local
  - serverless-offline
```

Run `serverless offline start`.

### Invoke Local

This plugin supports the Serverless [Invoke Local](https://www.serverless.com/framework/docs/providers/aws/cli-reference/invoke-local) functionality and will automatically compile the selected function.

## External Tools

- [`serverless-analyze-bundle-plugin`](https://github.com/adriencaccia/serverless-analyze-bundle-plugin): a plugin that allow users to analyze the bundle of a lambda

## Contributors

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/floydspace"><img src="https://avatars.githubusercontent.com/u/5180700?v=4?s=70" width="70px;" alt="Victor Korzunin"/><br /><sub><b>Victor Korzunin</b></sub></a><br /><a href="#question-floydspace" title="Answering Questions">💬</a> <a href="https://github.com/floydspace/serverless-esbuild/commits?author=floydspace" title="Code">💻</a> <a href="https://github.com/floydspace/serverless-esbuild/commits?author=floydspace" title="Documentation">📖</a> <a href="#example-floydspace" title="Examples">💡</a> <a href="#ideas-floydspace" title="Ideas, Planning, & Feedback">🤔</a> <a href="#infra-floydspace" title="Infrastructure (Hosting, Build-Tools, etc)">🚇</a> <a href="#maintenance-floydspace" title="Maintenance">🚧</a> <a href="#plugin-floydspace" title="Plugin/utility libraries">🔌</a> <a href="#projectManagement-floydspace" title="Project Management">📆</a> <a href="https://github.com/floydspace/serverless-esbuild/pulls?q=is%3Apr+reviewed-by%3Afloydspace" title="Reviewed Pull Requests">👀</a> <a href="https://github.com/floydspace/serverless-esbuild/commits?author=floydspace" title="Tests">⚠️</a> <a href="#tool-floydspace" title="Tools">🔧</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/olup"><img src="https://avatars.githubusercontent.com/u/13785588?v=4?s=70" width="70px;" alt="Loup Topalian"/><br /><sub><b>Loup Topalian</b></sub></a><br /><a href="#question-olup" title="Answering Questions">💬</a> <a href="https://github.com/floydspace/serverless-esbuild/commits?author=olup" title="Code">💻</a> <a href="https://github.com/floydspace/serverless-esbuild/commits?author=olup" title="Documentation">📖</a> <a href="#infra-olup" title="Infrastructure (Hosting, Build-Tools, etc)">🚇</a> <a href="#maintenance-olup" title="Maintenance">🚧</a> <a href="#plugin-olup" title="Plugin/utility libraries">🔌</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/samchungy"><img src="https://avatars.githubusercontent.com/u/18017094?v=4?s=70" width="70px;" alt="Sam Chung"/><br /><sub><b>Sam Chung</b></sub></a><br /><a href="#question-samchungy" title="Answering Questions">💬</a> <a href="https://github.com/floydspace/serverless-esbuild/commits?author=samchungy" title="Code">💻</a> <a href="https://github.com/floydspace/serverless-esbuild/commits?author=samchungy" title="Documentation">📖</a> <a href="#example-samchungy" title="Examples">💡</a> <a href="#infra-samchungy" title="Infrastructure (Hosting, Build-Tools, etc)">🚇</a> <a href="#maintenance-samchungy" title="Maintenance">🚧</a> <a href="#plugin-samchungy" title="Plugin/utility libraries">🔌</a> <a href="https://github.com/floydspace/serverless-esbuild/pulls?q=is%3Apr+reviewed-by%3Asamchungy" title="Reviewed Pull Requests">👀</a> <a href="#tool-samchungy" title="Tools">🔧</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/vamche"><img src="https://avatars.githubusercontent.com/u/9653338?v=4?s=70" width="70px;" alt="Vamsi Dharmavarapu"/><br /><sub><b>Vamsi Dharmavarapu</b></sub></a><br /><a href="https://github.com/floydspace/serverless-esbuild/commits?author=vamche" title="Code">💻</a> <a href="https://github.com/floydspace/serverless-esbuild/commits?author=vamche" title="Documentation">📖</a> <a href="#example-vamche" title="Examples">💡</a> <a href="#infra-vamche" title="Infrastructure (Hosting, Build-Tools, etc)">🚇</a> <a href="#maintenance-vamche" title="Maintenance">🚧</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/webdeveric"><img src="https://avatars.githubusercontent.com/u/1823514?v=4?s=70" width="70px;" alt="Eric"/><br /><sub><b>Eric</b></sub></a><br /><a href="https://github.com/floydspace/serverless-esbuild/commits?author=webdeveric" title="Code">💻</a> <a href="#ideas-webdeveric" title="Ideas, Planning, & Feedback">🤔</a> <a href="#maintenance-webdeveric" title="Maintenance">🚧</a> <a href="#infra-webdeveric" title="Infrastructure (Hosting, Build-Tools, etc)">🚇</a> <a href="https://github.com/floydspace/serverless-esbuild/pulls?q=is%3Apr+reviewed-by%3Awebdeveric" title="Reviewed Pull Requests">👀</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/codingnuclei"><img src="https://avatars.githubusercontent.com/u/37954566?v=4?s=70" width="70px;" alt="Chris"/><br /><sub><b>Chris</b></sub></a><br /><a href="https://github.com/floydspace/serverless-esbuild/commits?author=codingnuclei" title="Code">💻</a> <a href="#ideas-codingnuclei" title="Ideas, Planning, & Feedback">🤔</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://geutstudio.com/"><img src="https://avatars.githubusercontent.com/u/819446?v=4?s=70" width="70px;" alt="Martín Acosta"/><br /><sub><b>Martín Acosta</b></sub></a><br /><a href="https://github.com/floydspace/serverless-esbuild/commits?author=tinchoz49" title="Code">💻</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/tonyt-adept"><img src="https://avatars.githubusercontent.com/u/82844324?v=4?s=70" width="70px;" alt="Tony Tyrrell"/><br /><sub><b>Tony Tyrrell</b></sub></a><br /><a href="https://github.com/floydspace/serverless-esbuild/commits?author=tonyt-adept" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://mattjennings.io/"><img src="https://avatars.githubusercontent.com/u/8703090?v=4?s=70" width="70px;" alt="Matt Jennings"/><br /><sub><b>Matt Jennings</b></sub></a><br /><a href="https://github.com/floydspace/serverless-esbuild/commits?author=mattjennings" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/mishabruml"><img src="https://avatars.githubusercontent.com/u/25983780?v=4?s=70" width="70px;" alt="Misha Bruml"/><br /><sub><b>Misha Bruml</b></sub></a><br /><a href="https://github.com/floydspace/serverless-esbuild/commits?author=mishabruml" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://www.swarmion.dev/"><img src="https://avatars.githubusercontent.com/u/29537204?v=4?s=70" width="70px;" alt="François Farge"/><br /><sub><b>François Farge</b></sub></a><br /><a href="https://github.com/floydspace/serverless-esbuild/commits?author=fargito" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://reelcrafter.com/"><img src="https://avatars.githubusercontent.com/u/12532733?v=4?s=70" width="70px;" alt="Sam Hulick"/><br /><sub><b>Sam Hulick</b></sub></a><br /><a href="https://github.com/floydspace/serverless-esbuild/commits?author=ffxsam" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/troyready"><img src="https://avatars.githubusercontent.com/u/1806418?v=4?s=70" width="70px;" alt="Troy Ready"/><br /><sub><b>Troy Ready</b></sub></a><br /><a href="https://github.com/floydspace/serverless-esbuild/commits?author=troyready" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://www.subash.com.au/"><img src="https://avatars.githubusercontent.com/u/1757714?v=4?s=70" width="70px;" alt="subash adhikari"/><br /><sub><b>subash adhikari</b></sub></a><br /><a href="https://github.com/floydspace/serverless-esbuild/commits?author=adikari" title="Code">💻</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/danionescu"><img src="https://avatars.githubusercontent.com/u/3269359?v=4?s=70" width="70px;" alt="Dan Ionescu"/><br /><sub><b>Dan Ionescu</b></sub></a><br /><a href="https://github.com/floydspace/serverless-esbuild/commits?author=danionescu" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/gurushida"><img src="https://avatars.githubusercontent.com/u/49831684?v=4?s=70" width="70px;" alt="gurushida"/><br /><sub><b>gurushida</b></sub></a><br /><a href="https://github.com/floydspace/serverless-esbuild/commits?author=gurushida" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/nickygb"><img src="https://avatars.githubusercontent.com/u/23530107?v=4?s=70" width="70px;" alt="nickygb"/><br /><sub><b>nickygb</b></sub></a><br /><a href="https://github.com/floydspace/serverless-esbuild/commits?author=nickygb" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://twitter.com/capajj"><img src="https://avatars.githubusercontent.com/u/1305378?v=4?s=70" width="70px;" alt="Jiri Spac"/><br /><sub><b>Jiri Spac</b></sub></a><br /><a href="https://github.com/floydspace/serverless-esbuild/commits?author=capaj" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/gavynriebau"><img src="https://avatars.githubusercontent.com/u/11895736?v=4?s=70" width="70px;" alt="gavynriebau"/><br /><sub><b>gavynriebau</b></sub></a><br /><a href="https://github.com/floydspace/serverless-esbuild/commits?author=gavynriebau" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/adriencaccia"><img src="https://avatars.githubusercontent.com/u/19605940?v=4?s=70" width="70px;" alt="Adrien Cacciaguerra"/><br /><sub><b>Adrien Cacciaguerra</b></sub></a><br /><a href="https://github.com/floydspace/serverless-esbuild/commits?author=adriencaccia" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://riotz.works/"><img src="https://avatars.githubusercontent.com/u/31102213?v=4?s=70" width="70px;" alt="lulzneko"/><br /><sub><b>lulzneko</b></sub></a><br /><a href="https://github.com/floydspace/serverless-esbuild/commits?author=lulzneko" title="Code">💻</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://u-ne.co/"><img src="https://avatars.githubusercontent.com/u/603523?v=4?s=70" width="70px;" alt="AOKI Yuuto"/><br /><sub><b>AOKI Yuuto</b></sub></a><br /><a href="https://github.com/floydspace/serverless-esbuild/commits?author=uneco" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/ThomasAribart"><img src="https://avatars.githubusercontent.com/u/38014240?v=4?s=70" width="70px;" alt="Thomas Aribart"/><br /><sub><b>Thomas Aribart</b></sub></a><br /><a href="#ideas-ThomasAribart" title="Ideas, Planning, & Feedback">🤔</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/koryhutchison"><img src="https://avatars.githubusercontent.com/u/22381273?v=4?s=70" width="70px;" alt="Kory Hutchison"/><br /><sub><b>Kory Hutchison</b></sub></a><br /><a href="https://github.com/floydspace/serverless-esbuild/commits?author=koryhutchison" title="Code">💻</a> <a href="#ideas-koryhutchison" title="Ideas, Planning, & Feedback">🤔</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://www.chrishutchinson.me"><img src="https://avatars.githubusercontent.com/u/1573022?v=4?s=70" width="70px;" alt="Chris Hutchinson"/><br /><sub><b>Chris Hutchinson</b></sub></a><br /><a href="https://github.com/floydspace/serverless-esbuild/commits?author=chrishutchinson" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://fredrikmollerstrand.se"><img src="https://avatars.githubusercontent.com/u/12793?v=4?s=70" width="70px;" alt="Fredrik Möllerstrand"/><br /><sub><b>Fredrik Möllerstrand</b></sub></a><br /><a href="https://github.com/floydspace/serverless-esbuild/commits?author=fredrik" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://thisisfashion.tv"><img src="https://avatars.githubusercontent.com/u/19397354?v=4?s=70" width="70px;" alt="Sander Kooger"/><br /><sub><b>Sander Kooger</b></sub></a><br /><a href="https://github.com/floydspace/serverless-esbuild/commits?author=sanderkooger" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://caffeinatedcoding.wordpress.com"><img src="https://avatars.githubusercontent.com/u/1588262?v=4?s=70" width="70px;" alt="Adam Swift"/><br /><sub><b>Adam Swift</b></sub></a><br /><a href="https://github.com/floydspace/serverless-esbuild/commits?author=Gleeble" title="Code">💻</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/fm-sz"><img src="https://avatars.githubusercontent.com/u/119663527?v=4?s=70" width="70px;" alt="Florian Mayer"/><br /><sub><b>Florian Mayer</b></sub></a><br /><a href="https://github.com/floydspace/serverless-esbuild/commits?author=fm-sz" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/ZachLeviPixel"><img src="https://avatars.githubusercontent.com/u/131263652?v=4?s=70" width="70px;" alt="Zach Levi"/><br /><sub><b>Zach Levi</b></sub></a><br /><a href="https://github.com/floydspace/serverless-esbuild/commits?author=ZachLeviPixel" title="Code">💻</a></td>
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

Inspired by [serverless-plugin-typescript](https://github.com/prisma-labs/serverless-plugin-typescript) and [serverless-webpack](https://github.com/serverless-heaven/serverless-webpack)

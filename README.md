# 💨 serverless-esbuild

Serverless plugin for zero-config JavaScript and TypeScript code bundling using promising fast & furious [`esbuild`](https://github.com/evanw/esbuild) bundler and minifier

[![serverless](http://public.serverless.com/badges/v3.svg)](https://www.serverless.com/plugins/serverless-esbuild)
[![npm version](https://img.shields.io/npm/v/serverless-esbuild?color=brightgreen&label=npm%20package)](https://www.npmjs.com/package/serverless-esbuild)
[![npm downloads](https://img.shields.io/npm/dm/serverless-esbuild)](https://www.npmjs.com/package/serverless-esbuild)
[![build status](https://img.shields.io/github/workflow/status/floydspace/serverless-esbuild/release)](https://github.com/floydspace/serverless-esbuild/actions)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)

## Features

- Zero-config: Works out of the box without the need to install any additional plugins
- Works with Typescript and Javascript projects
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

| Option                | Description                                                                                                                                                                | Default                                             |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Esbuild Options       | This plugin can take almost any [Esbuild Javascript Build Option](https://esbuild.github.io/api/#build-api).                                                               | [Default Esbuild Options](#default-esbuild-options) |
| `concurrency`         | The number of concurrent zip and bundle operations to run at once (This can be memory intensive). eg. `10`. _NOTE_: This will produce slower builds.                       | `Infinity`                                          |
| `disableIncremental`  | Disables the use of esbuild `incremental` compilation.                                                                                                                     | `false`                                             |
| `exclude`             | An array of dependencies to exclude from the Lambda. This is passed to the esbuild `external` option. Set to `*` to disable packaging `node_modules`                       | `['aws-sdk']`                                       |
| `installExtraArgs`    | Optional arguments passed to npm or yarn for `external` dependency resolution. eg. `['--legacy-peer-deps']` for npm v7+ to use legacy `peerDependency` resolution behavior | `[]`                                                |
| `keepOutputDirectory` | Keeps the `.esbuild` output folder. Useful for debugging.                                                                                                                  | `false`                                             |
| `nativeZip`           | Uses the system's `zip` executable to create archives. _NOTE_: This will produce non-deterministic archives which causes a Serverless deployment update on every deploy.   | `false`                                             |
| `outputBuildFolder`   | The output folder for Esbuild builds within the work folder. You will also need to manually override the watch ignore config if used.                                      | `'.build'`                                          |
| `outputWorkFolder`    | The output folder for this plugin where all the bundle preparation is done. You will also need to manually override the watch ignore config if used.                       | `'.esbuild'`                                        |
| `outputFileExtension` | The file extension used for the bundled output file. This will override the esbuild `outExtension` option                                                                  | `'.js'`                                             |
| `packagePath`         | Path to the `package.json` file for `external` dependency resolution.                                                                                                      | `'./package.json'`                                  |
| `packager`            | Packager to use for `external` dependency resolution. Values: `npm`, `yarn`, `pnpm`                                                                                        | `'npm'`                                             |
| `packagerOptions`     | Extra options for packagers for `external` dependency resolution.                                                                                                          | [Packager Options](#packager-options)               |
| `watch`               | Watch options for `serverless-offline`.                                                                                                                                    | [Watch Options](#watch-options)                     |

#### Default Esbuild Options

The following `esbuild` options are automatically set.

| Option        | Default    | Notes                                                                  |
| ------------- | ---------- | ---------------------------------------------------------------------- |
| `bundle`      | `true`     | Esbuild requires this for use with `external`                          |
| `entryPoints` | N/A        | Cannot be overridden                                                   |
| `incremental` | N/A        | Cannot be overridden. Use `disableIncremental` to disable it           |
| `outDir`      | N/A        | Cannot be overridden                                                   |
| `platform`    | `'node'`   | Set `format` to `esm` to enable ESM support                            |
| `target`      | `'node12'` | We dynamically set this. See [Supported Runtimes](#supported-runtimes) |
| `watch`       | N/A        | Cannot be overridden                                                   |

#### Packager Options

| Option    | Description                                                                                           | Default     |
| --------- | ----------------------------------------------------------------------------------------------------- | ----------- |
| `scripts` | A string or array of scripts to be executed, currently only supports 'scripts' for npm, pnpm and yarn | `undefined` |

#### Watch Options

| Option    | Description                                                                                          | Default                                                |
| --------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `pattern` | An [anymatch-compatible definition](https://github.com/es128/anymatch) for the watcher to respond to | `./\*_/_.(js\|ts)` (watches all `.js` and `.ts` files) |
| `ignore`  | An [anymatch-compatible definition](https://github.com/es128/anymatch) for the watcher to ignore     | `'.esbuild', 'dist', 'node_modules', '.build']`        |

## Supported Runtimes

This plugin will automatically set the esbuild `target` for the following supported Serverless runtimes

AWS:

| Runtime      | Target   |
| ------------ | -------- |
| `nodejs18.x` | `node18` |
| `nodejs16.x` | `node16` |
| `nodejs14.x` | `node14` |
| `nodejs12.x` | `node12` |

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
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/webdeveric"><img src="https://avatars.githubusercontent.com/u/1823514?v=4?s=70" width="70px;" alt="Eric"/><br /><sub><b>Eric</b></sub></a><br /><a href="https://github.com/floydspace/serverless-esbuild/commits?author=webdeveric" title="Code">💻</a> <a href="#ideas-webdeveric" title="Ideas, Planning, & Feedback">🤔</a> <a href="#maintenance-webdeveric" title="Maintenance">🚧</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/codingnuclei"><img src="https://avatars.githubusercontent.com/u/37954566?v=4?s=70" width="70px;" alt="Chris"/><br /><sub><b>Chris</b></sub></a><br /><a href="#maintenance-codingnuclei" title="Maintenance">🚧</a> <a href="#ideas-codingnuclei" title="Ideas, Planning, & Feedback">🤔</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://geutstudio.com/"><img src="https://avatars.githubusercontent.com/u/819446?v=4?s=70" width="70px;" alt="Martín Acosta"/><br /><sub><b>Martín Acosta</b></sub></a><br /><a href="https://github.com/floydspace/serverless-esbuild/commits?author=tinchoz49" title="Code">💻</a></td>
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

Inspired by [serverless-plugin-typescript](https://github.com/prisma-labs/serverless-plugin-typescript) and [serverless-webpack](https://github.com/serverless-heaven/serverless-webpack)

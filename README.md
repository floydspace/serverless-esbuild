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

| Option                | Description                                                                                                                                                                | Default            |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| Esbuild Options       | This plugin can take almost any [Esbuild Javascript Build Option](https://esbuild.github.io/api/#build-api). See [Default Esbuild Options](#default-esbuild-options)       | N/A                |
| `concurrency`         | The number of concurrent zip and bundle operations to run at once (This can be memory intensive). eg. `10`. _NOTE_: This will produce slower builds.                       | `'Infinity'`       |
| `disableIncremental`  | Disables the use of esbuild `incremental` compilation.                                                                                                                     | `false`            |
| `exclude`             | An array of dependencies to exclude from the Lambda. This is passed to the esbuild `external` option. Set to `*` to disable packaging `node_modules`                       | `['aws-sdk']`      |
| `installExtraArgs`    | Optional arguments passed to npm or yarn for `external` dependency resolution. eg. `['--legacy-peer-deps']` for npm v7+ to use legacy `peerDependency` resolution behavior | `[]`               |
| `keepOutputDirectory` | Keeps the `.esbuild` output folder. Useful for debugging.                                                                                                                  | `false`            |
| `nativeZip`           | Uses the system's `zip` executable to create archives. _NOTE_: This will produce non-deterministic archives which causes a Serverless deployment update on every deploy.   | `false`            |
| `packagePath`         | Path to the `package.json` file for `external` dependency resolution.                                                                                                      | `'./package.json'` |
| `packager`            | Package to use for `external` dependency resolution. Values: `npm`, `yarn`, `pnpm`                                                                                         | `'npm'`            |
| `packagerOptions`     | Extra options for packagers for `external` dependency resolution. See [Packager Options](#packager-options)                                                                | N/A                |
| `watch`               | Watch options for `serverless-offline`. See [Watch Options](#watch-options)                                                                                                | N/A                |

#### Default Esbuild Options

The following `esbuild` options are automatically set.

| Option        | Default    | Notes                                                                  |
| ------------- | ---------- | ---------------------------------------------------------------------- |
| `bundle`      | `true`     | Esbuild requires this for use with `external`                          |
| `entryPoints` | N/A        | Cannot be overridden                                                   |
| `incremental` | N/A        | Cannot be overridden. Use `disableIncremental` to disable it           |
| `outDir`      | N/A        | Cannot be overridden                                                   |
| `platform`    | `'node'`   | Set to `'neutral'` to enable ESM support                               |
| `target`      | `'node12'` | We dynamically set this. See [Supported Runtimes](#supported-runtimes) |

#### Packager Options

| Option    | Description                                                                                           | Default     |
| --------- | ----------------------------------------------------------------------------------------------------- | ----------- |
| `scripts` | A string or array of scripts to be executed, currently only supports 'scripts' for npm, pnpm and yarn | `undefined` |

#### Watch Options

| Option    | Description                                                                                          | Default                                                |
| --------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `pattern` | An [anymatch-compatible definition](https://github.com/es128/anymatch) for the watcher to respond to | `./\*_/_.(js\|ts)` (watches all `.js` and `.ts` files) |
| `ignore`  | An [anymatch-compatible definition](https://github.com/es128/anymatch) for the watcher to ignore     | `['.build', 'dist', 'node_modules', '.serverless']`    |

## Supported Runtimes

This plugin will automatically set the esbuild `target` for the following supported Serverless runtimes

AWS:

| Runtime      | Target   |
| ------------ | -------- |
| `nodejs14.x` | `node14` |
| `nodejs12.x` | `node12` |

If you wish to use this plugin alongside non Node functions like Python or functions with images, this plugin will automatically ignore any function which does not contain a handler or use a supported Node.js runtime.

## Advanced Configuration

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

```
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

Most active, having `Collaborator` role:

<a href="https://floydspace.github.io">
  <img title="@floydspace" src="https://avatars.githubusercontent.com/u/5180700?s=70&v=4" width="70" height="70" alt="@floydspace">
</a>
<a href="https://github.com/olup">
  <img title="@olup" src="https://avatars.githubusercontent.com/u/13785588?s=70&v=4" width="70" height="70" alt="@olup">
</a>
<a href="https://github.com/samchungy">
  <img title="@samchungy" src="https://avatars.githubusercontent.com/u/18017094?s=70&v=4" width="70" height="70" alt="@samchungy">
</a>
<a href="https://github.com/vamche">
  <img title="@vamche" src="https://avatars.githubusercontent.com/u/9653338?s=70&v=4" width="70" height="70" alt="@vamche">
</a>

Inspired by [serverless-plugin-typescript](https://github.com/prisma-labs/serverless-plugin-typescript) and [serverless-webpack](https://github.com/serverless-heaven/serverless-webpack)

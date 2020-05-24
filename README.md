# serverless-esbuild
[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com) [![npm version](https://badge.fury.io/js/serverless-esbuild.svg)](https://badge.fury.io/js/serverless-esbuild) [![Build Status](https://travis-ci.org/floydspace/serverless-esbuild.svg?branch=master)](https://travis-ci.org/floydspace/serverless-esbuild) [![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)

Serverless plugin for zero-config JavaScript and TypeScript code bundling using promising fast & furious [`esbuild`](https://github.com/evanw/esbuild) bundler and minifier

## Features

* Zero-config: Works out of the box without the need to install any other compiler or plugins
* Supports ESNext syntax with transforming limitations (See *Note*)
* Supports `sls package`, `sls deploy` and `sls deploy function`
* Supports `sls invoke local`
* Integrates nicely with [`serverless-offline`](https://github.com/dherault/serverless-offline)

*Note*: The default JavaScript syntax target is set to [`ES2017`](https://node.green/#ES2017), so the final bundle will be supported by all [AWS Lambda Node.js runtimes](https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtimes.html). If you still using an old lambda runtime and have to respect it you can play with esbuild `target` option, see [JavaScript syntax support](https://github.com/evanw/esbuild#javascript-syntax-support) for more details about syntax transform limitations.

## Install

```sh
yarn add --dev serverless-esbuild
# or
npm install -D serverless-esbuild
```

Add the following plugin to your `serverless.yml`:

```yaml
plugins:
  - serverless-esbuild
```

## Configure

By default, no configuration required, but you can change esbuild behavior in custom `esbuild` section in `serverless.yaml` config:

```yml
custom:
  esbuild:
    bundle: true
    minify: false
```

The `aws-sdk` module is exluded from bundle by default, and you can exclude additional dependencies using `external` option. 
Check [esbuild](https://github.com/evanw/esbuild#command-line-usage) documentation for the full list of available options. Note that some options like `entryPoints` or `outdir` cannot be overwritten.

See [example folder](example) for a minimal example.

### Including extra files

All files from `package/include` will be included in the final build file. See [Exclude/Include](https://serverless.com/framework/docs/providers/aws/guide/packaging#exclude--include)


## Usage

### Automatic compilation

The normal Serverless deploy procedure will automatically compile with `esbuild`:

- Create the Serverless project with `serverless create -t aws-nodejs`
- Install Serverless esbuild plugin as above
- Deploy with `serverless deploy`

### Usage with serverless-offline

The plugin integrates very well with [serverless-offline](https://github.com/dherault/serverless-offline) to
simulate AWS Lambda and AWS API Gateway locally.

Add the plugins to your `serverless.yml` file and make sure that `serverless-esbuild`
precedes `serverless-offline` as the order is important:
```yaml
  plugins:
    ...
    - serverless-esbuild
    ...
    - serverless-offline
    ...
```

Run `serverless offline` or `serverless offline start` to start the Lambda/API simulation.

In comparison to `serverless offline`, the `start` command will fire an `init` and a `end` lifecycle hook which is needed for `serverless-offline` and e.g. `serverless-dynamodb-local` to switch off resources (see below)

#### serverless-dynamodb-local

Configure your service the same as mentioned above, but additionally add the `serverless-dynamodb-local`
plugin as follows:
```yaml
  plugins:
    - serverless-esbuild
    - serverless-dynamodb-local
    - serverless-offline
```

Run `serverless offline start`.

### Run a function locally

To run your compiled functions locally you can:

```bash
$ serverless invoke local --function <function-name>
```

Options are:

- `--function` or `-f` (required) is the name of the function to run
- `--path` or `-p` (optional) path to JSON or YAML file holding input data
- `--data` or `-d` (optional) input data

## Author

[Victor Korzunin](https://floydspace.github.io/)

Inspired by [serverless-plugin-typescript](https://github.com/prisma-labs/serverless-plugin-typescript)

# Serverless Framework v4 example

Serverless Framework v4 has its own esbuild build, and it stops with `PLUGIN_TYPESCRIPT_CONFLICT` when `serverless-esbuild` is loaded unless `build.esbuild` is `false`, as in this example.

This example is not covered by the e2e tests: v4 needs a Serverless login (or `SERVERLESS_ACCESS_KEY`) and working AWS credentials, even for `sls package`.

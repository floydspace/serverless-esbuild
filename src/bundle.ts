import assert from 'assert';
import type { BuildOptions } from 'esbuild';
import fs from 'fs-extra';
import pMap from 'p-map';
import path from 'path';
import { uniq } from 'ramda';

import type EsbuildServerlessPlugin from './index';
import { asArray, assertIsString, isESM, isString } from './helper';
import type { EsbuildOptions, FileBuildResult, FunctionBuildResult, BuildContext } from './types';
import { trimExtension } from './utils';

const getStringArray = (input: unknown): string[] => asArray(input).filter(isString);

export async function bundle(this: EsbuildServerlessPlugin): Promise<void> {
  assert(this.buildOptions, 'buildOptions is not defined');

  this.prepare();

  this.log.verbose(`Compiling to ${this.buildOptions?.target} bundle with esbuild...`);

  const exclude = getStringArray(this.buildOptions?.exclude);

  // esbuild v0.7.0 introduced config options validation, so I have to delete plugin specific options from esbuild config.
  const esbuildOptions: EsbuildOptions = [
    'concurrency',
    'zipConcurrency',
    'exclude',
    'nativeZip',
    'packager',
    'packagePath',
    'watch',
    'keepOutputDirectory',
    'packagerOptions',
    'installExtraArgs',
    'outputFileExtension',
    'outputBuildFolder',
    'outputWorkFolder',
    'nodeExternals',
    'skipBuild',
    'skipBuildExcludeFns',
    'stripEntryResolveExtensions',
    'disposeContext',
  ].reduce<Record<string, any>>((options, optionName) => {
    const { [optionName]: _, ...rest } = options;

    return rest;
  }, this.buildOptions);

  const config: Omit<BuildOptions, 'watch'> = {
    ...esbuildOptions,
    external: [...getStringArray(this.buildOptions?.external), ...(exclude.includes('*') ? [] : exclude)],
    plugins: this.plugins,
  };

  const { buildOptions, buildDirPath } = this;

  assert(buildOptions, 'buildOptions is not defined');

  assertIsString(buildDirPath, 'buildDirPath is not a string');

  if (isESM(buildOptions) && buildOptions.outputFileExtension === '.cjs') {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore Serverless typings (as of v3.0.2) are incorrect
    throw new this.serverless.classes.Error(
      'ERROR: format "esm" or platform "neutral" should not output a file with extension ".cjs".'
    );
  }

  if (!isESM(buildOptions) && buildOptions.outputFileExtension === '.mjs') {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore Serverless typings (as of v3.0.2) are incorrect
    throw new this.serverless.classes.Error('ERROR: Non esm builds should not output a file with extension ".mjs".');
  }

  if (buildOptions.outputFileExtension !== '.js') {
    config.outExtension = { '.js': buildOptions.outputFileExtension };
  }

  /** Build the files */
  const bundleMapper = async (entry: string): Promise<FileBuildResult> => {
    const bundlePath = entry.slice(0, entry.lastIndexOf('.')) + buildOptions.outputFileExtension;

    // check cache
    if (this.buildCache) {
      const { result, context } = this.buildCache[entry] ?? {};

      if (result?.rebuild) {
        await result.rebuild();
        return { bundlePath, entry, result };
      }

      if (context?.rebuild) {
        const rebuild = await context.rebuild();
        return { bundlePath, entry, context, result: rebuild };
      }
    }

    const options = {
      ...config,
      entryPoints: [entry],
      outdir: path.join(buildDirPath, path.dirname(entry)),
    };

    const pkg = await import('esbuild');

    type ContextFn = (opts: typeof options) => Promise<BuildContext>;
    type WithContext = typeof pkg & { context?: ContextFn };
    const context = await (pkg as WithContext).context?.(options);

    let result = await context?.rebuild();

    if (!result) {
      result = await pkg.build(options);
    }

    if (config.metafile) {
      fs.writeFileSync(
        path.join(buildDirPath, `${trimExtension(entry)}-meta.json`),
        JSON.stringify(result.metafile, null, 2)
      );
    }

    return { bundlePath, entry, result, context };
  };

  // Files can contain multiple handlers for multiple functions, we want to get only the unique ones
  const uniqueFiles: string[] = uniq(this.functionEntries.map(({ entry }) => entry));

  this.log.verbose(`Compiling with concurrency: ${buildOptions.concurrency}`);

  const fileBuildResults = await pMap(uniqueFiles, bundleMapper, {
    concurrency: buildOptions.concurrency,
  });

  // Create a cache with entry as key
  this.buildCache = fileBuildResults.reduce<Record<string, FileBuildResult>>((acc, fileBuildResult) => {
    acc[fileBuildResult.entry] = fileBuildResult;

    return acc;
  }, {});

  // Map function entries back to bundles
  this.buildResults = this.functionEntries
    .map(({ entry, func, functionAlias }) => {
      const { bundlePath } = this.buildCache[entry] ?? {};

      if (typeof bundlePath !== 'string' || func === null) {
        return;
      }

      return { bundlePath, func, functionAlias };
    })
    .filter((result): result is FunctionBuildResult => typeof result === 'object');

  this.log.verbose('Compiling completed.');
}

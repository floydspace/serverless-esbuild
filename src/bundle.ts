import { BuildOptions, build } from 'esbuild';
import fs from 'fs-extra';
import pMap from 'p-map';
import path from 'path';
import { uniq } from 'ramda';

import EsbuildServerlessPlugin from '.';
import { isESM } from './helper';
import { FileBuildResult } from './types';
import { trimExtension } from './utils';

export async function bundle(this: EsbuildServerlessPlugin, incremental = false): Promise<void> {
  this.prepare();
  this.log.verbose(`Compiling to ${this.buildOptions.target} bundle with esbuild...`);
  if (this.buildOptions.disableIncremental === true) {
    incremental = false;
  }

  const config: Omit<BuildOptions, 'watch'> = {
    ...this.buildOptions,
    external: [
      ...this.buildOptions.external,
      ...(this.buildOptions.exclude === '*' || this.buildOptions.exclude.includes('*')
        ? []
        : this.buildOptions.exclude),
    ],
    incremental,
    plugins: this.plugins,
  };

  if (isESM(this.buildOptions) && this.buildOptions.outputFileExtension === '.cjs') {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore Serverless typings (as of v3.0.2) are incorrect
    throw new this.serverless.classes.Error(
      'ERROR: format "esm" or platform "neutral" should not output a file with extension ".cjs".'
    );
  }

  if (!isESM(this.buildOptions) && this.buildOptions.outputFileExtension === '.mjs') {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore Serverless typings (as of v3.0.2) are incorrect
    throw new this.serverless.classes.Error('ERROR: Non esm builds should not output a file with extension ".mjs".');
  }

  if (this.buildOptions.outputFileExtension !== '.js') {
    config.outExtension = { '.js': this.buildOptions.outputFileExtension };
  }

  // esbuild v0.7.0 introduced config options validation, so I have to delete plugin specific options from esbuild config.
  delete config['concurrency'];
  delete config['exclude'];
  delete config['nativeZip'];
  delete config['packager'];
  delete config['packagePath'];
  delete config['watch'];
  delete config['keepOutputDirectory'];
  delete config['packagerOptions'];
  delete config['installExtraArgs'];
  delete config['disableIncremental'];
  delete config['outputFileExtension'];
  delete config['outputBuildFolder'];
  delete config['outputWorkFolder'];
  delete config['nodeExternals'];
  delete config['link'];

  /** Build the files */
  const bundleMapper = async (entry: string): Promise<FileBuildResult> => {
    const bundlePath = entry.slice(0, entry.lastIndexOf('.')) + this.buildOptions.outputFileExtension;

    // check cache
    if (this.buildCache) {
      const { result } = this.buildCache[entry];
      if (result?.rebuild) {
        await result.rebuild();
        return { bundlePath, entry, result };
      }
    }

    const result = await build({
      ...config,
      entryPoints: [entry],
      outdir: path.join(this.buildDirPath, path.dirname(entry)),
    });

    if (config.metafile) {
      fs.writeFileSync(
        path.join(this.buildDirPath, `${trimExtension(entry)}-meta.json`),
        JSON.stringify(result.metafile, null, 2)
      );
    }
    return { bundlePath, entry, result };
  };

  // Files can contain multiple handlers for multiple functions, we want to get only the unique ones
  const uniqueFiles: string[] = uniq(this.functionEntries.map(({ entry }) => entry));

  this.log.verbose(`Compiling with concurrency: ${this.buildOptions.concurrency}`);

  const fileBuildResults = await pMap(uniqueFiles, bundleMapper, {
    concurrency: this.buildOptions.concurrency,
  });

  // Create a cache with entry as key
  this.buildCache = fileBuildResults.reduce<Record<string, FileBuildResult>>((acc, fileBuildResult) => {
    acc[fileBuildResult.entry] = fileBuildResult;
    return acc;
  }, {});

  // Map function entries back to bundles
  this.buildResults = this.functionEntries.map(({ entry, func, functionAlias }) => {
    const { bundlePath } = this.buildCache[entry];
    return { bundlePath, func, functionAlias };
  });

  this.log.verbose('Compiling completed.');
}

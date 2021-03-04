import { build, BuildResult, BuildOptions } from 'esbuild';
import * as fs from 'fs-extra';
import * as globby from 'globby';
import * as path from 'path';
import { mergeRight } from 'ramda';
import * as Serverless from 'serverless';
import * as Plugin from 'serverless/classes/Plugin';
import * as chokidar from 'chokidar';

import { extractFileNames } from './helper';
import { packExternalModules } from './pack-externals';
import { packIndividually } from './pack-individually';

export const SERVERLESS_FOLDER = '.serverless';
export const BUILD_FOLDER = '.build';

interface OptionsExtended extends Serverless.Options {
  verbose?: boolean;
}

export interface WatchConfiguration {
  pattern?: string[] | string;
  ignore?: string[] | string;
}

export interface Configuration extends Omit<BuildOptions, 'watch'> {
  packager: 'npm' | 'yarn';
  packagePath: string;
  rootPackagePath: string;
  exclude: string[];
  watch: WatchConfiguration;
}

const DEFAULT_BUILD_OPTIONS: Partial<Configuration> = {
  bundle: true,
  target: 'es2017',
  external: [],
  exclude: ['aws-sdk'],
  packager: 'npm',
  watch: {
    pattern: './**/*.(js|ts)',
    ignore: [BUILD_FOLDER, 'dist', 'node_modules', SERVERLESS_FOLDER],
  },
};

export class EsbuildPlugin implements Plugin {
  private originalServicePath: string;

  serverless: Serverless;
  options: OptionsExtended;
  hooks: Plugin.Hooks;
  buildOptions: Configuration;
  buildResults: {
    result: BuildResult;
    bundlePath: string;
    func: any;
  }[];
  packExternalModules: () => Promise<void>;
  packIndividually: () => Promise<void>;

  constructor(serverless: Serverless, options: OptionsExtended) {
    this.serverless = serverless;
    this.options = options;
    this.packExternalModules = packExternalModules.bind(this);
    this.packIndividually = packIndividually.bind(this);

    const withDefaultOptions = mergeRight(DEFAULT_BUILD_OPTIONS);
    this.buildOptions = withDefaultOptions<Configuration>(
      this.serverless.service.custom?.esbuild ?? {}
    );

    this.hooks = {
      'before:run:run': async () => {
        await this.bundle();
        await this.packExternalModules();
        await this.copyExtras();
      },
      'before:offline:start': async () => {
        await this.bundle();
        await this.packExternalModules();
        await this.copyExtras();
        this.watch();
      },
      'before:offline:start:init': async () => {
        await this.bundle();
        await this.packExternalModules();
        await this.copyExtras();
        this.watch();
      },
      'before:package:createDeploymentArtifacts': async () => {
        await this.bundle();
        await this.packExternalModules();
        await this.copyExtras();
        await this.packIndividually();
      },
      'after:package:createDeploymentArtifacts': async () => {
        await this.cleanup();
      },
      'before:deploy:function:packageFunction': async () => {
        await this.bundle();
        await this.packExternalModules();
        await this.copyExtras();
        await this.packIndividually();
      },
      'after:deploy:function:packageFunction': async () => {
        await this.cleanup();
      },
      'before:invoke:local:invoke': async () => {
        await this.bundle();
        await this.packExternalModules();
        await this.copyExtras();
      },
    };
  }

  get functions(): Record<string, Serverless.FunctionDefinitionHandler> {
    if (this.options.function) {
      return {
        [this.options.function]: this.serverless.service.getFunction(
          this.options.function
        ) as Serverless.FunctionDefinitionHandler,
      };
    }

    return this.serverless.service.functions as Record<
      string,
      Serverless.FunctionDefinitionHandler
    >;
  }

  get rootFileNames() {
    return extractFileNames(
      this.originalServicePath,
      this.serverless.service.provider.name,
      this.functions
    );
  }

  async watch(): Promise<void> {
    const options = {
      ignored: this.buildOptions.watch.ignore,
      awaitWriteFinish: true,
      ignoreInitial: true,
    };

    chokidar.watch(this.buildOptions.watch.pattern, options).on('all', () =>
      this.bundle(true)
        .then(() => this.serverless.cli.log('Watching files for changes...'))
        .catch(() =>
          this.serverless.cli.log('Bundle error, waiting for a file change to reload...')
        )
    );
  }

  prepare() {
    // exclude serverless-esbuild
    for (const fnName in this.functions) {
      const fn = this.serverless.service.getFunction(fnName);
      fn.package = fn.package || {
        exclude: [],
        include: [],
      };

      // Add plugin to excluded packages or an empty array if exclude is undefined
      fn.package.exclude = [
        ...new Set([...(fn.package.exclude || []), 'node_modules/serverless-esbuild']),
      ];
    }
  }

  async bundle(incremental = false): Promise<BuildResult[]> {
    this.prepare();
    this.serverless.cli.log('Compiling with esbuild...');

    if (!this.originalServicePath) {
      // Save original service path and functions
      this.originalServicePath = this.serverless.config.servicePath;
      // Fake service path so that serverless will know what to zip
      this.serverless.config.servicePath = path.join(this.originalServicePath, BUILD_FOLDER);
    }

    return Promise.all(
      this.rootFileNames.map(async ({ entry, func }) => {
        const config: Omit<BuildOptions, 'watch'> = {
          ...this.buildOptions,
          external: [...this.buildOptions.external, ...this.buildOptions.exclude],
          entryPoints: [entry],
          outdir: path.join(this.originalServicePath, BUILD_FOLDER, path.dirname(entry)),
          platform: 'node',
          incremental,
        };

        // esbuild v0.7.0 introduced config options validation, so I have to delete plugin specific options from esbuild config.
        delete config['exclude'];
        delete config['packager'];
        delete config['packagePath'];
        delete config['watch'];

        const result = await build(config);

        const bundlePath = entry.substr(0, entry.lastIndexOf('.')) + '.js';
        return { result, bundlePath, func };
      })
    ).then(results => {
      this.serverless.cli.log('Compiling completed.');
      this.buildResults = results;
      return results.map(r => r.result);
    });
  }

  /** Link or copy extras such as node_modules or package.include definitions */
  async copyExtras() {
    const { service } = this.serverless;

    // include any "extras" from the "include" section
    if (service.package.include && service.package.include.length > 0) {
      const files = await globby(service.package.include);

      for (const filename of files) {
        const destFileName = path.resolve(path.join(BUILD_FOLDER, filename));
        const dirname = path.dirname(destFileName);

        if (!fs.existsSync(dirname)) {
          fs.mkdirpSync(dirname);
        }

        if (!fs.existsSync(destFileName)) {
          fs.copySync(path.resolve(filename), path.resolve(path.join(BUILD_FOLDER, filename)));
        }
      }
    }
  }

  /**
   * Move built code to the serverless folder, taking into account individual
   * packaging preferences.
   */
  async moveArtifacts(): Promise<void> {
    const { service } = this.serverless;

    await fs.copy(
      path.join(this.originalServicePath, BUILD_FOLDER, SERVERLESS_FOLDER),
      path.join(this.originalServicePath, SERVERLESS_FOLDER)
    );

    if (this.options.function) {
      const fn = service.getFunction(this.options.function);
      fn.package.artifact = path.join(
        this.originalServicePath,
        SERVERLESS_FOLDER,
        path.basename(fn.package.artifact)
      );
      return;
    }

    if (service.package.individually) {
      const functionNames = service.getAllFunctions();
      functionNames.forEach(name => {
        service.getFunction(name).package.artifact = path.join(
          this.originalServicePath,
          SERVERLESS_FOLDER,
          path.basename(service.getFunction(name).package.artifact)
        );
      });
      return;
    }

    service.package.artifact = path.join(
      this.originalServicePath,
      SERVERLESS_FOLDER,
      path.basename(service.package.artifact)
    );
  }

  async cleanup(): Promise<void> {
    await this.moveArtifacts();
    // Restore service path
    this.serverless.config.servicePath = this.originalServicePath;
    // Remove temp build folder
    fs.removeSync(path.join(this.originalServicePath, BUILD_FOLDER));
  }
}

module.exports = EsbuildPlugin;

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
import { pack } from './pack';
import { preOffline } from './pre-offline';
import { preLocal } from './pre-local';

export const SERVERLESS_FOLDER = '.serverless';
export const BUILD_FOLDER = '.build';
export const WORK_FOLDER = '.esbuild';

interface OptionsExtended extends Serverless.Options {
  verbose?: boolean;
}

export interface WatchConfiguration {
  pattern?: string[] | string;
  ignore?: string[] | string;
}

export interface Configuration extends Omit<BuildOptions, 'watch' | 'plugins'> {
  packager: 'npm' | 'yarn';
  packagePath: string;
  exclude: string[];
  watch: WatchConfiguration;
  plugins?: string;
}

const DEFAULT_BUILD_OPTIONS: Partial<Configuration> = {
  bundle: true,
  target: 'es2017',
  external: [],
  exclude: ['aws-sdk'],
  packager: 'npm',
  watch: {
    pattern: './**/*.(js|ts)',
    ignore: [WORK_FOLDER, 'dist', 'node_modules', SERVERLESS_FOLDER],
  },
};

export class EsbuildPlugin implements Plugin {
  workDirPath: string;
  buildDirPath: string;

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
  pack: () => Promise<void>;
  preOffline: () => Promise<void>;
  preLocal: () => void;

  constructor(serverless: Serverless, options: OptionsExtended) {
    this.serverless = serverless;
    this.options = options;
    this.packExternalModules = packExternalModules.bind(this);
    this.pack = pack.bind(this);
    this.preOffline = preOffline.bind(this);
    this.preLocal = preLocal.bind(this);

    this.workDirPath = path.join(this.serverless.config.servicePath, WORK_FOLDER);
    this.buildDirPath = path.join(this.workDirPath, BUILD_FOLDER);

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
        await this.preOffline();
        this.watch();
      },
      'before:offline:start:init': async () => {
        await this.bundle();
        await this.packExternalModules();
        await this.copyExtras();
        await this.preOffline();
        this.watch();
      },
      'before:package:createDeploymentArtifacts': async () => {
        await this.bundle();
        await this.packExternalModules();
        await this.copyExtras();
        await this.pack();
      },
      'after:package:createDeploymentArtifacts': async () => {
        await this.cleanup();
      },
      'before:deploy:function:packageFunction': async () => {
        await this.bundle();
        await this.packExternalModules();
        await this.copyExtras();
        await this.pack();
      },
      'after:deploy:function:packageFunction': async () => {
        await this.cleanup();
      },
      'before:invoke:local:invoke': async () => {
        await this.bundle();
        await this.packExternalModules();
        await this.copyExtras();
        await this.preLocal();
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
      this.serverless.config.servicePath,
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
    fs.mkdirpSync(this.buildDirPath);
    fs.mkdirpSync(path.join(this.workDirPath, SERVERLESS_FOLDER));
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

    return Promise.all(
      this.rootFileNames.map(async ({ entry, func }) => {
        const config: Omit<BuildOptions, 'watch'> = {
          ...this.buildOptions,
          external: [...this.buildOptions.external, ...this.buildOptions.exclude],
          entryPoints: [entry],
          outdir: path.join(this.buildDirPath, path.dirname(entry)),
          platform: 'node',
          incremental,
          plugins:
            this.buildOptions.plugins &&
            require(path.join(this.serverless.config.servicePath, this.buildOptions.plugins)),
        };

        // esbuild v0.7.0 introduced config options validation, so I have to delete plugin specific options from esbuild config.
        delete config['exclude'];
        delete config['packager'];
        delete config['packagePath'];
        delete config['watch'];
        delete config['pugins'];

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
        const destFileName = path.resolve(path.join(this.buildDirPath, filename));
        const dirname = path.dirname(destFileName);

        if (!fs.existsSync(dirname)) {
          fs.mkdirpSync(dirname);
        }

        if (!fs.existsSync(destFileName)) {
          fs.copySync(path.resolve(filename), path.resolve(path.join(this.buildDirPath, filename)));
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
      path.join(this.workDirPath, SERVERLESS_FOLDER),
      path.join(this.serverless.config.servicePath, SERVERLESS_FOLDER)
    );

    if (this.options.function) {
      const fn = service.getFunction(this.options.function);
      fn.package.artifact = path.join(
        this.serverless.config.servicePath,
        SERVERLESS_FOLDER,
        path.basename(fn.package.artifact)
      );
      return;
    }

    if (service.package.individually) {
      const functionNames = service.getAllFunctions();
      functionNames.forEach(name => {
        service.getFunction(name).package.artifact = path.join(
          this.serverless.config.servicePath,
          SERVERLESS_FOLDER,
          path.basename(service.getFunction(name).package.artifact)
        );
      });
      return;
    }

    service.package.artifact = path.join(
      this.serverless.config.servicePath,
      SERVERLESS_FOLDER,
      path.basename(service.package.artifact)
    );
  }

  async cleanup(): Promise<void> {
    await this.moveArtifacts();
    // Remove temp build folder
    fs.removeSync(path.join(this.workDirPath));
  }
}

module.exports = EsbuildPlugin;

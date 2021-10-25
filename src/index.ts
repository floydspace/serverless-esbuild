import { build, BuildResult, BuildOptions, Plugin } from 'esbuild';
import * as fs from 'fs-extra';
import * as globby from 'globby';
import * as path from 'path';
import * as pMap from 'p-map';
import { concat, always, memoizeWith, mergeRight } from 'ramda';
import * as Serverless from 'serverless';
import * as ServerlessPlugin from 'serverless/classes/Plugin';
import * as Service from 'serverless/classes/Service';
import * as chokidar from 'chokidar';

import { extractFileNames, providerRuntimeMatcher } from './helper';
import { packExternalModules } from './pack-externals';
import { pack } from './pack';
import { preOffline } from './pre-offline';
import { preLocal } from './pre-local';
import { trimExtension } from './utils';

export const SERVERLESS_FOLDER = '.serverless';
export const BUILD_FOLDER = '.build';
export const WORK_FOLDER = '.esbuild';

type Plugins = Plugin[];
type ReturnPluginsFn = (sls: Serverless) => Plugins;

interface OptionsExtended extends Serverless.Options {
  verbose?: boolean;
}

export interface WatchConfiguration {
  pattern?: string[] | string;
  ignore?: string[] | string;
}

export interface PackagerOptions {
  scripts?: string[] | string;
}

export interface Configuration extends Omit<BuildOptions, 'nativeZip' | 'watch' | 'plugins'> {
  concurrency?: number;
  packager: 'npm' | 'yarn';
  packagePath: string;
  exclude: '*' | string[];
  nativeZip: boolean;
  watch: WatchConfiguration;
  installExtraArgs: string[];
  plugins?: string;
  keepOutputDirectory?: boolean;
  packagerOptions?: PackagerOptions;
}

const DEFAULT_BUILD_OPTIONS: Partial<Configuration> = {
  bundle: true,
  target: 'node10',
  external: [],
  exclude: ['aws-sdk'],
  nativeZip: false,
  packager: 'npm',
  installExtraArgs: [],
  watch: {
    pattern: './**/*.(js|ts)',
    ignore: [WORK_FOLDER, 'dist', 'node_modules', SERVERLESS_FOLDER],
  },
  keepOutputDirectory: false,
  packagerOptions: {},
};

export class EsbuildServerlessPlugin implements ServerlessPlugin {
  serviceDirPath: string;
  workDirPath: string;
  buildDirPath: string;

  serverless: Serverless;
  options: OptionsExtended;
  hooks: ServerlessPlugin.Hooks;
  buildResults: {
    result: BuildResult;
    bundlePath: string;
    func: any;
    functionAlias: string;
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

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore old versions use servicePath, new versions serviceDir. Types will use only one of them
    this.serviceDirPath = this.serverless.config.serviceDir || this.serverless.config.servicePath;
    this.workDirPath = path.join(this.serviceDirPath, WORK_FOLDER);
    this.buildDirPath = path.join(this.workDirPath, BUILD_FOLDER);

    this.hooks = {
      'before:run:run': async () => {
        await this.bundle();
        await this.packExternalModules();
        await this.copyExtras();
      },
      'before:offline:start': async () => {
        await this.bundle(true);
        await this.packExternalModules();
        await this.copyExtras();
        await this.preOffline();
        this.watch();
      },
      'before:offline:start:init': async () => {
        await this.bundle(true);
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

  /**
   * Checks if the runtime for the given function is nodejs.
   * If the runtime is not set , checks the global runtime.
   * @param {Serverless.FunctionDefinitionHandler} func the function to be checked
   * @returns {boolean} true if the function/global runtime is nodejs; false, otherwise
   */
  private isNodeFunction(func: Serverless.FunctionDefinitionHandler): boolean {
    const runtime = func.runtime || this.serverless.service.provider.runtime;
    const runtimeMatcher = providerRuntimeMatcher[this.serverless.service.provider.name];
    return Boolean(runtimeMatcher?.[runtime]);
  }

  /**
   * Checks if the function has a handler
   * @param {Serverless.FunctionDefinitionHandler | Serverless.FunctionDefinitionImage} func the function to be checked
   * @returns {boolean} true if the function has a handler
   */
  private isFunctionDefinitionHandler(
    func: Serverless.FunctionDefinitionHandler | Serverless.FunctionDefinitionImage
  ): func is Serverless.FunctionDefinitionHandler {
    return Boolean((func as Serverless.FunctionDefinitionHandler)?.handler);
  }

  get functions(): Record<string, Serverless.FunctionDefinitionHandler> {
    let functions: Service['functions'];
    if (this.options.function) {
      functions = {
        [this.options.function]: this.serverless.service.getFunction(this.options.function),
      };
    } else {
      functions = this.serverless.service.functions;
    }

    // ignore all functions with a different runtime than nodejs:
    const nodeFunctions: Record<string, Serverless.FunctionDefinitionHandler> = {};
    for (const funcName in functions) {
      const func = functions[funcName] as Serverless.FunctionDefinitionHandler;
      if (this.isFunctionDefinitionHandler(func) && this.isNodeFunction(func)) {
        nodeFunctions[funcName] = func;
      }
    }
    return nodeFunctions;
  }

  get plugins(): Plugins {
    if (!this.buildOptions.plugins) return;

    const plugins: Plugins | ReturnPluginsFn = require(path.join(
      this.serviceDirPath,
      this.buildOptions.plugins
    ));

    if (typeof plugins === 'function') {
      return plugins(this.serverless);
    }

    return plugins;
  }

  private getCachedOptions = memoizeWith(always('cache'), () => {
    const runtimeMatcher = providerRuntimeMatcher[this.serverless.service.provider.name];
    const target = runtimeMatcher?.[this.serverless.service.provider.runtime];
    const resolvedOptions = {
      ...(target ? { target } : {}),
    };
    const withDefaultOptions = mergeRight(DEFAULT_BUILD_OPTIONS);
    const withResolvedOptions = mergeRight(withDefaultOptions(resolvedOptions));
    return withResolvedOptions<Configuration>(this.serverless.service.custom?.esbuild ?? {});
  });

  get buildOptions() {
    return this.getCachedOptions();
  }

  get rootFileNames() {
    return extractFileNames(
      this.serviceDirPath,
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
    this.serverless.service.package = {
      ...(this.serverless.service.package || {}),
      patterns: [
        ...new Set([
          ...(this.serverless.service.package?.include || []),
          ...(this.serverless.service.package?.exclude || []).map(concat('!')),
          ...(this.serverless.service.package?.patterns || []),
          '!node_modules/serverless-esbuild',
        ]),
      ],
    };

    for (const fnName in this.functions) {
      const fn = this.serverless.service.getFunction(fnName);
      fn.package = {
        ...(fn.package || {}),
        patterns: [
          ...new Set([
            ...(fn.package?.include || []),
            ...(fn.package?.exclude || []).map(concat('!')),
            ...(fn.package?.patterns || []),
          ]),
        ],
      };
    }
  }

  async bundle(incremental = false): Promise<BuildResult[]> {
    this.prepare();
    this.serverless.cli.log(`Compiling to ${this.buildOptions.target} bundle with esbuild...`);

    const bundleMapper = async (bundleInfo) => {
      const { entry, func, functionAlias } = bundleInfo;
      const config: Omit<BuildOptions, 'watch'> = {
        ...this.buildOptions,
        external: [
          ...this.buildOptions.external,
          ...(this.buildOptions.exclude === '*' || this.buildOptions.exclude.includes('*')
            ? []
            : this.buildOptions.exclude),
        ],
        entryPoints: [entry],
        outdir: path.join(this.buildDirPath, path.dirname(entry)),
        platform: 'node',
        incremental,
        plugins: this.plugins,
      };

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

      const bundlePath = entry.substr(0, entry.lastIndexOf('.')) + '.js';

      if (this.buildResults) {
        const { result } = this.buildResults.find(({ func: fn }) => fn.name === func.name);
        await result.rebuild();
        return { result, bundlePath, func, functionAlias };
      }

      const result = await build(config);

      if (config.metafile) {
        fs.writeFileSync(
          path.join(this.buildDirPath, `${trimExtension(entry)}-meta.json`),
          JSON.stringify(result.metafile, null, 2)
        );
      }

      return { result, bundlePath, func, functionAlias };
    };
    this.serverless.cli.log(
      `Compiling with concurrency: ${this.buildOptions.concurrency ?? 'Infinity'}`
    );
    this.buildResults = await pMap(this.rootFileNames, bundleMapper, {
      concurrency: this.buildOptions.concurrency,
    });
    this.serverless.cli.log('Compiling completed.');
    return this.buildResults.map((r) => r.result);
  }

  /** Link or copy extras such as node_modules or package.patterns definitions */
  async copyExtras() {
    const { service } = this.serverless;

    // include any "extras" from the "patterns" section
    if (service.package.patterns.length > 0) {
      const files = await globby(service.package.patterns);

      for (const filename of files) {
        const destFileName = path.resolve(path.join(this.buildDirPath, filename));
        const dirname = path.dirname(destFileName);

        if (!fs.existsSync(dirname)) {
          fs.mkdirpSync(dirname);
        }

        if (!fs.existsSync(destFileName)) {
          fs.copySync(path.resolve(filename), destFileName);
        }
      }
    }

    // include any "extras" from the individual function "patterns" section
    for (const fnName in this.functions) {
      const fn = this.serverless.service.getFunction(fnName);
      if (fn.package.patterns.length === 0) {
        continue;
      }
      const files = await globby(fn.package.patterns);
      for (const filename of files) {
        const destFileName = path.resolve(
          path.join(this.buildDirPath, `__only_${fn.name}`, filename)
        );
        const dirname = path.dirname(destFileName);

        if (!fs.existsSync(dirname)) {
          fs.mkdirpSync(dirname);
        }

        if (!fs.existsSync(destFileName)) {
          fs.copySync(path.resolve(filename), destFileName);
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
      path.join(this.serviceDirPath, SERVERLESS_FOLDER)
    );

    if (this.options.function) {
      const fn = service.getFunction(this.options.function);
      fn.package.artifact = path.join(
        this.serviceDirPath,
        SERVERLESS_FOLDER,
        path.basename(fn.package.artifact)
      );
      return;
    }

    if (service.package.individually) {
      const functionNames = service.getAllFunctions();
      functionNames.forEach((name) => {
        service.getFunction(name).package.artifact = path.join(
          this.serviceDirPath,
          SERVERLESS_FOLDER,
          path.basename(service.getFunction(name).package.artifact)
        );
      });
      return;
    }

    service.package.artifact = path.join(
      this.serviceDirPath,
      SERVERLESS_FOLDER,
      path.basename(service.package.artifact)
    );
  }

  async cleanup(): Promise<void> {
    await this.moveArtifacts();
    // Remove temp build folder
    if (!this.buildOptions.keepOutputDirectory) {
      fs.removeSync(path.join(this.workDirPath));
    }
  }
}

module.exports = EsbuildServerlessPlugin;

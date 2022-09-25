import fs from 'fs-extra';
import globby from 'globby';
import path from 'path';
import { concat, mergeRight } from 'ramda';
import Serverless from 'serverless';
import ServerlessPlugin from 'serverless/classes/Plugin';
import chokidar from 'chokidar';
import anymatch from 'anymatch';

import { buildServerlessV3LoggerFromLegacyLogger, extractFunctionEntries, providerRuntimeMatcher } from './helper';
import { packExternalModules } from './pack-externals';
import { pack } from './pack';
import { preOffline } from './pre-offline';
import { preLocal } from './pre-local';
import { bundle } from './bundle';
import { BUILD_FOLDER, ONLY_PREFIX, SERVERLESS_FOLDER, WORK_FOLDER } from './constants';
import { Configuration, FileBuildResult, FunctionBuildResult, Plugins, ReturnPluginsFn, ConfigFn } from './types';

function updateFile(op: string, src: string, dest: string) {
  if (['add', 'change', 'addDir'].includes(op)) {
    fs.copySync(src, dest, {
      dereference: true,
      errorOnExist: false,
      preserveTimestamps: true,
      recursive: true,
    });
    return;
  }

  if (['unlink', 'unlinkDir'].includes(op)) {
    fs.removeSync(dest);
  }
}

class EsbuildServerlessPlugin implements ServerlessPlugin {
  serviceDirPath: string;
  outputWorkFolder: string;
  workDirPath: string;
  outputBuildFolder: string;
  buildDirPath: string;
  log: ServerlessPlugin.Logging['log'];

  serverless: Serverless;
  options: Serverless.Options;
  hooks: ServerlessPlugin.Hooks;
  buildOptions: Configuration;
  buildResults: FunctionBuildResult[];
  /** Used for storing previous esbuild build results so we can rebuild more efficiently */
  buildCache: Record<string, FileBuildResult>;
  bundle: (incremental?: boolean) => Promise<void>;
  packExternalModules: () => Promise<void>;
  pack: () => Promise<void>;
  preOffline: () => Promise<void>;
  preLocal: () => void;

  constructor(serverless: Serverless, options: Serverless.Options, logging?: ServerlessPlugin.Logging) {
    this.serverless = serverless;
    this.options = options;
    this.log = logging?.log || buildServerlessV3LoggerFromLegacyLogger(this.serverless.cli, this.options.verbose);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore old versions use servicePath, new versions serviceDir. Types will use only one of them
    this.serviceDirPath = this.serverless.config.serviceDir || this.serverless.config.servicePath;
    this.packExternalModules = packExternalModules.bind(this);
    this.pack = pack.bind(this);
    this.preOffline = preOffline.bind(this);
    this.preLocal = preLocal.bind(this);
    this.bundle = bundle.bind(this);

    this.hooks = {
      initialize: () => this.init(),
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

  private init() {
    this.buildOptions = this.getBuildOptions();

    this.outputWorkFolder = this.buildOptions.outputWorkFolder || WORK_FOLDER;
    this.outputBuildFolder = this.buildOptions.outputBuildFolder || BUILD_FOLDER;
    this.workDirPath = path.join(this.serviceDirPath, this.outputWorkFolder);
    this.buildDirPath = path.join(this.workDirPath, this.outputBuildFolder);
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
    const functions = this.options.function
      ? {
          [this.options.function]: this.serverless.service.getFunction(this.options.function),
        }
      : this.serverless.service.functions;

    // ignore all functions with a different runtime than nodejs:
    const nodeFunctions: Record<string, Serverless.FunctionDefinitionHandler> = {};
    for (const [functionAlias, fn] of Object.entries(functions)) {
      if (this.isFunctionDefinitionHandler(fn) && this.isNodeFunction(fn)) {
        nodeFunctions[functionAlias] = fn;
      }
    }
    return nodeFunctions;
  }

  get plugins(): Plugins {
    if (!this.buildOptions.plugins) return;

    if (Array.isArray(this.buildOptions.plugins)) {
      return this.buildOptions.plugins;
    }

    const plugins: Plugins | ReturnPluginsFn = require(path.join(
      this.serviceDirPath,
      this.buildOptions.plugins as string
    ));

    if (typeof plugins === 'function') {
      return plugins(this.serverless);
    }

    return plugins;
  }

  get packagePatterns() {
    const { service } = this.serverless;
    const patterns = [];
    const ignored = [];

    for (const pattern of service.package.patterns) {
      if (pattern.startsWith('!')) {
        ignored.push(pattern.slice(1));
      } else {
        patterns.push(pattern);
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const [_, fn] of Object.entries(this.functions)) {
      if (fn.package.patterns.length === 0) {
        continue;
      }

      for (const pattern of fn.package.patterns) {
        if (pattern.startsWith('!')) {
          ignored.push(pattern.slice(1));
        } else {
          patterns.push(pattern);
        }
      }
    }

    return { patterns, ignored };
  }

  private getBuildOptions() {
    const DEFAULT_BUILD_OPTIONS: Partial<Configuration> = {
      concurrency: Infinity,
      bundle: true,
      target: 'node12',
      external: [],
      exclude: ['aws-sdk'],
      nativeZip: false,
      packager: 'npm',
      installExtraArgs: [],
      watch: {
        pattern: './**/*.(js|ts)',
        ignore: [WORK_FOLDER, 'dist', 'node_modules', BUILD_FOLDER],
      },
      keepOutputDirectory: false,
      packagerOptions: {},
      platform: 'node',
      outputFileExtension: '.js',
    };

    const runtimeMatcher = providerRuntimeMatcher[this.serverless.service.provider.name];
    const target = runtimeMatcher?.[this.serverless.service.provider.runtime];
    const resolvedOptions = {
      ...(target ? { target } : {}),
    };
    const withDefaultOptions = mergeRight(DEFAULT_BUILD_OPTIONS);
    const withResolvedOptions = mergeRight(withDefaultOptions(resolvedOptions));

    const configPath = this.serverless.service.custom?.esbuild?.config;
    let config: ConfigFn;
    if (configPath) {
      config = require(path.join(this.serviceDirPath, configPath));
    }
    return withResolvedOptions<Configuration>(
      config ? config(this.serverless) : this.serverless.service.custom?.esbuild ?? {}
    );
  }

  get functionEntries() {
    return extractFunctionEntries(this.serviceDirPath, this.serverless.service.provider.name, this.functions);
  }

  async watch(): Promise<void> {
    let defaultPatterns = this.buildOptions.watch.pattern;

    const options = {
      ignored: this.buildOptions.watch.ignore || [],
      awaitWriteFinish: true,
      ignoreInitial: true,
    };

    if (!Array.isArray(defaultPatterns)) {
      defaultPatterns = [defaultPatterns];
    }

    if (!Array.isArray(options.ignored)) {
      options.ignored = [options.ignored];
    }

    const { patterns, ignored } = this.packagePatterns;
    defaultPatterns = [...defaultPatterns, ...patterns];
    options.ignored = [...options.ignored, ...ignored];
    chokidar.watch(defaultPatterns, options).on('all', (eventName, srcPath) =>
      this.bundle(true)
        .then(() => this.updateFile(eventName, srcPath))
        .then(() => this.log.verbose('Watching files for changes...'))
        .catch(() => this.log.error('Bundle error, waiting for a file change to reload...'))
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

    for (const fn of Object.values(this.functions)) {
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

  async updateFile(op: string, filename: string) {
    const { service } = this.serverless;

    if (
      service.package.patterns.length > 0 &&
      anymatch(
        service.package.patterns.filter((p) => !p.startsWith('!')),
        filename
      )
    ) {
      const destFileName = path.resolve(path.join(this.buildDirPath, filename));
      updateFile(op, path.resolve(filename), destFileName);
      return;
    }

    for (const [functionAlias, fn] of Object.entries(this.functions)) {
      if (fn.package.patterns.length === 0) {
        continue;
      }

      if (
        anymatch(
          fn.package.patterns.filter((p) => !p.startsWith('!')),
          filename
        )
      ) {
        const destFileName = path.resolve(path.join(this.buildDirPath, `${ONLY_PREFIX}${functionAlias}`, filename));
        updateFile(op, path.resolve(filename), destFileName);
        return;
      }
    }
  }

  /** Link or copy extras such as node_modules or package.patterns definitions */
  async copyExtras() {
    const { service } = this.serverless;

    // include any "extras" from the "patterns" section
    if (service.package.patterns.length > 0) {
      const files = await globby(service.package.patterns);

      for (const filename of files) {
        const destFileName = path.resolve(path.join(this.buildDirPath, filename));
        updateFile('add', path.resolve(filename), destFileName);
      }
    }

    // include any "extras" from the individual function "patterns" section
    for (const [functionAlias, fn] of Object.entries(this.functions)) {
      if (fn.package.patterns.length === 0) {
        continue;
      }
      const files = await globby(fn.package.patterns);
      for (const filename of files) {
        const destFileName = path.resolve(path.join(this.buildDirPath, `${ONLY_PREFIX}${functionAlias}`, filename));
        updateFile('add', path.resolve(filename), destFileName);
      }
    }
  }

  /**
   * Move built code to the serverless folder, taking into account individual
   * packaging preferences.
   */
  async moveArtifacts(): Promise<void> {
    const { service } = this.serverless;

    await fs.copy(path.join(this.workDirPath, SERVERLESS_FOLDER), path.join(this.serviceDirPath, SERVERLESS_FOLDER));

    if (service.package.individually || this.options.function) {
      Object.values(this.functions).forEach((func) => {
        func.package.artifact = path.join(SERVERLESS_FOLDER, path.basename(func.package.artifact));
      });
      return;
    }

    service.package.artifact = path.join(SERVERLESS_FOLDER, path.basename(service.package.artifact));
  }

  async cleanup(): Promise<void> {
    await this.moveArtifacts();
    // Remove temp build folder
    if (!this.buildOptions.keepOutputDirectory) {
      fs.removeSync(path.join(this.workDirPath));
    }
  }
}

export = EsbuildServerlessPlugin;

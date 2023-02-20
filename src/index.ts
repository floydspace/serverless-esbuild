import assert from 'assert';
import path from 'path';

import fs from 'fs-extra';
import globby from 'globby';

import { concat, mergeDeepRight } from 'ramda';
import type Serverless from 'serverless';
import type ServerlessPlugin from 'serverless/classes/Plugin';
import chokidar from 'chokidar';
import anymatch from 'anymatch';

import {
  asArray,
  assertIsString,
  assertIsSupportedRuntime,
  buildServerlessV3LoggerFromLegacyLogger,
  extractFunctionEntries,
  isNodeMatcherKey,
  isString,
  providerRuntimeMatcher,
} from './helper';
import { packExternalModules } from './pack-externals';
import { pack } from './pack';
import { preOffline } from './pre-offline';
import { preLocal } from './pre-local';
import { bundle } from './bundle';
import { BUILD_FOLDER, ONLY_PREFIX, SERVERLESS_FOLDER, WORK_FOLDER } from './constants';
import type {
  ConfigFn,
  Configuration,
  EsbuildFunctionDefinitionHandler,
  FileBuildResult,
  FunctionBuildResult,
  Plugins,
  ReturnPluginsFn,
} from './types';

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

  outputWorkFolder: string | undefined;

  workDirPath: string | undefined;

  outputBuildFolder: string | undefined;

  buildDirPath: string | undefined;

  log: ServerlessPlugin.Logging['log'];

  serverless: Serverless;

  options: Serverless.Options;

  hooks: ServerlessPlugin.Hooks;

  buildOptions: Configuration | undefined;

  buildResults: FunctionBuildResult[] | undefined;

  /** Used for storing previous esbuild build results so we can rebuild more efficiently */
  buildCache: Record<string, FileBuildResult> = {};

  // These are bound to imported functions.
  packExternalModules: typeof packExternalModules;

  pack: typeof pack;

  preOffline: typeof preOffline;

  preLocal: typeof preLocal;

  bundle: typeof bundle;

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

    // This tells serverless that this skipEsbuild property can exist in a function definition, but isn't required.
    // That way a user could skip a function if they have defined their own artifact, for example.
    this.serverless.configSchemaHandler.defineFunctionProperties(this.serverless.service.provider.name, {
      properties: {
        skipEsbuild: { type: 'boolean' },
      },
    });

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

    return isNodeMatcherKey(runtime) && typeof runtimeMatcher?.[runtime] === 'string';
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
      if (
        this.isFunctionDefinitionHandler(fn) &&
        this.isNodeFunction(fn) &&
        !(fn as EsbuildFunctionDefinitionHandler).skipEsbuild
      ) {
        nodeFunctions[functionAlias] = fn;
      }
    }

    return nodeFunctions;
  }

  get plugins(): Plugins {
    if (!this.buildOptions?.plugins) {
      return [];
    }

    if (Array.isArray(this.buildOptions.plugins)) {
      return this.buildOptions.plugins;
    }

    const plugins: Plugins | ReturnPluginsFn = require(path.join(this.serviceDirPath, this.buildOptions.plugins));

    if (typeof plugins === 'function') {
      return plugins(this.serverless);
    }

    return plugins;
  }

  get packagePatterns() {
    const { service } = this.serverless;
    const patterns: string[] = [];
    const ignored: string[] = [];

    for (const pattern of service.package.patterns) {
      if (pattern.startsWith('!')) {
        ignored.push(pattern.slice(1));
      } else {
        patterns.push(pattern);
      }
    }

    for (const fn of Object.values(this.functions)) {
      const fnPatterns = asArray(fn.package?.patterns).filter(isString);

      for (const pattern of fnPatterns) {
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
      packagerOptions: {
        noInstall: false,
      },
      installExtraArgs: [],
      watch: {
        pattern: './**/*.(js|ts)',
        ignore: [WORK_FOLDER, 'dist', 'node_modules', BUILD_FOLDER],
        chokidar: {
          ignoreInitial: true,
        },
      },
      keepOutputDirectory: false,
      platform: 'node',
      outputFileExtension: '.js',
    };

    const providerRuntime = this.serverless.service.provider.runtime;

    assertIsSupportedRuntime(providerRuntime);

    const runtimeMatcher = providerRuntimeMatcher[this.serverless.service.provider.name];
    const target = isNodeMatcherKey(providerRuntime) ? runtimeMatcher?.[providerRuntime] : undefined;

    const resolvedOptions = {
      ...(target ? { target } : {}),
    };
    const withDefaultOptions = mergeDeepRight(DEFAULT_BUILD_OPTIONS);
    const withResolvedOptions = mergeDeepRight(withDefaultOptions(resolvedOptions));

    const configPath: string | undefined = this.serverless.service.custom?.esbuild?.config;

    const config: ConfigFn | undefined = configPath ? require(path.join(this.serviceDirPath, configPath)) : undefined;

    return withResolvedOptions<Configuration>(
      config ? config(this.serverless) : this.serverless.service.custom?.esbuild ?? {}
    ) as Configuration;
  }

  get functionEntries() {
    return extractFunctionEntries(this.serviceDirPath, this.serverless.service.provider.name, this.functions);
  }

  watch(): void {
    assert(this.buildOptions, 'buildOptions is not defined');

    const defaultPatterns = asArray(this.buildOptions.watch.pattern).filter(isString);
    const defaultIgnored = asArray(this.buildOptions.watch.ignore).filter(isString);

    const { patterns, ignored } = this.packagePatterns;

    const allPatterns: string[] = [...defaultPatterns, ...patterns];
    const allIgnored: string[] = [...defaultIgnored, ...ignored];

    const options = {
      ignored: allIgnored,
      ...this.buildOptions.watch.chokidar,
    };

    chokidar.watch(allPatterns, options).on('all', (eventName, srcPath) =>
      this.bundle(true)
        .then(() => this.updateFile(eventName, srcPath))
        .then(() => this.log.verbose('Watching files for changes...'))
        .catch(() => this.log.error('Bundle error, waiting for a file change to reload...'))
    );
  }

  prepare() {
    assertIsString(this.buildDirPath, 'buildDirPath is not a string');
    assertIsString(this.workDirPath, 'workDirPath is not a string');

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
    assertIsString(this.buildDirPath, 'buildDirPath is not a string');

    const { service } = this.serverless;

    const patterns = asArray(service.package.patterns).filter(isString);

    if (
      patterns.length > 0 &&
      anymatch(
        patterns.filter((pattern) => !pattern.startsWith('!')),
        filename
      )
    ) {
      const destFileName = path.resolve(path.join(this.buildDirPath, filename));

      updateFile(op, path.resolve(filename), destFileName);

      return;
    }

    for (const [functionAlias, fn] of Object.entries(this.functions)) {
      if (fn.package?.patterns?.length === 0) {
        continue;
      }

      if (
        anymatch(
          asArray(fn.package?.patterns)
            .filter(isString)
            .filter((pattern) => !pattern.startsWith('!')),
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
    assertIsString(this.buildDirPath, 'buildDirPath is not a string');

    const { service } = this.serverless;

    const packagePatterns = asArray(service.package.patterns).filter(isString);

    // include any "extras" from the "patterns" section
    if (packagePatterns.length) {
      const files = await globby(packagePatterns);

      for (const filename of files) {
        const destFileName = path.resolve(path.join(this.buildDirPath, filename));

        updateFile('add', path.resolve(filename), destFileName);
      }
    }

    // include any "extras" from the individual function "patterns" section
    for (const [functionAlias, fn] of Object.entries(this.functions)) {
      const patterns = asArray(fn.package?.patterns).filter(isString);

      if (!patterns.length) {
        continue;
      }

      const files = await globby(patterns);

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
    assertIsString(this.workDirPath, 'workDirPath is not a string');

    const { service } = this.serverless;

    await fs.copy(path.join(this.workDirPath, SERVERLESS_FOLDER), path.join(this.serviceDirPath, SERVERLESS_FOLDER));

    if (service.package.individually === true || this.options.function) {
      Object.values(this.functions).forEach((func) => {
        if (func.package?.artifact) {
          // eslint-disable-next-line no-param-reassign
          func.package.artifact = path.join(SERVERLESS_FOLDER, path.basename(func.package.artifact));
        }
      });

      return;
    }

    service.package.artifact = path.join(SERVERLESS_FOLDER, path.basename(service.package.artifact));
  }

  async cleanup(): Promise<void> {
    await this.moveArtifacts();

    // Remove temp build folder
    if (!this.buildOptions?.keepOutputDirectory) {
      assertIsString(this.workDirPath, 'workDirPath is not a string');

      fs.removeSync(path.join(this.workDirPath));
    }
  }
}

export = EsbuildServerlessPlugin;

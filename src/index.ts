import { build, BuildOptions } from 'esbuild';
import * as fs from 'fs-extra';
import * as globby from 'globby';
import * as path from 'path';
import { mergeRight } from 'ramda';
import * as Serverless from 'serverless';
import * as Plugin from 'serverless/classes/Plugin';
import * as Service from 'serverless/classes/Service';

import { extractFileNames } from './helper';
import { packExternalModules } from './packExternalModules';

const SERVERLESS_FOLDER = '.serverless';
const BUILD_FOLDER = '.build';

interface ServiceExtended extends Service {
  service?: string;
  package?: Serverless.Package;
  functions?: Record<string, Serverless.FunctionDefinition>;
}

interface OptionsExtended extends Serverless.Options {
  verbose?: boolean;
}

export interface Configuration extends BuildOptions {
  packager: 'npm' | 'yarn';
  packagePath: string;
  exclude: string[];
}

const DEFAULT_BUILD_OPTIONS: Partial<Configuration> = {
  bundle: true,
  target: 'es2017',
  external: [],
  exclude: ['aws-sdk'],
  packager: 'npm',
};

export class EsbuildPlugin implements Plugin {
  private originalServicePath: string;

  serverless: Serverless & { service: ServiceExtended };
  options: OptionsExtended;
  hooks: Plugin.Hooks;
  buildOptions: Configuration;
  packExternalModules: () => Promise<void>;

  constructor(serverless: Serverless, options: OptionsExtended) {
    this.serverless = serverless;
    this.options = options;
    this.packExternalModules = packExternalModules.bind(this);

    const withDefaultOptions = mergeRight(DEFAULT_BUILD_OPTIONS);
    this.buildOptions = withDefaultOptions<Configuration>(this.serverless.service.custom?.esbuild ?? {});

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
      },
      'before:offline:start:init': async () => {
        await this.bundle();
        await this.packExternalModules();
        await this.copyExtras();
      },
      'before:package:createDeploymentArtifacts': async () => {
        await this.bundle();
        await this.packExternalModules();
        await this.copyExtras();
      },
      'after:package:createDeploymentArtifacts': async () => {
        await this.cleanup();
      },
      'before:deploy:function:packageFunction': async () => {
        await this.bundle();
        await this.packExternalModules();
        await this.copyExtras();
      },
      'after:deploy:function:packageFunction': async () => {
        await this.cleanup();
      },
      'before:invoke:local:invoke': async () => {
        await this.bundle();
        await this.packExternalModules();
        await this.copyExtras();
      }
    };
  }

  get functions(): Record<string, Serverless.FunctionDefinition> {
    if (this.options.function) {
      return {
        [this.options.function]: this.serverless.service.getFunction(this.options.function)
      };
    }

    return this.serverless.service.functions;
  }

  get rootFileNames() {
    return extractFileNames(
      this.originalServicePath,
      this.serverless.service.provider.name,
      this.functions
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
      fn.package.exclude = [...new Set([...fn.package.exclude || [], 'node_modules/serverless-esbuild'])];
    }
  }

  async bundle(): Promise<void> {
    this.prepare();
    this.serverless.cli.log('Compiling with esbuild...');

    if (!this.originalServicePath) {
      // Save original service path and functions
      this.originalServicePath = this.serverless.config.servicePath;
      // Fake service path so that serverless will know what to zip
      this.serverless.config.servicePath = path.join(this.originalServicePath, BUILD_FOLDER);
    }

    await Promise.all(this.rootFileNames.map(entry => {
      const config: BuildOptions = {
        ...this.buildOptions,
        external: [
          ...this.buildOptions.external,
          ...this.buildOptions.exclude,
        ],
        entryPoints: [entry],
        outdir: path.join(this.originalServicePath, BUILD_FOLDER, path.dirname(entry)),
        platform: 'node',
      };

      // esbuild v0.7.0 introduced config options validation, so I have to delete plugin specific options from esbuild config.
      delete config['exclude'];
      delete config['packager'];
      delete config['packagePath'];

      return build(config);
    }));

    this.serverless.cli.log('Compiling completed.');
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

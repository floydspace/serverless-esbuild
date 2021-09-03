import * as fse from 'fs-extra';
import * as path from 'path';
import {
  compose,
  forEach,
  head,
  includes,
  is,
  isEmpty,
  join,
  keys,
  map,
  mergeRight,
  omit,
  path as get,
  pick,
  pickBy,
  replace,
  split,
  startsWith,
  tail,
  toPairs,
  uniq,
  without,
} from 'ramda';

import * as Packagers from './packagers';
import { JSONObject } from './types';
import { findProjectRoot, findUp } from './utils';

import type { EsbuildPlugin } from './index';

function rebaseFileReferences(pathToPackageRoot: string, moduleVersion: string) {
  if (/^(?:file:[^/]{2}|\.\/|\.\.\/)/.test(moduleVersion)) {
    const filePath = replace(/^file:/, '', moduleVersion);
    return replace(
      /\\/g,
      '/',
      `${startsWith('file:', moduleVersion) ? 'file:' : ''}${pathToPackageRoot}/${filePath}`
    );
  }

  return moduleVersion;
}

/**
 * Add the given modules to a package json's dependencies.
 */
function addModulesToPackageJson(
  externalModules: string[],
  packageJson: JSONObject,
  pathToPackageRoot: string
) {
  forEach(externalModule => {
    const splitModule = split('@', externalModule);
    // If we have a scoped module we have to re-add the @
    if (startsWith('@', externalModule)) {
      splitModule.splice(0, 1);
      splitModule[0] = '@' + splitModule[0];
    }
    let moduleVersion = join('@', tail(splitModule));
    // We have to rebase file references to the target package.json
    moduleVersion = rebaseFileReferences(pathToPackageRoot, moduleVersion);
    packageJson.dependencies = packageJson.dependencies || {};
    packageJson.dependencies[head(splitModule)] = moduleVersion;
  }, externalModules);
}

/**
 * Resolve the needed versions of production dependencies for external modules.
 * @this - The active plugin instance
 */
function getProdModules(
  externalModules: { external: string }[],
  packageJsonPath: string,
  rootPackageJsonPath: string
) {
  const packageJson = require(packageJsonPath);
  const prodModules = [];

  // only process the module stated in dependencies section
  if (!packageJson.dependencies) {
    return [];
  }

  // Get versions of all transient modules
  forEach(externalModule => {
    // (1) If present in Dev Dependencies
    if (
      !packageJson.dependencies[externalModule.external] &&
      packageJson.devDependencies[externalModule.external]
    ) {
      // To minimize the chance of breaking setups we whitelist packages available on AWS here. These are due to the previously missing check
      // most likely set in devDependencies and should not lead to an error now.
      const ignoredDevDependencies = ['aws-sdk'];

      if (!includes(externalModule.external, ignoredDevDependencies)) {
        // Runtime dependency found in devDependencies but not forcefully excluded
        this.serverless.cli.log(
          `ERROR: Runtime dependency '${externalModule.external}' found in devDependencies.`
        );
        throw new this.serverless.classes.Error(
          `Serverless-webpack dependency error: ${externalModule.external}.`
        );
      }

      this.options.verbose &&
        this.serverless.cli.log(
          `INFO: Runtime dependency '${externalModule.external}' found in devDependencies. It has been excluded automatically.`
        );
    } else {
      // (2) otherwise let's get the version

      // get module package - either from root or local node_modules - will be used for version and peer deps
      const rootModulePackagePath = path.join(
        path.dirname(rootPackageJsonPath),
        'node_modules',
        externalModule.external,
        'package.json'
      );
      const localModulePackagePath = path.join(
        path.dirname(packageJsonPath),
        'node_modules',
        externalModule.external,
        'package.json'
      );
      const modulePackagePath = fse.pathExistsSync(localModulePackagePath)
        ? localModulePackagePath
        : fse.pathExistsSync(rootModulePackagePath)
        ? rootModulePackagePath
        : null;
      const modulePackage = modulePackagePath ? require(modulePackagePath) : {};

      // Get version
      const moduleVersion =
        packageJson.dependencies[externalModule.external] || modulePackage.version;

      // add dep with version if we have it - versionless otherwise
      if (moduleVersion) prodModules.push(`${externalModule.external}@${moduleVersion}`);
      else prodModules.push(externalModule.external);

      // Check if the module has any peer dependencies and include them too
      try {
        // find peer dependencies but remove optional ones and excluded ones
        const peerDependencies = modulePackage.peerDependencies as Record<string, string>;
        const optionalPeerDependencies = Object.keys(
          pickBy(val => val.optional, modulePackage.peerDependenciesMeta || {})
        );
        const peerDependenciesWithoutOptionals = omit(
          [...optionalPeerDependencies, ...this.buildOptions.exclude],
          peerDependencies
        );

        if (!isEmpty(peerDependenciesWithoutOptionals)) {
          this.options.verbose &&
            this.serverless.cli.log(
              `Adding explicit non-optionals peers for dependency ${externalModule.external}`
            );
          const peerModules = getProdModules.call(
            this,
            compose(
              map(([external]) => ({ external })),
              toPairs
            )(peerDependenciesWithoutOptionals),
            packageJsonPath,
            rootPackageJsonPath
          );
          Array.prototype.push.apply(prodModules, peerModules);
        }
      } catch (e) {
        this.serverless.cli.log(
          `WARNING: Could not check for peer dependencies of ${externalModule.external}`
        );
      }
    }
  }, externalModules);

  return prodModules;
}

/**
 * We need a performant algorithm to install the packages for each single
 * function (in case we package individually).
 * (1) We fetch ALL packages needed by ALL functions in a first step
 * and use this as a base npm checkout. The checkout will be done to a
 * separate temporary directory with a package.json that contains everything.
 * (2) For each single compile we copy the whole node_modules to the compile
 * directory and create a (function) compile specific package.json and store
 * it in the compile directory. Now we start npm again there, and npm will just
 * remove the superfluous packages and optimize the remaining dependencies.
 * This will utilize the npm cache at its best and give us the needed results
 * and performance.
 */
export async function packExternalModules(this: EsbuildPlugin) {
  if (this.buildOptions.plugins) {
    const plugins = require(path.join(this.serviceDirPath, this.buildOptions.plugins));
    if (
      plugins &&
      plugins.map(plugin => plugin.name).includes('node-externals') &&
      fse.existsSync(path.resolve(__dirname, '../../esbuild-node-externals/dist/utils.js'))
    ) {
      const { findDependencies, findPackagePaths } = require('esbuild-node-externals/dist/utils');
      this.buildOptions.external = findDependencies({
        dependencies: true,
        packagePaths: findPackagePaths(),
        allowList: [],
      });
    }
  }

  const externals = without(this.buildOptions.exclude, this.buildOptions.external);

  if (!externals || !externals.length) {
    return;
  }

  // Read plugin configuration
  // get the root package.json by looking up until we hit a lockfile
  // if this is a yarn workspace, it will be the monorepo package.json
  const rootPackageJsonPath = path.join(findProjectRoot() || '', './package.json');

  // get the local package.json by looking up until we hit a package.json file
  // if this is *not* a yarn workspace, it will be the same as rootPackageJsonPath
  const packageJsonPath =
    this.buildOptions.packagePath || path.join(findUp('package.json'), './package.json');

  // Determine and create packager
  const packager = await Packagers.get(this.buildOptions.packager);

  // Fetch needed original package.json sections
  const sectionNames = packager.copyPackageSectionNames;

  // Get scripts from packager options
  const packagerScripts = this.buildOptions.packagerOptions
    ? []
        .concat(this.buildOptions.packagerOptions.scripts || [])
        .reduce((scripts, script, index) => {
          scripts[`script${index}`] = script;
          return scripts;
        }, {})
    : {};

  const rootPackageJson: Record<string, any> =
    this.serverless.utils.readFileSync(rootPackageJsonPath);

  const isWorkspace = !!rootPackageJson.workspaces;

  const packageJson: Record<string, any> = isWorkspace
    ? this.serverless.utils.readFileSync(packageJsonPath)
    : rootPackageJson;

  const packageSections = pick(sectionNames, packageJson);

  if (!isEmpty(packageSections)) {
    this.options.verbose &&
      this.serverless.cli.log(`Using package.json sections ${join(', ', keys(packageSections))}`);
  }

  // Get first level dependency graph
  this.options.verbose && this.serverless.cli.log(`Fetch dependency graph from ${packageJson}`);

  // (1) Generate dependency composition
  const externalModules = map(external => ({ external }), externals);
  const compositeModules: JSONObject = uniq(
    getProdModules.call(this, externalModules, packageJsonPath, rootPackageJsonPath)
  );

  if (isEmpty(compositeModules)) {
    // The compiled code does not reference any external modules at all
    this.serverless.cli.log('No external modules needed');
    return;
  }

  // (1.a) Install all needed modules
  const compositeModulePath = this.buildDirPath;
  const compositePackageJson = path.join(compositeModulePath, 'package.json');

  // (1.a.1) Create a package.json
  const compositePackage = mergeRight(
    {
      name: this.serverless.service.service,
      version: '1.0.0',
      description: `Packaged externals for ${this.serverless.service.service}`,
      private: true,
      scripts: packagerScripts,
    },
    packageSections
  );
  const relativePath = path.relative(compositeModulePath, path.dirname(packageJsonPath));
  addModulesToPackageJson(compositeModules, compositePackage, relativePath);
  this.serverless.utils.writeFileSync(
    compositePackageJson,
    JSON.stringify(compositePackage, null, 2)
  );

  // (1.a.2) Copy package-lock.json if it exists, to prevent unwanted upgrades
  const packageLockPath = path.join(path.dirname(rootPackageJsonPath), packager.lockfileName);
  const exists = await fse.pathExists(packageLockPath);
  if (exists) {
    this.serverless.cli.log('Package lock found - Using locked versions');
    try {
      let packageLockFile = this.serverless.utils.readFileSync(packageLockPath);
      packageLockFile = packager.rebaseLockfile(relativePath, packageLockFile);
      if (is(Object)(packageLockFile)) {
        packageLockFile = JSON.stringify(packageLockFile, null, 2);
      }

      this.serverless.utils.writeFileSync(
        path.join(compositeModulePath, packager.lockfileName),
        packageLockFile as string
      );
    } catch (err) {
      this.serverless.cli.log(`Warning: Could not read lock file: ${err.message}`);
    }
  }

  // GOOGLE: Copy modules only if not google-cloud-functions
  // GCF Auto installs the package json
  if (get(['service', 'provider', 'name'], this.serverless) === 'google') {
    return;
  }

  const start = Date.now();
  this.serverless.cli.log('Packing external modules: ' + compositeModules.join(', '));
  await packager.install(compositeModulePath, exists);
  this.options.verbose && this.serverless.cli.log(`Package took [${Date.now() - start} ms]`);

  // Prune extraneous packages - removes not needed ones
  const startPrune = Date.now();
  await packager.prune(compositeModulePath);
  this.options.verbose &&
    this.serverless.cli.log(`Prune: ${compositeModulePath} [${Date.now() - startPrune} ms]`);

  // Run packager scripts
  if (Object.keys(packagerScripts).length > 0) {
    const startScripts = Date.now();
    await packager.runScripts(this.buildDirPath, Object.keys(packagerScripts));
    this.options.verbose &&
      this.serverless.cli.log(
        `Packager scripts took [${
          Date.now() - startScripts
        } ms].\nExecuted scripts: ${Object.values(packagerScripts).map(script => `\n  ${script}`)}`
      );
  }
}

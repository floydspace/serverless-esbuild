import * as fse from 'fs-extra';
import * as now from 'lodash.now';
import * as remove from 'lodash.remove';
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
  length,
  map,
  mergeRight,
  path as get,
  pathOr,
  pick,
  prop,
  propOr,
  replace,
  split,
  startsWith,
  tail,
  toPairs,
  uniq,
} from 'ramda';

import * as Packagers from './packagers';

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
function addModulesToPackageJson(externalModules: string[], packageJson: any, pathToPackageRoot: string) {
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
 * Remove a given list of excluded modules from a module list
 * @this - The active plugin instance
 */
function removeExcludedModules(modules: string[], packageForceExcludes: string[], log?) {
  const excludedModules = remove(modules, externalModule => {
    const splitModule = split('@', externalModule);
    // If we have a scoped module we have to re-add the @
    if (startsWith('@', externalModule)) {
      splitModule.splice(0, 1);
      splitModule[0] = '@' + splitModule[0];
    }
    const moduleName = head(splitModule);
    return includes(moduleName, packageForceExcludes);
  });

  if (log && !isEmpty(excludedModules)) {
    this.serverless.cli.log(`Excluding external modules: ${join(', ', excludedModules)}`);
  }
}

/**
 * Resolve the needed versions of production dependencies for external modules.
 * @this - The active plugin instance
 */
function getProdModules(externalModules: { external: string; origin?}[], packagePath: string, dependencyGraph, forceExcludes) {
  const packageJsonPath = path.join(process.cwd(), packagePath);
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const packageJson = require(packageJsonPath);
  const prodModules = [];

  // only process the module stated in dependencies section
  if (!packageJson.dependencies) {
    return [];
  }

  // Get versions of all transient modules
  forEach(module => {
    let moduleVersion = packageJson.dependencies[module.external];

    if (moduleVersion) {
      prodModules.push(`${module.external}@${moduleVersion}`);

      // Check if the module has any peer dependencies and include them too
      try {
        const modulePackagePath = path.join(
          path.dirname(path.join(process.cwd(), packagePath)),
          'node_modules',
          module.external,
          'package.json'
        );
        const peerDependencies = require(modulePackagePath).peerDependencies as Record<string, string>;
        if (!isEmpty(peerDependencies)) {
          this.options.verbose && this.serverless.cli.log(`Adding explicit peers for dependency ${module.external}`);
          const peerModules = getProdModules.call(this,
            compose(map(([external]) => ({ external })), toPairs)(peerDependencies),
            packagePath,
            dependencyGraph,
            forceExcludes
          );
          Array.prototype.push.apply(prodModules, peerModules);
        }
      } catch (e) {
        this.serverless.cli.log(`WARNING: Could not check for peer dependencies of ${module.external}`);
      }
    } else {
      if (!packageJson.devDependencies || !packageJson.devDependencies[module.external]) {
        // Add transient dependencies if they appear not in the service's dev dependencies
        const originInfo = pathOr({}, ['dependencies'], dependencyGraph)[module.origin] || {};
        moduleVersion = prop('version', pathOr({}, ['dependencies'], originInfo)[module.external]);
        if (!moduleVersion) {
          this.serverless.cli.log(`WARNING: Could not determine version of module ${module.external}`);
        }
        prodModules.push(moduleVersion ? `${module.external}@${moduleVersion}` : module.external);
      } else if (
        packageJson.devDependencies &&
        packageJson.devDependencies[module.external] &&
        !includes(module.external, forceExcludes)
      ) {
        // To minimize the chance of breaking setups we whitelist packages available on AWS here. These are due to the previously missing check
        // most likely set in devDependencies and should not lead to an error now.
        const ignoredDevDependencies = ['aws-sdk'];

        if (!includes(module.external, ignoredDevDependencies)) {
          // Runtime dependency found in devDependencies but not forcefully excluded
          this.serverless.cli.log(
            `ERROR: Runtime dependency '${module.external}' found in devDependencies. Move it to dependencies or use forceExclude to explicitly exclude it.`
          );
          throw new this.serverless.classes.Error(`Serverless-webpack dependency error: ${module.external}.`);
        }

        this.options.verbose &&
          this.serverless.cli.log(
            `INFO: Runtime dependency '${module.external}' found in devDependencies. It has been excluded automatically.`
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
export async function packExternalModules() {
  const stats = this.compileStats;

  const includes = this.configuration.external;

  if (!includes) {
    return;
  }

  // Read plugin configuration
  const packageForceIncludes = this.configuration.external;
  const packagePath = './package.json';
  const packageJsonPath = path.join(process.cwd(), packagePath);
  const packageScripts = (this.configuration.packagerOptions.scripts || []).reduce(
    (__, script, index) => {
      __[`script${index}`] = script;
      return __;
    },
    {},
  );

  // Determine and create packager
  const packager = await Packagers.get(this.configuration.packager);

  // Fetch needed original package.json sections
  const sectionNames = packager.copyPackageSectionNames;
  const packageJson = this.serverless.utils.readFileSync(packageJsonPath);
  const packageSections = pick(sectionNames, packageJson);
  if (!isEmpty(packageSections)) {
    this.options.verbose &&
      this.serverless.cli.log(`Using package.json sections ${join(', ', keys(packageSections))}`);
  }

  // Get first level dependency graph
  this.options.verbose && this.serverless.cli.log(`Fetch dependency graph from ${packageJsonPath}`);

  const dependencyGraph = await packager.getProdDependencies(path.dirname(packageJsonPath), 1);
  const problems: any[] = propOr([], 'problems', dependencyGraph);
  if (this.options.verbose && !isEmpty(problems)) {
    this.serverless.cli.log(`Ignoring ${length(problems)} NPM errors:`);
    forEach(problem => this.serverless.cli.log(`=> ${problem}`), problems);
  }

  // (1) Generate dependency composition
  const externalModules = map(whitelistedPackage => ({
    external: whitelistedPackage
  }), packageForceIncludes);
  const compositeModules: any = uniq(getProdModules.call(this, externalModules, packagePath, dependencyGraph, []));
  removeExcludedModules.call(this, compositeModules, [], true);

  if (isEmpty(compositeModules)) {
    // The compiled code does not reference any external modules at all
    this.serverless.cli.log('No external modules needed');
    return Promise.resolve();
  }

  // (1.a) Install all needed modules
  const compositeModulePath = path.join(this.webpackOutputPath, 'dependencies');
  const compositePackageJson = path.join(compositeModulePath, 'package.json');

  // (1.a.1) Create a package.json
  const compositePackage = mergeRight(
    {
      name: this.serverless.service.service,
      version: '1.0.0',
      description: `Packaged externals for ${this.serverless.service.service}`,
      private: true,
      scripts: packageScripts
    },
    packageSections
  );
  const relPath = path.relative(compositeModulePath, path.dirname(packageJsonPath));
  addModulesToPackageJson(compositeModules, compositePackage, relPath);
  this.serverless.utils.writeFileSync(compositePackageJson, JSON.stringify(compositePackage, null, 2));

  // (1.a.2) Copy package-lock.json if it exists, to prevent unwanted upgrades
  const packageLockPath = path.join(path.dirname(packageJsonPath), packager.lockfileName);
  let hasPackageLock = false;
  const exists = await fse.pathExists(packageLockPath);
  if (exists) {
    this.serverless.cli.log('Package lock found - Using locked versions');
    try {
      let packageLockFile = this.serverless.utils.readFileSync(packageLockPath);
      packageLockFile = packager.rebaseLockfile(relPath, packageLockFile);
      if (is(Object)(packageLockFile)) {
        packageLockFile = JSON.stringify(packageLockFile, null, 2);
      }

      this.serverless.utils.writeFileSync(
        path.join(compositeModulePath, packager.lockfileName),
        packageLockFile
      );
      hasPackageLock = true;
    } catch (err) {
      this.serverless.cli.log(`Warning: Could not read lock file: ${err.message}`);
    }
  }

  const start = now();
  this.serverless.cli.log('Packing external modules: ' + compositeModules.join(', '));
  await packager.install(compositeModulePath, this.configuration.packagerOptions);
  this.options.verbose && this.serverless.cli.log(`Package took [${now() - start} ms]`);

  await Promise.all(stats.stats.map(async compileStats => {
    const modulePath = compileStats.compilation.compiler.outputPath;

    // Create package.json
    const modulePackageJson = path.join(modulePath, 'package.json');
    const modulePackage = mergeRight(
      {
        name: this.serverless.service.service,
        version: '1.0.0',
        description: `Packaged externals for ${this.serverless.service.service}`,
        private: true,
        scripts: packageScripts,
        dependencies: {}
      },
      packageSections
    );
    const prodModules = getProdModules.call(this,
      map(whitelistedPackage => ({
        external: whitelistedPackage
      }), packageForceIncludes),
      packagePath,
      dependencyGraph,
      []
    );
    removeExcludedModules.call(this, prodModules, []);
    const relPath = path.relative(modulePath, path.dirname(packageJsonPath));
    addModulesToPackageJson(prodModules, modulePackage, relPath);
    this.serverless.utils.writeFileSync(modulePackageJson, JSON.stringify(modulePackage, null, 2));

    // GOOGLE: Copy modules only if not google-cloud-functions
    //         GCF Auto installs the package json
    if (get(['service', 'provider', 'name'], this.serverless) === 'google') {
      return;
    }

    const startCopy = now();

    // Only copy dependency modules if demanded by packager
    if (packager.mustCopyModules) {
      await fse.copy(
        path.join(compositeModulePath, 'node_modules'),
        path.join(modulePath, 'node_modules'),
      );
    }

    if (hasPackageLock) {
      await fse.copy(
        path.join(compositeModulePath, packager.lockfileName),
        path.join(modulePath, packager.lockfileName),
      );
    }

    this.options.verbose &&
      this.serverless.cli.log(`Copy modules: ${modulePath} [${now() - startCopy} ms]`);

    // Prune extraneous packages - removes not needed ones
    const startPrune = now();
    await packager.prune(modulePath, this.configuration.packagerOptions);
    this.options.verbose &&
      this.serverless.cli.log(`Prune: ${modulePath} [${now() - startPrune} ms]`);
    // Prune extraneous packages - removes not needed ones
    const startRunScripts = now();
    await packager.runScripts(modulePath, keys(packageScripts));
    this.options.verbose &&
      this.serverless.cli.log(`Run scripts: ${modulePath} [${now() - startRunScripts} ms]`);
  }));
}

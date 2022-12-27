import { any, isEmpty, replace, split, startsWith, takeWhile } from 'ramda';
import * as path from 'path';

import type { DependenciesResult, DependencyMap, JSONObject } from '../types';
import { SpawnError, spawnProcess } from '../utils';
import type { Packager } from './packager';
import { isString } from '../helper';

type NpmV7Map = Record<string, NpmV7Tree>;

export interface NpmV7Tree {
  version: string;
  resolved: string;
  name: string;
  integrity: string;
  _id: string;
  extraneous: boolean;
  path: string;
  _dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  peerDependencies: Record<string, string>;
  dependencies?: NpmV7Map;
}

export interface NpmV7Deps {
  version: string;
  name: string;
  description: string;
  private: boolean;
  scripts: Record<string, string>;
  _id: string;
  extraneous: boolean;
  path: string;
  _dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  peerDependencies: Record<string, string>;
  dependencies: NpmV7Map;
}

export type NpmV6Map = Record<string, NpmV6Tree>;

export interface NpmV6Tree {
  _args: string[][] | string;
  _from: string;
  _id: string;
  _integrity: string;
  _location: string;
  _phantomChildren: Record<string, string> | string;
  _requested: Record<string, unknown>;
  _requiredBy: string[] | string;
  _resolved: string;
  _spec: string;
  _where: string;
  author: string;
  license: string;
  main: string;
  name: string;
  scripts: Record<string, string> | string;
  version: string;
  readme: string;
  dependencies: NpmV6Map;
  devDependencies: Record<string, string> | string;
  optionalDependencies: Record<string, string> | string;
  _dependencies: Record<string, string> | string;
  path: string;
  error: string | Error;
  extraneous: boolean;
  _deduped?: string;
}

export interface NpmV6Deps {
  name: string;
  version: string;
  description: string;
  private: boolean;
  scripts: Record<string, string>;
  dependencies?: NpmV6Map;
  readme?: string;
  _id: string;
  _shrinkwrap: Record<string, unknown>;
  devDependencies: Record<string, string>;
  optionalDependencies: Record<string, string>;
  _dependencies: Record<string, string>;
  path: string;
  error: string | Error;
  extraneous: boolean;
}

/**
 * NPM packager.
 */
export class NPM implements Packager {
  get lockfileName() {
    return 'package-lock.json';
  }

  get copyPackageSectionNames() {
    return [];
  }

  get mustCopyModules() {
    return true;
  }

  private async getNpmMajorVersion(cwd: string): Promise<number> {
    const command = /^win/.test(process.platform) ? 'npm.cmd' : 'npm';
    const args = ['--version'];

    const processOutput = await spawnProcess(command, args, { cwd });
    const version = processOutput.stdout.trim();

    const [major] = version.split('.');

    if (major) {
      return parseInt(major);
    }

    throw new Error('Unable to get major npm version');
  }

  async getProdDependencies(cwd: string, depth?: number): Promise<DependenciesResult> {
    const npmMajorVersion = await this.getNpmMajorVersion(cwd);

    // Get first level dependency graph
    const command = /^win/.test(process.platform) ? 'npm.cmd' : 'npm';
    const args = [
      'ls',
      '-json',
      npmMajorVersion >= 7 ? '--omit=dev' : '-prod', // Only prod dependencies
      '-long',
      depth ? `-depth=${depth}` : npmMajorVersion >= 7 ? '-all' : null,
    ].filter(isString);

    const ignoredNpmErrors: Array<{
      npmError: string;
      log: boolean;
    }> = [
      { npmError: 'extraneous', log: false },
      { npmError: 'missing', log: false },
      { npmError: 'peer dep missing', log: true },
      { npmError: 'code ELSPROBLEMS', log: false },
    ];

    let parsedDeps: NpmV6Deps | NpmV7Deps;

    try {
      const processOutput = await spawnProcess(command, args, { cwd });

      parsedDeps = JSON.parse(processOutput.stdout) as NpmV6Deps | NpmV7Deps;
    } catch (err) {
      if (err instanceof SpawnError) {
        // Only exit with an error if we have critical npm errors for 2nd level inside
        // Split the stderr by \n character to get the npm ERR! plaintext lines, ignore additional JSON blob (emitted by npm >=7)
        // see https://github.com/serverless-heaven/serverless-webpack/pull/782 and https://github.com/floydspace/serverless-esbuild/issues/288
        const lines = split('\n', err.stderr);
        const npmErrors = takeWhile((line) => line !== '{', lines);

        const hasThrowableErrors = npmErrors.every(
          (error) =>
            !isEmpty(error) &&
            !any((ignoredError) => startsWith(`npm ERR! ${ignoredError.npmError}`, error), ignoredNpmErrors)
        );

        if (!hasThrowableErrors && !isEmpty(err.stdout)) {
          return { stdout: err.stdout };
        }
      }

      throw err;
    }

    const basePath = parsedDeps.path;

    const convertTrees = (
      currentTree: NpmV6Map | NpmV7Map,
      rootDeps: DependencyMap,
      currentDeps: DependencyMap = rootDeps
    ): DependencyMap => {
      return Object.entries(currentTree).reduce<DependencyMap>((deps, [name, tree]) => {
        if (tree.path === path.join(basePath, 'node_modules', name)) {
          // Module path is in the root folder

          // If this isn't the root of the tree
          if (rootDeps !== deps) {
            // Set it as resolved
            deps[name] ??= {
              version: tree.version,
              isRootDep: true,
            };
          }
          if (tree._deduped || (!isEmpty(tree._dependencies) && !tree.dependencies)) {
            // Edge case - When it is de-duped this record will not contain the dependency tree.
            // _deduped is for v6 (Object.keys(tree._dependencies).length && !tree.dependencies) for v7
            // We can just ignore storing this at the root because it does not contain the tree we are after
            // "samchungy-dep-b": {
            //   "version": "3.0.0",
            //   "name": "samchungy-dep-b",
            //   "resolved": "https://registry.npmjs.org/samchungy-dep-b/-/samchungy-dep-b-3.0.0.tgz",
            //   "integrity": "sha512-fy6RAnofLSnLHgOUmgsFz0ZFnJcJeNHT+qUfHJ7daIFlBaciRDR6v5sdWm7mAM2EzQ1KFf2hmKJVFZgthVeCAw==",
            //   "_id": "samchungy-dep-b@3.0.0",
            //   "extraneous": false,
            //   "path": "/Users/schung/me/serverless-esbuild/examples/individually/node_modules/samchungy-dep-b",
            //   "_dependencies": {
            //     "samchungy-dep-c": "^1.0.0",
            //     "samchungy-dep-d": "^1.0.0"
            //   },
            //   "devDependencies": {},
            //   "peerDependencies": {}
            // }
          } else {
            // This is a root node_modules dependency
            rootDeps[name] ??= {
              version: tree.version,
              ...(tree.dependencies &&
                !isEmpty(tree.dependencies) && {
                  dependencies: convertTrees(tree.dependencies, rootDeps, {}),
                }),
            };
          }
          return deps;
        }

        // Module is only installed within the node_modules of this dep. Iterate through it's dep tree
        deps[name] ??= {
          version: tree.version,
          ...(tree.dependencies &&
            !isEmpty(tree.dependencies) && {
              dependencies: convertTrees(tree.dependencies, rootDeps, {}),
            }),
        };
        return deps;
      }, currentDeps);
    };

    return {
      ...(parsedDeps.dependencies &&
        !isEmpty(parsedDeps.dependencies) && {
          dependencies: convertTrees(parsedDeps.dependencies, {}),
        }),
    };
  }

  _rebaseFileReferences(pathToPackageRoot: string, moduleVersion: string) {
    if (/^file:[^/]{2}/.test(moduleVersion)) {
      const filePath = replace(/^file:/, '', moduleVersion);
      return replace(/\\/g, '/', `file:${pathToPackageRoot}/${filePath}`);
    }

    return moduleVersion;
  }

  /**
   * We should not be modifying 'package-lock.json'
   * because this file should be treated as internal to npm.
   *
   * Rebase package-lock is a temporary workaround and must be
   * removed as soon as https://github.com/npm/npm/issues/19183 gets fixed.
   */
  rebaseLockfile(pathToPackageRoot: string, lockfile: JSONObject) {
    if (lockfile.version) {
      lockfile.version = this._rebaseFileReferences(pathToPackageRoot, lockfile.version);
    }

    if (lockfile.dependencies) {
      for (const lockedDependency in lockfile.dependencies) {
        this.rebaseLockfile(pathToPackageRoot, lockedDependency);
      }
    }

    return lockfile;
  }

  async install(cwd: string, extraArgs: Array<string>) {
    const command = /^win/.test(process.platform) ? 'npm.cmd' : 'npm';
    const args = ['install', ...extraArgs];

    await spawnProcess(command, args, { cwd });
  }

  async prune(cwd: string) {
    const command = /^win/.test(process.platform) ? 'npm.cmd' : 'npm';
    const args = ['prune'];

    await spawnProcess(command, args, { cwd });
  }

  async runScripts(cwd: string, scriptNames: string[]) {
    const command = /^win/.test(process.platform) ? 'npm.cmd' : 'npm';

    await Promise.all(
      scriptNames.map((scriptName) => {
        const args = ['run', scriptName];

        return spawnProcess(command, args, { cwd });
      })
    );
  }
}

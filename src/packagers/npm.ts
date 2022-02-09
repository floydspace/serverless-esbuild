import { any, isEmpty, reduce, replace, split, startsWith } from 'ramda';
import * as path from 'path';

import { DependenciesResult, DependencyMap, JSONObject } from '../types';
import { SpawnError, spawnProcess } from '../utils';
import { Packager } from './packager';

type NpmMap = Record<string, NpmTree>;

interface NpmTree {
  name: string;
  version: string;
  resolved?: string;
  peer?: boolean;
  integrity: string;
  _id: string;
  extraneous: boolean;
  path: string;
  _dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  peerDependencies: Record<string, string>;
  dependencies?: NpmMap;
}
interface NpmDeps {
  name: string;
  main?: string;
  scripts?: Record<string, string>;
  extraneous?: boolean;
  path: string;
  _dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  peerDependencies: Record<string, string>;
  dependencies?: NpmMap;
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
    return parseInt(version.split('.')[0]);
  }

  async getProdDependencies(cwd: string, depth?: number): Promise<DependenciesResult> {
    // Get first level dependency graph
    const command = /^win/.test(process.platform) ? 'npm.cmd' : 'npm';
    const args = [
      'ls',
      '-json',
      '-prod', // Only prod dependencies
      '-long',
      depth ? `-depth=${depth}` : (await this.getNpmMajorVersion(cwd)) >= 7 ? '-all' : null,
    ].filter(Boolean);

    const ignoredNpmErrors = [
      { npmError: 'extraneous', log: false },
      { npmError: 'missing', log: false },
      { npmError: 'peer dep missing', log: true },
    ];

    let parsedDeps: NpmDeps;
    try {
      const processOutput = await spawnProcess(command, args, { cwd });
      parsedDeps = JSON.parse(processOutput.stdout) as NpmDeps;
    } catch (err) {
      if (err instanceof SpawnError) {
        // Only exit with an error if we have critical npm errors for 2nd level inside
        const errors = split('\n', err.stderr);
        const failed = reduce(
          (f, error) => {
            if (f) {
              return true;
            }
            return (
              !isEmpty(error) &&
              !any(
                (ignoredError) => startsWith(`npm ERR! ${ignoredError.npmError}`, error),
                ignoredNpmErrors
              )
            );
          },
          false,
          errors
        );

        if (!failed && !isEmpty(err.stdout)) {
          return { stdout: err.stdout };
        }
      }

      throw err;
    }

    const basePath = parsedDeps.path;

    const convertTrees = (currentTree: NpmMap, rootDeps: DependencyMap): DependencyMap => {
      return Object.entries(currentTree).reduce<DependencyMap>(
        (deps, [name, tree]) => {
          if (tree.path === path.join(basePath, 'node_modules', name)) {
            // Module path is in the root folder

            // Set it as resolved
            deps[name] = {
              version: tree.version,
              isRootDep: true,
            };
            if (Object.keys(tree._dependencies).length && !tree.dependencies) {
              // Edge case - When it is de-duped this record will not contain the dependency tree.
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
              // This is a root node_modules dependency. When rootDeps = deps, this will just overwrite the resolved declaration above
              rootDeps[name] = {
                version: tree.version,
                ...(tree.dependencies && {
                  dependencies: convertTrees(tree.dependencies, rootDeps),
                }),
              };
            }
            return deps;
          }

          // Module is only installed within the node_modules of this dep. Iterate through it's dep tree
          deps[name] = {
            version: tree.version,
            ...(tree.dependencies && { dependencies: convertTrees(tree.dependencies, rootDeps) }),
          };
          return deps;
        },
        !Object.keys(rootDeps).length ? rootDeps : {} // Only use rootDeps if it is empty (first iteration only)
      );
    };

    return {
      dependencies: convertTrees(parsedDeps.dependencies, {}),
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

  async prune(cwd) {
    const command = /^win/.test(process.platform) ? 'npm.cmd' : 'npm';
    const args = ['prune'];

    await spawnProcess(command, args, { cwd });
  }

  async runScripts(cwd, scriptNames) {
    const command = /^win/.test(process.platform) ? 'npm.cmd' : 'npm';

    await Promise.all(
      scriptNames.map((scriptName) => {
        const args = ['run', scriptName];

        return spawnProcess(command, args, { cwd });
      })
    );
  }
}

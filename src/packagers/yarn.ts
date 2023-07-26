import { any, isEmpty, reduce, replace, split, startsWith } from 'ramda';
import { satisfies, valid as isValidSemver } from 'semver';

import type { DependenciesResult, DependencyMap, PackagerOptions } from '../types';
import { SpawnError, spawnProcess } from '../utils';
import type { Packager } from './packager';
import { isString } from '../helper';

interface YarnTree {
  name: string;
  color: 'bold' | 'dim' | null;
  children?: YarnTree[];
  hint?: null;
  depth?: number;
  shadow?: boolean;
}
export interface YarnDeps {
  type: 'tree';
  data: {
    type: 'list';
    trees: YarnTree[];
  };
}

const getNameAndVersion = (name: string): { name: string; version: string } => {
  /*
   * This regex supports these cases:
   * - package@version (single '@' is the separator) => returns 'package'
   * - @org/package@version ('@' for org name and version separator) => returns '@org/package'
   * - @org/package@git+ssh://git@github.com/org/package (last '@' is not a name / version separator) => returns '@org/package'
   */
  const packageNameMatch = name.match(/^(@[^@]+|[^@]+)/);

  if (!packageNameMatch) {
    return {
      name,
      version: '',
    };
  }

  // Everything after the name is the version (separated by a single '@'):
  const versionStartIndex = (packageNameMatch?.index || 0) + packageNameMatch[0].length;

  return {
    name: packageNameMatch[0],
    version: name.slice(versionStartIndex),
  };
};

/**
 * Yarn packager.
 *
 * Yarn specific packagerOptions (default):
 *   flat (false) - Use --flat with install
 *   ignoreScripts (false) - Do not execute scripts during install
 */
export class Yarn implements Packager {
  private packagerOptions: PackagerOptions;

  constructor(packagerOptions: PackagerOptions) {
    this.packagerOptions = packagerOptions;
  }

  get lockfileName() {
    return 'yarn.lock';
  }

  get copyPackageSectionNames() {
    return ['resolutions'];
  }

  get mustCopyModules() {
    return false;
  }

  async getVersion(cwd: string) {
    const command = /^win/.test(process.platform) ? 'yarn.cmd' : 'yarn';
    const args = ['-v'];

    const output = await spawnProcess(command, args, { cwd });

    return {
      version: output.stdout,
      isBerry: parseInt(output.stdout.charAt(0), 10) > 1,
    };
  }

  async getProdDependencies(cwd: string, depth?: number): Promise<DependenciesResult> {
    const command = /^win/.test(process.platform) ? 'yarn.cmd' : 'yarn';
    const args = ['list', depth ? `--depth=${depth}` : null, '--json', '--production'].filter(isString);

    // If we need to ignore some errors add them here
    const ignoredYarnErrors: Array<{
      npmError: string;
      log: boolean;
    }> = [];

    let parsedDeps: YarnDeps;

    try {
      const processOutput = await spawnProcess(command, args, { cwd });

      parsedDeps = JSON.parse(processOutput.stdout) as YarnDeps;
    } catch (err) {
      if (err instanceof SpawnError) {
        // Only exit with an error if we have critical npm errors for 2nd level inside
        const errors = split('\n', err.stderr);
        const failed = reduce(
          (acc, error) => {
            if (acc) {
              return true;
            }

            return (
              !isEmpty(error) &&
              !any((ignoredError) => startsWith(`npm ERR! ${ignoredError.npmError}`, error), ignoredYarnErrors)
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

    const rootTree = parsedDeps.data.trees;

    // Produces a version map for the modules present in our root node_modules folder
    const rootDependencies = rootTree.reduce<DependencyMap>((deps, tree) => {
      const { name, version } = getNameAndVersion(tree.name);

      // eslint-disable-next-line no-param-reassign
      deps[name] ??= {
        version,
      };

      return deps;
    }, {});

    const convertTrees = (trees: YarnTree[]): DependencyMap => {
      return trees.reduce<DependencyMap>((deps, tree) => {
        const { name, version } = getNameAndVersion(tree.name);

        const dependency = rootDependencies[name];

        if (tree.shadow) {
          // Package is resolved somewhere else
          // If the version is not valid semver, include the package by default. For e.g. 'github:' references where semver doesn't apply.
          if (dependency && (satisfies(dependency.version, version) || !isValidSemver(dependency.version))) {
            // Package is at root level
            // {
            //   "name": "samchungy-dep-a@1.0.0", <- MATCH
            //   "children": [],
            //   "hint": null,
            //   "color": null,
            //   "depth": 0
            // },
            // {
            //   "name": "samchungy-a@2.0.0",
            //   "children": [
            //     {
            //       "name": "samchungy-dep-a@1.0.0", <- THIS
            //       "color": "dim",
            //       "shadow": true
            //     }
            //   ],
            //   "hint": null,
            //   "color": "bold",
            //   "depth": 0
            // }
            // eslint-disable-next-line no-param-reassign
            deps[name] ??= {
              version,
              isRootDep: true,
            };
          } else {
            // Package info is in anther child so we can just ignore
            // samchungy-dep-a@1.0.0 is in the root (see above example)
            // {
            //   "name": "samchungy-b@2.0.0",
            //   "children": [
            //     {
            //       "name": "samchungy-dep-a@2.0.0", <- THIS
            //       "color": "dim",
            //       "shadow": true
            //     },
            //     {
            //       "name": "samchungy-dep-a@2.0.0",
            //       "children": [],
            //       "hint": null,
            //       "color": "bold",
            //       "depth": 0
            //     }
            //   ],
            //   "hint": null,
            //   "color": "bold",
            //   "depth": 0
            // }
          }

          return deps;
        }

        // Package is not defined, store it and get the children
        //     {
        //       "name": "samchungy-dep-a@2.0.0",
        //       "children": [],
        //       "hint": null,
        //       "color": "bold",
        //       "depth": 0
        //     }
        // eslint-disable-next-line no-param-reassign
        deps[name] ??= {
          version,
          ...(tree?.children?.length && { dependencies: convertTrees(tree.children) }),
        };

        return deps;
      }, {});
    };

    return {
      dependencies: convertTrees(rootTree),
    };
  }

  rebaseLockfile(pathToPackageRoot: string, lockfile: string) {
    const fileVersionMatcher = /[^"/]@(?:file:)?((?:\.\/|\.\.\/).*?)[":,]/gm;
    const replacements: Array<{
      oldRef: string;
      newRef: string;
    }> = [];
    let match;

    // Detect all references and create replacement line strings
    // eslint-disable-next-line no-cond-assign
    while ((match = fileVersionMatcher.exec(lockfile)) !== null) {
      replacements.push({
        oldRef: typeof match[1] === 'string' ? match[1] : '',
        newRef: replace(/\\/g, '/', `${pathToPackageRoot}/${match[1]}`),
      });
    }

    // Replace all lines in lockfile
    return reduce(
      (__, replacement) => replace(replacement.oldRef, replacement.newRef, __),
      lockfile,
      replacements.filter((item) => item.oldRef !== '')
    );
  }

  async install(cwd: string, extraArgs: Array<string>, hasLockfile = true) {
    if (this.packagerOptions.noInstall) {
      return;
    }

    const version = await this.getVersion(cwd);
    const command = /^win/.test(process.platform) ? 'yarn.cmd' : 'yarn';

    const args =
      !this.packagerOptions.ignoreLockfile && hasLockfile
        ? ['install', ...(version.isBerry ? ['--immutable'] : ['--frozen-lockfile', '--non-interactive']), ...extraArgs]
        : ['install', ...(version.isBerry ? [] : ['--non-interactive']), ...extraArgs];

    await spawnProcess(command, args, { cwd });
  }

  // "Yarn install" prunes automatically
  prune(cwd: string) {
    return this.install(cwd, []);
  }

  async runScripts(cwd: string, scriptNames: string[]) {
    const command = /^win/.test(process.platform) ? 'yarn.cmd' : 'yarn';

    await Promise.all(scriptNames.map((scriptName) => spawnProcess(command, ['run', scriptName], { cwd })));
  }
}

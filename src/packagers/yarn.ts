import { Predicate } from 'effect';
import { any, isEmpty, reduce, replace, split, startsWith } from 'ramda';
import { satisfies } from 'semver';

import type { DependenciesResult, DependencyMap, PackagerOptions } from '../types';
import { SpawnError, spawnProcess } from '../utils';
import type { Packager } from './packager';

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

export interface YarnBerryDep {
  value: string;
  children: {
    Version: string;
    Dependencies?: Array<{
      descriptor: string;
      locator: string;
    }>;
  };
}

const getNameAndVersion = (name: string): { name: string; version: string } => {
  const atIndex = name.lastIndexOf('@');

  return {
    name: name.slice(0, atIndex),
    version: name.slice(atIndex + 1),
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
    const version = await this.getVersion(cwd);

    if (version.isBerry) {
      return this.getBerryProdDependencies(cwd, depth);
    }

    return this.getClassicProdDependencies(cwd, depth);
  }

  private parsePackageInfo(line: string): { name: string; version: string; depInfo: YarnBerryDep } | null {
    try {
      const depInfo = JSON.parse(line) as YarnBerryDep;
      const valueMatch = depInfo.value.match(/^(.+)@npm:(.+)$/);

      if (valueMatch && valueMatch[1] && valueMatch[2]) {
        return {
          depInfo,
          name: valueMatch[1],
          version: valueMatch[2],
        };
      }
    } catch (e) {}

    return null;
  }

  private collectRootDependencies(lines: string[]): DependencyMap {
    const rootDependencies: DependencyMap = {};

    for (const line of lines) {
      const packageInfo = this.parsePackageInfo(line);

      if (packageInfo && packageInfo.version !== 'workspace:.') {
        rootDependencies[packageInfo.name] = {
          version: packageInfo.depInfo.children.Version,
        };
      }
    }

    return rootDependencies;
  }

  private processDependency(
    depInfo: YarnBerryDep,
    name: string,
    rootDependencies: DependencyMap,
    dependencies: DependencyMap
  ): DependencyMap {
    const result = { ...dependencies };

    if (depInfo.value.includes('workspace:.')) {
      return result;
    }

    if (depInfo.children.Dependencies) {
      const depMap = this.buildDependencyMap(depInfo.children.Dependencies, rootDependencies);

      const rootDep = rootDependencies[name];
      if (rootDep) {
        if (Object.keys(depMap).length > 0) {
          result[name] = {
            ...rootDep,
            dependencies: depMap,
          };
        } else {
          result[name] = rootDep;
        }
      }
    } else {
      const rootDep = rootDependencies[name];
      if (!result[name] && rootDep) {
        result[name] = rootDep;
      }
    }

    return result;
  }

  /**
   * 의존성 맵을 구성합니다.
   */
  private buildDependencyMap(
    deps: Array<{ descriptor: string; locator: string }>,
    rootDependencies: DependencyMap
  ): DependencyMap {
    const depMap: DependencyMap = {};

    for (const dep of deps) {
      const descriptorMatch = dep.descriptor.match(/^(.+)@npm:(.+)$/);

      if (descriptorMatch && descriptorMatch[1] && descriptorMatch[2]) {
        const depName = descriptorMatch[1];
        const depVersionRange = descriptorMatch[2];

        if (rootDependencies[depName]) {
          depMap[depName] = {
            version: depVersionRange,
            isRootDep: true,
          };
        } else {
          depMap[depName] = {
            version: depVersionRange,
          };
        }
      }
    }

    return depMap;
  }

  private async getBerryProdDependencies(cwd: string, _depth?: number): Promise<DependenciesResult> {
    const command = /^win/.test(process.platform) ? 'yarn.cmd' : 'yarn';
    const args = ['info', '-AR', '--json'].filter(Predicate.isString);

    try {
      const processOutput = await spawnProcess(command, args, { cwd });

      const lines = processOutput.stdout.split('\n').filter((line) => line.trim() !== '');
      let dependencies: DependencyMap = {};

      const rootDependencies = this.collectRootDependencies(lines);

      for (const line of lines) {
        const packageInfo = this.parsePackageInfo(line);

        if (packageInfo) {
          dependencies = this.processDependency(packageInfo.depInfo, packageInfo.name, rootDependencies, dependencies);
        }
      }

      return { dependencies };
    } catch (err) {
      if (err instanceof SpawnError && !isEmpty(err.stdout)) {
        return { stdout: err.stdout };
      }
      throw err;
    }
  }

  private async getClassicProdDependencies(cwd: string, depth?: number): Promise<DependenciesResult> {
    const command = /^win/.test(process.platform) ? 'yarn.cmd' : 'yarn';
    const args = ['list', depth ? `--depth=${depth}` : null, '--json', '--production'].filter(Predicate.isString);

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
          if (dependency && satisfies(dependency.version, version)) {
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
    console.log('[DEBUG] Yarn: Rebasing lockfile, pathToPackageRoot:', pathToPackageRoot);
    console.log('[DEBUG] Yarn: Lockfile size:', lockfile.length);

    const fileVersionMatcher = /[^"/]@(?:file:)?((?:\.\/|\.\.\/).*?)[":,]/gm;
    const replacements: Array<{
      oldRef: string;
      newRef: string;
    }> = [];
    let match;

    // Detect all references and create replacement line strings
    // eslint-disable-next-line no-cond-assign
    while ((match = fileVersionMatcher.exec(lockfile)) !== null) {
      const oldRef = typeof match[1] === 'string' ? match[1] : '';
      const newRef = replace(/\\/g, '/', `${pathToPackageRoot}/${match[1]}`);

      console.log('[DEBUG] Yarn: Found file reference:', oldRef, '-> rebasing to:', newRef);

      replacements.push({
        oldRef,
        newRef,
      });
    }

    console.log('[DEBUG] Yarn: Total replacements found:', replacements.length);

    // Replace all lines in lockfile
    const result = reduce(
      (__, replacement) => replace(replacement.oldRef, replacement.newRef, __),
      lockfile,
      replacements.filter((item) => item.oldRef !== '')
    );

    console.log('[DEBUG] Yarn: Rebased lockfile size:', result.length);
    return result;
  }

  async install(cwd: string, extraArgs: Array<string>, hasLockfile = true) {
    if (this.packagerOptions.noInstall) {
      console.log('[DEBUG] Yarn: noInstall option is set, skipping install');
      return;
    }

    const version = await this.getVersion(cwd);
    console.log('[DEBUG] Yarn: Version detected:', version.version, 'isBerry:', version.isBerry);

    const command = /^win/.test(process.platform) ? 'yarn.cmd' : 'yarn';

    const args =
      !this.packagerOptions.ignoreLockfile && hasLockfile
        ? ['install', ...(version.isBerry ? ['--immutable'] : ['--frozen-lockfile', '--non-interactive']), ...extraArgs]
        : ['install', ...(version.isBerry ? [] : ['--non-interactive']), ...extraArgs];

    console.log('[DEBUG] Yarn: Installing with command:', command, args.join(' '));
    console.log('[DEBUG] Yarn: Working directory:', cwd);

    try {
      await spawnProcess(command, args, { cwd });
      console.log('[DEBUG] Yarn: Install completed successfully');
    } catch (err) {
      console.error('[DEBUG] Yarn: Install failed with error:', err);
      throw err;
    }
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

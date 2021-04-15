import { any, head, isEmpty, join, pathOr, reduce, replace, split, startsWith, tail } from 'ramda';

import { JSONObject } from '../types';
import { SpawnError, spawnProcess } from '../utils';
import { Packager } from './packager';

/**
 * Yarn packager.
 *
 * Yarn specific packagerOptions (default):
 *   flat (false) - Use --flat with install
 *   ignoreScripts (false) - Do not execute scripts during install
 */
export class Yarn implements Packager {
  get lockfileName() {
    return 'yarn.lock';
  }

  get copyPackageSectionNames() {
    return ['resolutions'];
  }

  get mustCopyModules() {
    return false;
  }

  async getProdDependencies(cwd: string, depth?: number) {
    const command = /^win/.test(process.platform) ? 'yarn.cmd' : 'yarn';
    const args = ['list', depth ? `--depth=${depth}` : null, '--json', '--production'].filter(
      Boolean
    );

    // If we need to ignore some errors add them here
    const ignoredYarnErrors = [];

    let processOutput;
    try {
      processOutput = await spawnProcess(command, args, { cwd });
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
                ignoredError => startsWith(`npm ERR! ${ignoredError.npmError}`, error),
                ignoredYarnErrors
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

    const depJson = processOutput.stdout;
    const parsedTree = JSON.parse(depJson);
    const convertTrees = convertingTrees =>
      reduce(
        (__, tree: JSONObject) => {
          const splitModule = split('@', tree.name);
          // If we have a scoped module we have to re-add the @
          if (startsWith('@', tree.name)) {
            splitModule.splice(0, 1);
            splitModule[0] = '@' + splitModule[0];
          }
          __[head(splitModule)] = {
            version: join('@', tail(splitModule)),
            dependencies: convertTrees(tree.children),
          };
          return __;
        },
        {},
        convertingTrees || []
      );

    const trees = pathOr([], ['data', 'trees'], parsedTree);
    const result = {
      problems: [],
      dependencies: convertTrees(trees),
    };
    return result;
  }

  rebaseLockfile(pathToPackageRoot, lockfile) {
    const fileVersionMatcher = /[^"/]@(?:file:)?((?:\.\/|\.\.\/).*?)[":,]/gm;
    const replacements = [];
    let match;

    // Detect all references and create replacement line strings
    while ((match = fileVersionMatcher.exec(lockfile)) !== null) {
      replacements.push({
        oldRef: match[1],
        newRef: replace(/\\/g, '/', `${pathToPackageRoot}/${match[1]}`),
      });
    }

    // Replace all lines in lockfile
    return reduce(
      (__, replacement) => replace(__, replacement.oldRef, replacement.newRef),
      lockfile,
      replacements
    );
  }

  async install(cwd, useLockfile = true) {
    const command = /^win/.test(process.platform) ? 'yarn.cmd' : 'yarn';

    const args = useLockfile
      ? ['install', '--frozen-lockfile', '--non-interactive']
      : ['install', '--non-interactive'];

    await spawnProcess(command, args, { cwd });
  }

  // "Yarn install" prunes automatically
  prune(cwd) {
    return this.install(cwd);
  }

  async runScripts(cwd, scriptNames: string[]) {
    const command = /^win/.test(process.platform) ? 'yarn.cmd' : 'yarn';
    await Promise.all(
      scriptNames.map(scriptName => spawnProcess(command, ['run', scriptName], { cwd }))
    );
  }
}

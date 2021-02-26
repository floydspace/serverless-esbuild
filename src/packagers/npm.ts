import { any, isEmpty, reduce, replace, split, startsWith } from 'ramda';

import { JSONObject } from '../types';
import { SpawnError, spawnProcess } from '../utils';
import { Packager } from './packager';

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

  async getProdDependencies(cwd: string, depth?: number) {
    // Get first level dependency graph
    const command = /^win/.test(process.platform) ? 'npm.cmd' : 'npm';
    const args = [
      'ls',
      '-prod', // Only prod dependencies
      '-json',
      depth ? `-depth=${depth}` : null,
    ].filter(Boolean);

    const ignoredNpmErrors = [
      { npmError: 'extraneous', log: false },
      { npmError: 'missing', log: false },
      { npmError: 'peer dep missing', log: true },
    ];

    try {
      const processOutput = await spawnProcess(command, args, { cwd });
      const depJson = processOutput.stdout;

      return JSON.parse(depJson);
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

  async install(cwd) {
    const command = /^win/.test(process.platform) ? 'npm.cmd' : 'npm';
    const args = ['install'];

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
      scriptNames.map(scriptName => {
        const args = ['run', scriptName];

        return spawnProcess(command, args, { cwd });
      })
    );
  }
}

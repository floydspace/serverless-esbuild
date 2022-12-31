import { isEmpty, reduce, replace, split, startsWith } from 'ramda';
import { isString } from '../helper';

import type { JSONObject } from '../types';
import { SpawnError, spawnProcess } from '../utils';
import type { Packager } from './packager';

/**
 * pnpm packager.
 */
export class Pnpm implements Packager {
  get lockfileName() {
    return 'pnpm-lock.yaml';
  }

  get copyPackageSectionNames() {
    return [];
  }

  get mustCopyModules() {
    return false;
  }

  async getProdDependencies(cwd: string, depth?: number) {
    // Get first level dependency graph
    const command = /^win/.test(process.platform) ? 'pnpm.cmd' : 'pnpm';
    const args = [
      'ls',
      '--prod', // Only prod dependencies
      '--json',
      depth ? `--depth=${depth}` : null,
    ].filter(isString);

    // If we need to ignore some errors add them here
    const ignoredPnpmErrors: Array<{
      npmError: string;
      log: boolean;
    }> = [];

    try {
      const processOutput = await spawnProcess(command, args, { cwd });
      const depJson = processOutput.stdout;

      return JSON.parse(depJson)[0];
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
              !ignoredPnpmErrors.some((ignoredError) => startsWith(`npm ERR! ${ignoredError.npmError}`, error))
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

  /**
   * We should not be modifying 'pnpm-lock.yaml'
   * because this file should be treated as internal to pnpm.
   */
  rebaseLockfile(pathToPackageRoot: string, lockfile: JSONObject) {
    if (lockfile.version) {
      // eslint-disable-next-line no-param-reassign
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
    const command = /^win/.test(process.platform) ? 'pnpm.cmd' : 'pnpm';

    const args = ['install', ...extraArgs];

    await spawnProcess(command, args, { cwd });
  }

  async prune(cwd: string) {
    const command = /^win/.test(process.platform) ? 'pnpm.cmd' : 'pnpm';
    const args = ['prune'];

    await spawnProcess(command, args, { cwd });
  }

  async runScripts(cwd: string, scriptNames: string[]) {
    const command = /^win/.test(process.platform) ? 'pnpm.cmd' : 'pnpm';

    await Promise.all(
      scriptNames.map((scriptName) => {
        const args = ['run', scriptName];

        return spawnProcess(command, args, { cwd });
      })
    );
  }

  private _rebaseFileReferences(pathToPackageRoot: string, moduleVersion: string) {
    if (/^file:[^/]{2}/.test(moduleVersion)) {
      const filePath = replace(/^file:/, '', moduleVersion);

      return replace(/\\/g, '/', `file:${pathToPackageRoot}/${filePath}`);
    }

    return moduleVersion;
  }
}

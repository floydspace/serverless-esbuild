/**
 * Factory for supported packagers.
 *
 * All packagers must implement the following interface:
 *
 * interface Packager {
 *
 * static get lockfileName(): string;
 * static get copyPackageSectionNames(): Array<string>;
 * static get mustCopyModules(): boolean;
 * static getProdDependencies(cwd: string, depth: number = 1): BbPromise<Object>;
 * static rebaseLockfile(pathToPackageRoot: string, lockfile: Object): void;
 * static install(cwd: string): BbPromise<void>;
 * static prune(cwd: string): BbPromise<void>;
 * static runScripts(cwd: string, scriptNames): BbPromise<void>;
 *
 * }
 */

import { Packager } from './packager';
import { NPM } from './npm';
import { Pnpm } from './pnpm';
import { Yarn } from './yarn';

const registeredPackagers = {
  npm: new NPM(),
  pnpm: new Pnpm(),
  yarn: new Yarn(),
};

/**
 * Factory method.
 * @this ServerlessWebpack - Active plugin instance
 * @param {string} packagerId - Well known packager id.
 * @returns {Promise<Packager>} - Promised packager to allow packagers be created asynchronously.
 */
export function get(packagerId: string): Promise<Packager> {
  if (!(packagerId in registeredPackagers)) {
    const message = `Could not find packager '${packagerId}'`;
    this.log.error(`ERROR: ${message}`);
    throw new this.serverless.classes.Error(message);
  }
  return registeredPackagers[packagerId];
}

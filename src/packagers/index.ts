/**
 * Factory for supported packagers.
 *
 * All packagers must extend the Packager class.
 *
 * @see Packager
 */
import { memoizeWith } from 'ramda';

import { isPackagerId } from '../type-predicate';

import type EsbuildServerlessPlugin from '../index';
import type { PackagerId, PackagerOptions } from '../types';
import type { Packager } from './packager';

const packagerFactories: Record<PackagerId, (packgerOptions?: PackagerOptions) => Promise<Packager>> = {
  async npm() {
    const { NPM } = await import('./npm');

    return new NPM();
  },
  async pnpm() {
    const { Pnpm } = await import('./pnpm');

    return new Pnpm();
  },
  async yarn(packgerOptions) {
    const { Yarn } = await import('./yarn');

    return new Yarn(packgerOptions);
  },
};

/**
 * Asynchronously create a Packager instance and memoize it.
 *
 * @this EsbuildServerlessPlugin - Active plugin instance
 * @param {string} packagerId - Well known packager id
 * @returns {Promise<Packager>} - The selected Packager
 */
export const getPackager = memoizeWith(
  (packagerId) => packagerId,
  async function (
    this: EsbuildServerlessPlugin,
    packagerId: PackagerId,
    packgerOptions?: PackagerOptions
  ): Promise<Packager> {
    this.log.debug(`Trying to create packager: ${packagerId}`);

    if (!isPackagerId(packagerId)) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore Serverless typings (as of v3.0.2) are incorrect
      throw new this.serverless.classes.Error(`Could not find packager '${packagerId}'`);
    }

    const packager = await packagerFactories[packagerId](packgerOptions);

    this.log.debug(`Packager created: ${packagerId}`);

    return packager;
  }
);

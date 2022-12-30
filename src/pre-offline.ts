import { relative } from 'path';
import { assocPath } from 'ramda';
import { assertIsString } from './helper';

import type EsbuildServerlessPlugin from './index';

export function preOffline(this: EsbuildServerlessPlugin) {
  assertIsString(this.buildDirPath);

  // Set offline location automatically if not set manually
  if (!this.serverless?.service?.custom?.['serverless-offline']?.location) {
    const newServerless = assocPath(
      ['service', 'custom', 'serverless-offline', 'location'],
      relative(this.serviceDirPath, this.buildDirPath),
      this.serverless
    );

    this.serverless.service.custom = newServerless.service.custom;
  }
}

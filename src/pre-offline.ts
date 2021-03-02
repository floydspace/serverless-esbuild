import { relative } from 'path';
import { assocPath } from 'ramda';
import { EsbuildPlugin } from '.';

export function preOffline(this: EsbuildPlugin) {
  // Set offline location automatically if not set manually
  if (!this.serverless?.service?.custom?.['serverless-offline']?.location) {
    assocPath(
      ['service', 'custom', 'serverless-offline', 'location'],
      relative(this.serverless.config.servicePath, this.buildDirPath),
      this.serverless
    );
  }
}

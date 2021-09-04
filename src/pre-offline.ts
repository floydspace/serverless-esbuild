import { relative } from 'path';
import { assocPath } from 'ramda';
import { EsbuildServerlessPlugin } from '.';

export function preOffline(this: EsbuildServerlessPlugin) {
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

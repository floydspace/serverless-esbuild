import { EsbuildPlugin } from '.';
import { relative } from 'path';
export function preOffline(this: EsbuildPlugin) {
  // Set offline location automatically if not set manually
  if (!this.serverless?.service?.custom?.['serverless-offline']?.location) {
    this.serverless.service.custom['serverless-offline'].location = relative(
      this.serverless.config.servicePath,
      this.buildDirPath
    );
  }
}

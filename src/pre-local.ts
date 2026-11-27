import { assertIsString } from './helper';
import type EsbuildServerlessPlugin from './index';

export function preLocal(this: EsbuildServerlessPlugin) {
  assertIsString(this.buildDirPath);

  this.serviceDirPath = this.buildDirPath;
  this.serverless.config.servicePath = this.buildDirPath;

  // If this is a node function set the service path as CWD to allow accessing bundled files correctly
  if (this.options.function && this.functions[this.options.function]) {
    process.chdir(this.serviceDirPath);
  }
}

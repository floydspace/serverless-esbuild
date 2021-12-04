import { EsbuildServerlessPlugin } from '.';

export function preLocal(this: EsbuildServerlessPlugin) {
  this.serviceDirPath = this.buildDirPath;
  this.serverless.config.servicePath = this.buildDirPath;
  // If this is a node function set the service path as CWD to allow accessing bundled files correctly
  if (this.functions[this.options.function]) {
    process.chdir(this.serviceDirPath);
  }
}

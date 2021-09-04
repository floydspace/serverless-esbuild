import { EsbuildServerlessPlugin } from '.';
export function preLocal(this: EsbuildServerlessPlugin) {
  this.serviceDirPath = this.buildDirPath;
  this.serverless.config.servicePath = this.buildDirPath;
  // Set service path as CWD to allow accessing bundled files correctly
  process.chdir(this.serviceDirPath);
}

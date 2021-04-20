import { EsbuildPlugin } from '.';
export function preLocal(this: EsbuildPlugin) {
  this.serviceDirPath = this.buildDirPath;
  // Set service path as CWD to allow accessing bundled files correctly
  process.chdir(this.serviceDirPath);
}

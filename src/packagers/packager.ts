import { JSONObject } from '../types';

export interface Packager {
  lockfileName: string;
  copyPackageSectionNames: Array<string>;
  mustCopyModules: boolean;
  getProdDependencies(cwd: string, depth: number): Promise<JSONObject>;
  rebaseLockfile(pathToPackageRoot: string, lockfile: JSONObject): JSONObject;
  install(cwd: string): Promise<void>;
  prune(cwd: string): Promise<void>;
  runScripts(cwd: string, scriptNames): Promise<void>;
}

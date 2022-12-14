import { DependenciesResult, JSONObject } from '../types';

export interface Packager {
  lockfileName: string;
  copyPackageSectionNames: Array<string>;
  mustCopyModules: boolean;
  getProdDependencies(cwd: string, depth?: number): Promise<DependenciesResult>;
  rebaseLockfile(pathToPackageRoot: string, lockfile: JSONObject): JSONObject;
  install(cwd: string, extraArgs: Array<string>, useLockfile?: boolean): Promise<void>;
  link(cwd: string, packages: string[]): Promise<void>;
  prune(cwd: string): Promise<void>;
  runScripts(cwd: string, scriptNames): Promise<void>;
}

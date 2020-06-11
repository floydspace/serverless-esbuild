export interface Packager {
  lockfileName: string;
  copyPackageSectionNames: Array<string>;
  mustCopyModules: boolean;
  getProdDependencies(cwd: string, depth: number): Promise<any>;
  rebaseLockfile(pathToPackageRoot: string, lockfile: any): void;
  install(cwd: string, packagerOptions): Promise<void>;
  prune(cwd: string, packagerOptions): Promise<void>;
  runScripts(cwd: string, scriptNames): Promise<void>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type JSONObject = any;

export interface DependenciesResult {
  stdout?: string;
  dependencies?: DependencyMap;
}

export type DependencyMap = Record<string, DependencyTree>;

export interface DependencyTree {
  version: string;
  dependencies?: DependencyMap;
  /** Indicates the dependency is available from the root node_modules folder/root of this tree */
  isRootDep?: boolean;
}

export interface IFile {
  readonly localPath: string;
  readonly rootPath: string;
}
export type IFiles = readonly IFile[];

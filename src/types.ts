// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type JSONObject = any;

export type Dependencies = Record<string, Dependency>;

export interface Dependency {
  version: string;
  dependencies?: Dependencies;
  /** This means that the dependency is available from the root node_modules folder */
  resolved?: boolean;
}

export interface IFile {
  readonly localPath: string;
  readonly rootPath: string;
}
export type IFiles = readonly IFile[];

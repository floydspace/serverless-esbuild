// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type JSONObject = any;

export interface PackageDetails {
  version: string;
  resolved: string;
  dependencies: Record<string, PackageDetails>;
}

export type FlatPackageDetails = Record<string, PackageDetails>;

export interface IFile {
  readonly localPath: string;
  readonly rootPath: string;
}
export type IFiles = readonly IFile[];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type JSONObject = any;

export interface IFile {
  readonly localPath: string
  readonly rootPath: string
}
export type IFiles = readonly IFile[];

import { BuildOptions, BuildResult, Plugin } from 'esbuild';
import Serverless from 'serverless';

export type Plugins = Plugin[];
export type ReturnPluginsFn = (sls: Serverless) => Plugins;

export interface WatchConfiguration {
  pattern?: string[] | string;
  ignore?: string[] | string;
}

export interface PackagerOptions {
  scripts?: string[] | string;
}

export type EsbuildOptions = Omit<BuildOptions, 'nativeZip' | 'watch' | 'plugins'>;

export interface Configuration extends EsbuildOptions {
  concurrency?: number;
  packager: 'npm' | 'yarn';
  packagePath: string;
  exclude: '*' | string[];
  nativeZip: boolean;
  watch: WatchConfiguration;
  installExtraArgs: string[];
  plugins?: string;
  keepOutputDirectory?: boolean;
  packagerOptions?: PackagerOptions;
  disableIncremental?: boolean;
  outputWorkFolder?: string;
  outputBuildFolder?: string;
}

export interface FunctionEntry {
  entry: string;
  func: Serverless.FunctionDefinitionHandler;
  functionAlias?: string;
}

export interface FunctionBuildResult {
  bundlePath: string;
  func: Serverless.FunctionDefinitionHandler;
  functionAlias: string;
}

export interface FileBuildResult {
  bundlePath: string;
  entry: string;
  result: BuildResult;
}

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

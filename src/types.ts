import { BuildOptions, BuildResult, Plugin } from 'esbuild';
import Serverless from 'serverless';

export type Plugins = Plugin[];
export type ReturnPluginsFn = (sls: Serverless) => Plugins;

export interface OptionsExtended extends Serverless.Options {
  verbose?: boolean;
}

export interface WatchConfiguration {
  pattern?: string[] | string;
  ignore?: string[] | string;
}

export interface PackagerOptions {
  scripts?: string[] | string;
}

export interface Configuration extends Omit<BuildOptions, 'nativeZip' | 'watch' | 'plugins'> {
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
}

export interface FunctionBuildResult {
  result: BuildResult;
  bundlePath: string;
  func: Serverless.FunctionDefinitionHandler;
  functionAlias: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type JSONObject = any;

export interface IFile {
  readonly localPath: string;
  readonly rootPath: string;
}
export type IFiles = readonly IFile[];

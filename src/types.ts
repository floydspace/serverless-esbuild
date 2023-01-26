import type { BuildOptions, BuildResult, Plugin } from 'esbuild';
import type Serverless from 'serverless';

export type ConfigFn = (sls: Serverless) => Configuration;

export type Plugins = Plugin[];
export type ReturnPluginsFn = (sls: Serverless) => Plugins;

export interface WatchConfiguration {
  pattern?: string[] | string;
  ignore?: string[] | string;
}

export interface PackagerOptions {
  scripts?: string[] | string;
  noInstall?: boolean;
}

interface NodeExternalsOptions {
  allowList?: string[];
}

export type EsbuildOptions = Omit<BuildOptions, 'watch' | 'plugins'>;

export interface Configuration extends EsbuildOptions {
  concurrency?: number;
  packager: PackagerId;
  packagerOptions: PackagerOptions;
  packagePath: string;
  exclude: '*' | string[];
  nativeZip: boolean;
  watch: WatchConfiguration;
  installExtraArgs: string[];
  plugins?: string | Plugin[];
  keepOutputDirectory?: boolean;
  disableIncremental?: boolean;
  outputWorkFolder?: string;
  outputBuildFolder?: string;
  outputFileExtension: '.js' | '.cjs' | '.mjs';
  nodeExternals?: NodeExternalsOptions;
}

export interface EsbuildFunctionDefinitionHandler extends Serverless.FunctionDefinitionHandler {
  skipEsbuild: boolean;
}

export interface FunctionEntry {
  entry: string;
  func: Serverless.FunctionDefinitionHandler | null;
  functionAlias?: string;
}

export interface FunctionBuildResult {
  bundlePath: string;
  func: Serverless.FunctionDefinitionHandler;
  functionAlias: string;
}

interface BuildInvalidate {
  (): Promise<BuildIncremental>;
  dispose(): void;
}

interface BuildIncremental extends BuildResult {
  rebuild: BuildInvalidate;
}

interface OldAPIResult extends BuildResult {
  rebuild?: BuildInvalidate;
  stop?: () => void;
}

export interface FileBuildResult {
  bundlePath: string;
  entry: string;
  result: OldAPIResult;
  context?: BuildContext | null;
}

interface ServeOptions {
  port?: number;
  host?: string;
  servedir?: string;
  keyfile?: string;
  certfile?: string;
  onRequest?: (args: ServeOnRequestArgs) => void;
}

interface ServeOnRequestArgs {
  remoteAddress: string;
  method: string;
  path: string;
  status: number;
  /** The time to generate the response, not to send it */
  timeInMS: number;
}

export interface BuildContext {
  /** Documentation: https://esbuild.github.io/api/#rebuild */
  rebuild(): Promise<BuildResult>;

  /** Documentation: https://esbuild.github.io/api/#watch */
  watch(options?: {}): Promise<void>;

  /** Documentation: https://esbuild.github.io/api/#serve */
  serve(options?: ServeOptions): Promise<ServeResult>;

  cancel(): Promise<void>;
  dispose(): Promise<void>;
}

/** Documentation: https://esbuild.github.io/api/#serve-return-values */
interface ServeResult {
  port: number;
  host: string;
}

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

export type PackagerId = 'npm' | 'pnpm' | 'yarn';

export type PackageJSON = {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  [key: string]: unknown;
};

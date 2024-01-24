import assert, { AssertionError } from 'assert';
import os from 'os';
import path from 'path';

import { parse } from 'acorn';
import { simple as simpleWalk } from 'acorn-walk';
import fs from 'fs-extra';
import { uniq } from 'ramda';

import type Serverless from 'serverless';
import type ServerlessPlugin from 'serverless/classes/Plugin';
import type { Configuration, DependencyMap, FunctionEntry, IFile } from './types';
import type { EsbuildFunctionDefinitionHandler } from './types';
import { DEFAULT_EXTENSIONS } from './constants';

export function asArray<T>(data: T | T[]): T[] {
  return Array.isArray(data) ? data : [data];
}

export const isString = (input: unknown): input is string => typeof input === 'string';

export function assertIsString(input: unknown, message = 'input is not a string'): asserts input is string {
  if (!isString(input)) {
    throw new AssertionError({ message, actual: input });
  }
}

export function extractFunctionEntries(
  cwd: string,
  provider: string,
  functions: Record<string, Serverless.FunctionDefinitionHandler>,
  resolveExtensions?: string[]
): FunctionEntry[] {
  // The Google provider will use the entrypoint not from the definition of the
  // handler function, but instead from the package.json:main field, or via a
  // index.js file. This check reads the current package.json in the same way
  // that we already read the tsconfig.json file, by inspecting the current
  // working directory. If the packageFile does not contain a valid main, then
  // it instead selects the index.js file.
  if (provider === 'google') {
    const packageFilePath = path.join(cwd, 'package.json');

    if (fs.existsSync(packageFilePath)) {
      // Load in the package.json file.
      const packageFile = JSON.parse(fs.readFileSync(packageFilePath).toString());

      // Either grab the package.json:main field, or use the index.ts file.
      // (This will be transpiled to index.js).
      const entry = packageFile.main ? packageFile.main.replace(/\.js$/, '.ts') : 'index.ts';

      // Check that the file indeed exists.
      if (!fs.existsSync(path.join(cwd, entry))) {
        throw new Error(`Compilation failed. Cannot locate entrypoint, ${entry} not found`);
      }

      return [{ entry, func: null }];
    }
  }

  return Object.keys(functions)
    .filter((functionAlias) => {
      return !(functions[functionAlias] as EsbuildFunctionDefinitionHandler).skipEsbuild;
    })
    .map((functionAlias) => {
      const func = functions[functionAlias];
      assert(func, `${functionAlias} not found in functions`);

      const { handler } = func;
      const fnName = path.extname(handler);
      const fnNameLastAppearanceIndex = handler.lastIndexOf(fnName);
      // replace only last instance to allow the same name for file and handler
      const fileName = handler.substring(0, fnNameLastAppearanceIndex);

      const extensions = resolveExtensions ?? DEFAULT_EXTENSIONS;

      for (const extension of extensions) {
        // Check if the .{extension} files exists. If so return that to watch
        if (fs.existsSync(path.join(cwd, fileName + extension))) {
          const entry = path.relative(cwd, fileName + extension);

          return {
            func,
            functionAlias,
            entry: os.platform() === 'win32' ? entry.replace(/\\/g, '/') : entry,
          };
        }
        if (fs.existsSync(path.join(cwd, path.join(fileName, 'index') + extension))) {
          const entry = path.relative(cwd, path.join(fileName, 'index') + extension);

          return {
            func,
            functionAlias,
            entry: os.platform() === 'win32' ? entry.replace(/\\/g, '/') : entry,
          };
        }
      }
      // Can't find the files. Watch will have an exception anyway. So throw one with error.
      throw new Error(
        `Compilation failed for function alias ${functionAlias}. Please ensure you have an index file with ext .ts or .js, or have a path listed as main key in package.json`
      );
    });
}

/**
 * Takes a dependency graph and returns a flat list of required production dependencies for all or the filtered deps
 * @param root the root of the dependency tree
 * @param rootDeps array of top level root dependencies to whitelist
 */
export const flatDep = (root: DependencyMap, rootDepsFilter: string[]): string[] => {
  const flattenedDependencies = new Set<string>();

  /**
   *
   * @param deps the current tree
   * @param filter the dependencies to get from this tree
   */
  const recursiveFind = (deps: DependencyMap | undefined, filter?: string[]) => {
    if (!deps) return;

    Object.entries(deps).forEach(([depName, details]) => {
      // only for root level dependencies
      if (filter && !filter.includes(depName)) {
        return;
      }

      if (details.isRootDep || filter) {
        // We already have this root dep and it's dependencies - skip this iteration
        if (flattenedDependencies.has(depName)) {
          return;
        }

        flattenedDependencies.add(depName);

        const dep = root[depName];

        dep && recursiveFind(dep.dependencies);

        return;
      }

      // This is a nested dependency and will be included by default when we include it's parent
      // We just need to check if we fulfil all it's dependencies
      recursiveFind(details.dependencies);
    });
  };

  recursiveFind(root, rootDepsFilter);

  return Array.from(flattenedDependencies);
};

/**
 * Extracts the base package from a package string taking scope into consideration
 * @example getBaseDep('@scope/package/register') returns '@scope/package'
 * @example getBaseDep('package/register') returns 'package'
 * @example getBaseDep('package') returns 'package'
 * @param input
 */
const getBaseDep = (input: string): string | undefined => {
  const result = /^@[^/]+\/[^/\n]+|^[^/\n]+/.exec(input);

  if (Array.isArray(result) && result[0]) {
    return result[0];
  }
};

export const isESM = (buildOptions: Configuration): boolean => {
  return buildOptions.format === 'esm' || (buildOptions.platform === 'neutral' && !buildOptions.format);
};

/**
 * Extracts the list of dependencies that appear in a bundle as `import 'XXX'`, `import('XXX')`, or `require('XXX')`.
 * @param bundlePath Absolute path to a bundled JS file
 * @param useESM Should the bundle be treated as ESM
 */
export const getDepsFromBundle = (bundlePath: string, useESM: boolean): string[] => {
  const bundleContent = fs.readFileSync(bundlePath, 'utf8');
  const deps: string[] = [];

  const ast = parse(bundleContent, {
    ecmaVersion: 'latest',
    sourceType: useESM ? 'module' : 'script',
  });

  // I'm using `node: any` since the type definition is not accurate.
  // There are properties at runtime that do not exist in the `acorn.Node` type.
  simpleWalk(ast, {
    CallExpression(node: any) {
      if (node.callee.name === 'require') {
        deps.push(node.arguments[0].value);
      }
    },
    ImportExpression(node: any) {
      deps.push(node.source.value);
    },
    ImportDeclaration(node: any) {
      deps.push(node.source.value);
    },
  });

  const baseDeps = deps.map(getBaseDep).filter(isString);

  return uniq(baseDeps);
};

export const doSharePath = (child: string, parent: string): boolean => {
  if (child === parent) {
    return true;
  }

  const parentTokens = parent.split('/');
  const childToken = child.split('/');

  return parentTokens.every((token, index) => childToken[index] === token);
};

export type AwsNodeProviderRuntimeMatcher<Versions extends number> = {
  [Version in Versions as `nodejs${Version}.x`]: `node${Version}`;
};

export type AzureNodeProviderRuntimeMatcher<Versions extends number> = {
  [Version in Versions as `nodejs${Version}`]: `node${Version}`;
};

export type GoogleNodeProviderRuntimeMatcher<Versions extends number> = {
  [Version in Versions as `nodejs${Version}`]: `node${Version}`;
};

export type ScalewayNodeProviderRuntimeMatcher<Versions extends number> = {
  [Version in Versions as `node${Version}`]: `node${Version}`;
};

export type AwsNodeMatcher = AwsNodeProviderRuntimeMatcher<12 | 14 | 16 | 18 | 20>;

export type AzureNodeMatcher = AzureNodeProviderRuntimeMatcher<12 | 14 | 16 | 18>;

export type GoogleNodeMatcher = GoogleNodeProviderRuntimeMatcher<12 | 14 | 16 | 18 | 20>;

export type ScalewayNodeMatcher = ScalewayNodeProviderRuntimeMatcher<12 | 14 | 16 | 18 | 20>;

export type NodeMatcher = AwsNodeMatcher & AzureNodeMatcher & GoogleNodeMatcher & ScalewayNodeMatcher;

export type AwsNodeMatcherKey = keyof AwsNodeMatcher;

export type AzureNodeMatcherKey = keyof AzureNodeMatcher;

export type GoogleNodeMatcherKey = keyof GoogleNodeMatcher;

export type ScalewayNodeMatcherKey = keyof ScalewayNodeMatcher;

export type NodeMatcherKey = AwsNodeMatcherKey | AzureNodeMatcherKey | GoogleNodeMatcherKey | ScalewayNodeMatcherKey;

const awsNodeMatcher: AwsNodeMatcher = {
  'nodejs20.x': 'node20',
  'nodejs18.x': 'node18',
  'nodejs16.x': 'node16',
  'nodejs14.x': 'node14',
  'nodejs12.x': 'node12',
};

const azureNodeMatcher: AzureNodeMatcher = {
  nodejs18: 'node18',
  nodejs16: 'node16',
  nodejs14: 'node14',
  nodejs12: 'node12',
};

const googleNodeMatcher: GoogleNodeMatcher = {
  nodejs20: 'node20',
  nodejs18: 'node18',
  nodejs16: 'node16',
  nodejs14: 'node14',
  nodejs12: 'node12',
};

const scalewayNodeMatcher: ScalewayNodeMatcher = {
  node20: 'node20',
  node18: 'node18',
  node16: 'node16',
  node14: 'node14',
  node12: 'node12',
};

const nodeMatcher: NodeMatcher = {
  ...googleNodeMatcher,
  ...awsNodeMatcher,
  ...azureNodeMatcher,
  ...scalewayNodeMatcher,
};

export const providerRuntimeMatcher = Object.freeze<Record<string, NodeMatcher>>({
  aws: awsNodeMatcher as NodeMatcher,
  azure: azureNodeMatcher as NodeMatcher,
  google: googleNodeMatcher as NodeMatcher,
  scaleway: scalewayNodeMatcher as NodeMatcher,
});

export const isNodeMatcherKey = (input: unknown): input is NodeMatcherKey =>
  typeof input === 'string' && Object.keys(nodeMatcher).includes(input);

export function assertIsSupportedRuntime(input: unknown): asserts input is NodeMatcherKey {
  if (!isNodeMatcherKey(input)) {
    throw new AssertionError({ actual: input, message: 'not a supported runtime' });
  }
}

export const buildServerlessV3LoggerFromLegacyLogger = (
  legacyLogger: Serverless['cli'],
  verbose?: boolean
): ServerlessPlugin.Logging['log'] => ({
  error: legacyLogger.log.bind(legacyLogger),
  warning: legacyLogger.log.bind(legacyLogger),
  notice: legacyLogger.log.bind(legacyLogger),
  info: legacyLogger.log.bind(legacyLogger),
  debug: verbose ? legacyLogger.log.bind(legacyLogger) : () => null,
  verbose: legacyLogger.log.bind(legacyLogger),
  success: legacyLogger.log.bind(legacyLogger),
});

export const stripEntryResolveExtensions = (file: IFile, extensions: string[]): IFile => {
  const resolveExtensionMatch = file.localPath.match(extensions.map((ext) => ext).join('|'));

  if (resolveExtensionMatch?.length && !DEFAULT_EXTENSIONS.includes(resolveExtensionMatch[0])) {
    const extensionParts = resolveExtensionMatch[0].split('.');

    return {
      ...file,
      localPath: file.localPath.replace(resolveExtensionMatch[0], `.${extensionParts[extensionParts.length - 1]}`),
    };
  }

  return file;
};

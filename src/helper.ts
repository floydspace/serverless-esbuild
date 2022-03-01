import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { uniq } from 'ramda';
import Serverless from 'serverless';
import ServerlessPlugin from 'serverless/classes/Plugin';
import matchAll from 'string.prototype.matchall';
import { DependencyMap, FunctionEntry } from './types';

export function extractFunctionEntries(
  cwd: string,
  provider: string,
  functions?: Record<string, Serverless.FunctionDefinitionHandler>
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
        console.log(`Cannot locate entrypoint, ${entry} not found`);
        throw new Error('Compilation failed');
      }

      return [{ entry, func: null }];
    }
  }

  return Object.keys(functions).map((functionAlias) => {
    const func = functions[functionAlias];
    const h = func.handler;
    const fnName = path.extname(h);
    const fnNameLastAppearanceIndex = h.lastIndexOf(fnName);
    // replace only last instance to allow the same name for file and handler
    const fileName = h.substring(0, fnNameLastAppearanceIndex);

    const extensions = ['.ts', '.js'];
    for (const extension of extensions) {
      // Check if the .{extension} files exists. If so return that to watch
      if (fs.existsSync(path.join(cwd, fileName + extension))) {
        const entry = path.relative(cwd, fileName + extension);
        return {
          entry: os.platform() === 'win32' ? entry.replace(/\\/g, '/') : entry,
          func,
          functionAlias,
        };
      }
    }

    // Can't find the files. Watch will have an exception anyway. So throw one with error.
    console.log(`Cannot locate handler - ${fileName} not found`);
    throw new Error(
      'Compilation failed. Please ensure you have an index file with ext .ts or .js, or have a path listed as main key in package.json'
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
      if (filter && !filter.includes(depName)) return;

      if (details.isRootDep || filter) {
        // We already have this root dep and it's dependencies - skip this iteration
        if (flattenedDependencies.has(depName)) return;

        recursiveFind(root[depName].dependencies);
        flattenedDependencies.add(depName);
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
 * @param path
 */
const getBaseDep = (path: string): string => /^@[^/]+\/[^/\n]+|^[^/\n]+/.exec(path)[0];

/**
 * Extracts the list of dependencies that appear in a bundle as `require(XXX)`
 * @param bundlePath Absolute path to a bundled JS file
 */
export const getDepsFromBundle = (bundlePath: string, platform: string): string[] => {
  const bundleContent = fs.readFileSync(bundlePath, 'utf8');
  const deps =
    platform === 'neutral'
      ? Array.from<string>(matchAll(bundleContent, /from\s?"(.*?)";|import\s?"(.*?)";/gim)).map(
          (match) => match[1] || match[2]
        )
      : Array.from<string>(matchAll(bundleContent, /require\("(.*?)"\)/gim)).map(
          (match) => match[1]
        );
  return uniq(deps.map((dep): string => getBaseDep(dep)));
};

export const doSharePath = (child, parent) => {
  if (child === parent) return true;
  const parentTokens = parent.split('/');
  const childToken = child.split('/');
  return parentTokens.every((t, i) => childToken[i] === t);
};

export const providerRuntimeMatcher = Object.freeze({
  aws: {
    'nodejs14.x': 'node14',
    'nodejs12.x': 'node12',
  },
});

export const buildServerlessV3LoggerFromLegacyLogger = (
  legacyLogger: (text: string) => void,
  verbose?: boolean
): ServerlessPlugin.Logging['log'] => ({
  error: legacyLogger,
  warning: legacyLogger,
  notice: legacyLogger,
  info: legacyLogger,
  debug: legacyLogger,
  verbose: verbose ? legacyLogger : () => null,
  success: legacyLogger,
});

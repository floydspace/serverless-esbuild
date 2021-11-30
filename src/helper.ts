import * as fs from 'fs-extra';
import * as path from 'path';
import { uniq } from 'ramda';
import * as Serverless from 'serverless';
import * as matchAll from 'string.prototype.matchall';
import { JSONObject } from './types';

export function extractFileNames(
  cwd: string,
  provider: string,
  functions?: Record<string, Serverless.FunctionDefinitionHandler>
): { entry: string; func: any; functionAlias?: string }[] {
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

    // Check if the .ts files exists. If so return that to watch
    if (fs.existsSync(path.join(cwd, fileName + '.ts'))) {
      return { entry: path.relative(cwd, fileName) + '.ts', func, functionAlias };
    }

    // Check if the .js files exists. If so return that to watch
    if (fs.existsSync(path.join(cwd, fileName + '.js'))) {
      return { entry: path.relative(cwd, fileName) + '.js', func, functionAlias };
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
 * @param deps A nested object as given by the `npm list --json` command
 * @param filter an array of top dependencies to whitelist (takes all dependencies if omitted)
 */
export const flatDep = (deps: JSONObject, filter?: string[], originalObject?: JSONObject) => {
  if (!deps) return [];

  // keep tracks of the original list when nested
  if (!originalObject) originalObject = deps;

  return Object.entries(deps).reduce((acc, [depName, details]) => {
    if (filter && !filter.includes(depName)) return acc;
    const detailsDeps =
      originalObject[depName]?.dependencies || (details as JSONObject).dependencies;
    return uniq([...acc, depName, ...flatDep(detailsDeps, undefined, originalObject)]);
  }, []);
};

/**
 * Extracts the list of dependencies that appear in a bundle as `require(XXX)`
 * @param bundlePath Absolute path to a bundled JS file
 */
export const getDepsFromBundle = (bundlePath: string) => {
  const bundleContent = fs.readFileSync(bundlePath, 'utf8');
  const requireMatch = matchAll(bundleContent, /require\("(.*?)"\)/gim);
  return uniq(Array.from(requireMatch).map((match) => match[1]));
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
    'nodejs10.x': 'node10',
  },
});

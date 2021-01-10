import * as fs from 'fs-extra';
import * as path from 'path';
import * as Serverless from 'serverless';

export function extractFileNames(cwd: string, provider: string, functions?: Record<string, Serverless.FunctionDefinition>): string[] {
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
      const main = packageFile.main ? packageFile.main.replace(/\.js$/, '.ts') : 'index.ts';

      // Check that the file indeed exists.
      if (!fs.existsSync(path.join(cwd, main))) {
        console.log(`Cannot locate entrypoint, ${main} not found`);
        throw new Error('Compilation failed');
      }

      return [main];
    }
  }

  return Object.values(functions)
    .map(fn => fn.handler)
    .map(h => {
      const fnName = path.extname(h);
      const fnNameLastAppearanceIndex = h.lastIndexOf(fnName);
      // replace only last instance to allow the same name for file and handler
      const fileName = h.substring(0, fnNameLastAppearanceIndex);

      // Check if the .ts files exists. If so return that to watch
      if (fs.existsSync(path.join(cwd, fileName + '.ts'))) {
        return fileName + '.ts';
      }

      // Check if the .js files exists. If so return that to watch
      if (fs.existsSync(path.join(cwd, fileName + '.js'))) {
        return fileName + '.js';
      }

      // Can't find the files. Watch will have an exception anyway. So throw one with error.
      console.log(`Cannot locate handler - ${fileName} not found`);
      throw new Error('Compilation failed. Please ensure handlers exists with ext .ts or .js');
    });
}

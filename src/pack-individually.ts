import * as fs from 'fs-extra';
import * as glob from 'glob';
import * as path from 'path';
import { intersection, isEmpty, path as get, without } from 'ramda';
import * as semver from 'semver';
import { EsbuildPlugin, SERVERLESS_FOLDER } from '.';
import { doSharePath, flatDep, getDepsFromBundle } from './helper';
import * as Packagers from './packagers';
import { humanSize, zip } from './utils';

function setArtifactPath(func, artifactPath) {
  const version = this.serverless.getVersion();
  // Serverless changed the artifact path location in version 1.18
  if (semver.lt(version, '1.18.0')) {
    func.artifact = artifactPath;
    func.package = Object.assign({}, func.package, { disable: true });
    this.serverless.cli.log(
      `${func.name} is packaged by the esbuild plugin. Ignore messages from SLS.`
    );
  } else {
    func.package = {
      artifact: artifactPath,
    };
  }
}

const excludedFilesDefault = ['package-lock.json', 'yarn.lock', 'package.json'];

export async function packIndividually(this: EsbuildPlugin) {
  // get a list of all path in build
  const files = glob.sync('**', {
    cwd: this.buildDirPath,
    dot: true,
    silent: true,
    follow: true,
  });

  if (isEmpty(files)) {
    throw new Error('Packaging: No files found');
  }

  // If individually is not set, ignore this part
  if (!this.serverless?.service?.package?.individually) return null;

  const packager = await Packagers.get(this.buildOptions.packager);

  // get a list of every function bundle
  const buildResults = this.buildResults;
  const bundlePathList = buildResults.map(b => path.dirname(b.bundlePath));

  // get a list of external dependencies already listed in package.json
  const externals = without<string>(this.buildOptions.exclude, this.buildOptions.external);
  const hasExternals = !!externals?.length;

  // get a tree of all production dependencies
  const packagerDependenciesList = hasExternals
    ? await packager.getProdDependencies(this.buildDirPath)
    : {};

  // package each function
  await Promise.all(
    buildResults.map(async ({ func, bundlePath }) => {
      const name = func.name;

      const excludedFilesOrDirectory = [
        ...excludedFilesDefault,
        ...bundlePathList.filter(p => !bundlePath.startsWith(p)),
      ];

      // allowed external dependencies in the final zip
      let depWhiteList = [];

      if (hasExternals) {
        const bundleDeps = getDepsFromBundle(path.join(this.buildDirPath, bundlePath));
        const bundleExternals = intersection(bundleDeps, externals);
        depWhiteList = flatDep(packagerDependenciesList.dependencies, bundleExternals);
      }

      const zipName = `${name}.zip`;
      const artifactPath = path.join(this.workDirPath, SERVERLESS_FOLDER, zipName);

      // filter files
      const filesPathList = files
        .filter((filePath: string) => {
          // exclude non individual files based on file or dir path
          if (excludedFilesOrDirectory.find(p => filePath.startsWith(p))) return false;

          // exclude non whitelisted dependencies
          if (filePath.startsWith('node_modules')) {
            if (!hasExternals) return false;
            if (
              // this is needed for dependencies that maps to a path (like scopped ones)
              !depWhiteList.find(dep => doSharePath(filePath, 'node_modules/' + dep))
            )
              return false;
          }

          return true;
        })
        // get absolute path
        .map(name => ({ path: path.join(this.buildDirPath, name), name }));

      const startZip = Date.now();
      await zip(artifactPath, filesPathList);

      const { size } = fs.statSync(artifactPath);

      this.serverless.cli.log(
        `Zip function: ${func.name} - ${humanSize(size)} [${Date.now() - startZip} ms]`
      );

      // defined present zip as output artifact
      setArtifactPath.call(
        this,
        func,
        path.relative(this.serverless.config.servicePath, artifactPath)
      );
    })
  );
}

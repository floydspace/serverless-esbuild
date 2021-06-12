import * as fs from 'fs-extra';
import * as globby from 'globby';
import * as path from 'path';
import {
  intersection,
  isEmpty,
  lensProp,
  map,
  over,
  pipe,
  reject,
  replace,
  test,
  without,
} from 'ramda';
import * as semver from 'semver';
import { EsbuildPlugin, SERVERLESS_FOLDER } from '.';
import { doSharePath, flatDep, getDepsFromBundle } from './helper';
import * as Packagers from './packagers';
import { IFiles } from './types';
import { humanSize, zip, trimExtension } from './utils';

function setFunctionArtifactPath(this: EsbuildPlugin, func, artifactPath) {
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

export async function pack(this: EsbuildPlugin) {
  // GOOGLE Provider requires a package.json and NO node_modules
  const isGoogleProvider = this.serverless?.service?.provider?.name === 'google';
  const excludedFiles = isGoogleProvider ? [] : excludedFilesDefault;

  // Google provider cannot use individual packaging for now - this could be built in a future release
  if (isGoogleProvider && this.serverless?.service?.package?.individually)
    throw new Error(
      'Packaging failed: cannot package function individually when using Google provider'
    );

  // get a list of all path in build
  const files: IFiles = globby
    .sync('**', {
      cwd: this.buildDirPath,
      dot: true,
      onlyFiles: true,
    })
    .filter(p => !excludedFiles.includes(p))
    .map(localPath => ({ localPath, rootPath: path.join(this.buildDirPath, localPath) }));

  if (isEmpty(files)) {
    console.log('Packaging: No files found. Skipping esbuild.');
    return;
  }

  // 1) If individually is not set, just zip the all build dir and return
  if (!this.serverless?.service?.package?.individually) {
    const zipName = `${this.serverless.service.service}.zip`;
    const artifactPath = path.join(this.workDirPath, SERVERLESS_FOLDER, zipName);

    // remove prefixes from individual extra files
    const filesPathList = pipe<IFiles, IFiles, IFiles>(
      reject(test(/^__only_[^/]+$/)) as (x: IFiles) => IFiles,
      map(over(lensProp('localPath'), replace(/^__only_[^/]+\//, '')))
    )(files);

    const startZip = Date.now();
    await zip(artifactPath, filesPathList);
    const { size } = fs.statSync(artifactPath);

    this.serverless.cli.log(
      `Zip service ${this.serverless.service.service} - ${humanSize(size)} [${
        Date.now() - startZip
      } ms]`
    );
    // defined present zip as output artifact
    this.serverless.service.package.artifact = artifactPath;
    return;
  }

  // 2) If individually is set, we'll optimize files and zip per-function
  const packager = await Packagers.get(this.buildOptions.packager);

  // get a list of every function bundle
  const buildResults = this.buildResults;
  const bundlePathList = buildResults.map(b => b.bundlePath);

  // get a list of externals
  const externals = without<string>(this.buildOptions.exclude, this.buildOptions.external);
  const hasExternals = !!externals?.length;

  // get a tree of all production dependencies
  const packagerDependenciesList = hasExternals
    ? await packager.getProdDependencies(this.buildDirPath)
    : {};

  // package each function
  await Promise.all(
    buildResults.map(async ({ func, functionAlias, bundlePath }) => {
      const name = `${this.serverless.service.getServiceName()}-${this.serverless.service.provider.stage}-${functionAlias}`;

      const excludedFiles = bundlePathList.filter(p => !bundlePath.startsWith(p)).map(trimExtension);

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
        .filter(({ localPath }) => {
          // exclude non individual files based on file path (and things that look derived, e.g. foo.js => foo.js.map)
          if (excludedFiles.find(p => localPath.startsWith(p))) return false;

          // exclude files that belong to individual functions
          if (localPath.startsWith('__only_') && !localPath.startsWith(`__only_${name}/`))
            return false;

          // exclude non whitelisted dependencies
          if (localPath.startsWith('node_modules')) {
            // if no externals is set or if the provider is google, we do not need any files from node_modules
            if (!hasExternals || isGoogleProvider) return false;
            if (
              // this is needed for dependencies that maps to a path (like scoped ones)
              !depWhiteList.find(dep => doSharePath(localPath, 'node_modules/' + dep))
            )
              return false;
          }

          return true;
        })
        // remove prefix from individual function extra files
        .map(({ localPath, ...rest }) => ({
          localPath: localPath.replace(`__only_${name}/`, ''),
          ...rest,
        }));

      const startZip = Date.now();
      await zip(artifactPath, filesPathList);

      const { size } = fs.statSync(artifactPath);

      this.serverless.cli.log(
        `Zip function: ${func.name} - ${humanSize(size)} [${Date.now() - startZip} ms]`
      );

      // defined present zip as output artifact
      setFunctionArtifactPath.call(this, func, path.relative(this.serviceDirPath, artifactPath));
    })
  );
}

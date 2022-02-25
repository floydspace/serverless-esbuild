import fs from 'fs-extra';
import globby from 'globby';
import path from 'path';
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
import semver from 'semver';
import EsbuildServerlessPlugin from '.';
import { ONLY_PREFIX, SERVERLESS_FOLDER } from './constants';
import { doSharePath, flatDep, getDepsFromBundle } from './helper';
import * as Packagers from './packagers';
import { IFiles } from './types';
import { humanSize, zip, trimExtension } from './utils';

function setFunctionArtifactPath(this: EsbuildServerlessPlugin, func, artifactPath) {
  const version = this.serverless.getVersion();
  // Serverless changed the artifact path location in version 1.18
  if (semver.lt(version, '1.18.0')) {
    func.artifact = artifactPath;
    func.package = Object.assign({}, func.package, { disable: true });
    this.log.verbose(`${func.name} is packaged by the esbuild plugin. Ignore messages from SLS.`);
  } else {
    func.package = {
      artifact: artifactPath,
    };
  }
}

const excludedFilesDefault = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'package.json'];

export const filterFilesForZipPackage = ({
  files,
  functionAlias,
  includedFiles,
  excludedFiles,
  hasExternals,
  isGoogleProvider,
  depWhiteList,
}: {
  files: IFiles;
  functionAlias: string;
  includedFiles: string[];
  excludedFiles: string[];
  hasExternals: boolean;
  isGoogleProvider: boolean;
  depWhiteList: string[];
}) => {
  return files.filter(({ localPath }) => {
    // if file is present in patterns it must be included
    if (includedFiles.find((file) => file === localPath)) {
      return true;
    }

    // exclude non individual files based on file path (and things that look derived, e.g. foo.js => foo.js.map)
    if (excludedFiles.find((p) => localPath.startsWith(`${p}.`))) return false;

    // exclude files that belong to individual functions
    if (
      localPath.startsWith(ONLY_PREFIX) &&
      !localPath.startsWith(`${ONLY_PREFIX}${functionAlias}/`)
    )
      return false;

    // exclude non whitelisted dependencies
    if (localPath.startsWith('node_modules')) {
      // if no externals is set or if the provider is google, we do not need any files from node_modules
      if (!hasExternals || isGoogleProvider) return false;
      if (
        // this is needed for dependencies that maps to a path (like scoped ones)
        !depWhiteList.find((dep) => doSharePath(localPath, 'node_modules/' + dep))
      )
        return false;
    }

    return true;
  });
};

export async function pack(this: EsbuildServerlessPlugin) {
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
    .filter((p) => !excludedFiles.includes(p))
    .map((localPath) => ({ localPath, rootPath: path.join(this.buildDirPath, localPath) }));

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
    await zip(artifactPath, filesPathList, this.buildOptions.nativeZip);
    const { size } = fs.statSync(artifactPath);

    this.log.verbose(
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
  const bundlePathList = buildResults.map((b) => b.bundlePath);

  let externals = [];

  // get the list of externals to include only if exclude is not set to *
  if (this.buildOptions.exclude !== '*' && !this.buildOptions.exclude.includes('*')) {
    externals = without<string>(this.buildOptions.exclude, this.buildOptions.external);
  }

  const hasExternals = !!externals?.length;

  // get a tree of all production dependencies
  const packagerDependenciesList = hasExternals
    ? await packager.getProdDependencies(this.buildDirPath)
    : {};

  const packageFiles = await globby(this.serverless.service.package.patterns);

  // package each function
  await Promise.all(
    buildResults.map(async ({ func, functionAlias, bundlePath }) => {
      const excludedFiles = bundlePathList
        .filter((p) => !bundlePath.startsWith(p))
        .map(trimExtension);

      const functionFiles = await globby(func.package.patterns);

      const includedFiles = [...packageFiles, ...functionFiles];

      // allowed external dependencies in the final zip
      let depWhiteList = [];

      if (hasExternals) {
        const bundleDeps = getDepsFromBundle(
          path.join(this.buildDirPath, bundlePath),
          this.buildOptions.platform
        );
        const bundleExternals = intersection(bundleDeps, externals);
        depWhiteList = flatDep(packagerDependenciesList.dependencies, bundleExternals);
      }

      const zipName = `${functionAlias}.zip`;
      const artifactPath = path.join(this.workDirPath, SERVERLESS_FOLDER, zipName);

      // filter files
      const filesPathList = filterFilesForZipPackage({
        files,
        functionAlias,
        includedFiles,
        excludedFiles,
        hasExternals,
        isGoogleProvider,
        depWhiteList,
      })
        // remove prefix from individual function extra files
        .map(({ localPath, ...rest }) => ({
          localPath: localPath.replace(`${ONLY_PREFIX}${functionAlias}/`, ''),
          ...rest,
        }));

      const startZip = Date.now();
      await zip(artifactPath, filesPathList, this.buildOptions.nativeZip);

      const { size } = fs.statSync(artifactPath);

      this.log.verbose(
        `Zip function: ${functionAlias} - ${humanSize(size)} [${Date.now() - startZip} ms]`
      );

      // defined present zip as output artifact
      setFunctionArtifactPath.call(this, func, path.relative(this.serviceDirPath, artifactPath));
    })
  );
}

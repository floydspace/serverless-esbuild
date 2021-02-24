import * as archiver from 'archiver';
import * as fs from 'fs-extra';
import * as glob from 'glob';
import * as path from 'path';
import { intersection, isEmpty, path as get, uniq } from 'ramda';
import * as semver from 'semver';
import { SERVERLESS_FOLDER } from '.';
import { doSharePath, flatDep, getDepsFromBundle } from './helper';
import * as Packagers from './packagers';

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

export async function packIndividually() {
  const buildDir = this.serverless.config.servicePath;

  // If individually is not set, ignore this part
  if (!get(['service', 'package', 'individually'], this.serverless)) return null;
  const packager = await Packagers.get(this.buildOptions.packager);

  // get a list of all path in build
  const files = glob.sync('**', {
    cwd: buildDir,
    dot: true,
    silent: true,
    follow: true,
  });

  if (isEmpty(files)) {
    throw new this.serverless.classes.Error('Packaging: No files found');
  }

  // get a list of every function bundle
  const buildResults = this.buildResults;
  const bundlePathList = buildResults.map(b => b.bundlePath);

  // get a list of external dependencies already listed in package.json
  const externals = Object.keys(require(path.join(buildDir, 'package.json')).dependencies);

  // get a tree of all production dependencies
  const { dependencies } = await packager.getProdDependencies(buildDir);

  // package each function
  await Promise.all(
    buildResults.map(async ({ func, bundlePath }) => {
      const startZip = Date.now();
      const name = func.name;

      const excludedFiles = [
        ...excludedFilesDefault,
        ...bundlePathList.filter(p => p !== bundlePath),
      ];

      const bundleDeps = getDepsFromBundle(path.join(buildDir, bundlePath));
      const bundleExternals = intersection(bundleDeps, externals);
      const depWhiteList = flatDep(dependencies, bundleExternals);

      // Create zip and open it
      const zip = archiver.create('zip');
      const zipName = `${name}.zip`;
      const artifactPath = path.join(buildDir, SERVERLESS_FOLDER, zipName);
      this.serverless.utils.writeFileDir(artifactPath);
      const output = fs.createWriteStream(artifactPath);

      // write zip
      output.on('open', () => {
        zip.pipe(output);

        files.forEach((filePath: string) => {
          // exclude non individual files
          if (excludedFiles.includes(filePath)) return;

          // exclude generated zip TODO:better logic
          if (filePath.endsWith('.zip')) return;

          // exclude non whitelisted dependencies
          if (filePath.startsWith('node_modules')) {
            if (
              // this is needed for dependencies that maps to a path (like scopped ones)
              !depWhiteList.find(dep => doSharePath(filePath, 'node_modules/' + dep))
            )
              return;
          }

          // exclude directories
          const fullPath = path.resolve(buildDir, filePath);
          const stats = fs.statSync(fullPath);
          if (stats.isDirectory()) return;

          zip.append(fs.readFileSync(fullPath), {
            name: filePath,
            mode: stats.mode,
            date: new Date(0), // necessary to get the same hash when zipping the same content
          });
        });

        zip.finalize();
      });

      return new Promise((resolve, reject) => {
        output.on('close', () => {
          this.serverless.cli.log(`Zip function: ${func.name} [${Date.now() - startZip} ms]`);

          // defined present zip as output artifact
          setArtifactPath.call(this, func, path.relative(this.originalServicePath, artifactPath));
          resolve(artifactPath);
        });
        zip.on('error', err => reject(err));
      });
    })
  );
}

import * as archiver from 'archiver';
import * as BbPromise from 'bluebird';
import * as fs from 'fs-extra';
import * as glob from 'glob';
import * as path from 'path';
import { isEmpty, path as get } from 'ramda';
import * as semver from 'semver';

function setArtifactPath(func, artifactPath) {
  const version = this.serverless.getVersion();

  // Serverless changed the artifact path location in version 1.18
  if (semver.lt(version, '1.18.0')) {
    func.artifact = artifactPath;
    func.package = Object.assign({}, func.package, { disable: true });
    this.serverless.cli.log(`${func.name} is packaged by the esbuild plugin. Ignore messages from SLS.`);
  } else {
    func.package = {
      artifact: artifactPath
    };
  }
}

function zip(directory: string, name: string): BbPromise<string> {
  const zip = archiver.create('zip');
  // Create artifact in temp path and move it to the package path (if any) later
  const artifactFilePath = path.join(this.serverless.config.servicePath, '.serverless', name);
  this.serverless.utils.writeFileDir(artifactFilePath);

  const output = fs.createWriteStream(artifactFilePath);

  const files = glob.sync('**', {
    cwd: directory,
    dot: true,
    silent: true,
    follow: true
  });

  if (isEmpty(files)) {
    throw new this.serverless.classes.Error('Packaging: No files found');
  }

  output.on('open', () => {
    zip.pipe(output);

    files.forEach(filePath => {
      const fullPath = path.resolve(directory, filePath);

      const stats = fs.statSync(fullPath);

      if (!stats.isDirectory()) {
        zip.append(fs.readFileSync(fullPath), {
          name: filePath,
          mode: stats.mode,
          date: new Date(0) // necessary to get the same hash when zipping the same content
        });
      }
    });

    zip.finalize();
  });

  return new BbPromise((resolve, reject) => {
    output.on('close', () => resolve(artifactFilePath));
    zip.on('error', err => reject(err));
  });
}

export async function packageModules() {
  const artifacts = await BbPromise.map(this.compilerOutputs, async ({outdir, outfile, entryFunction}) => {
    const startZip = Date.now();
    const artifactPath = await zip.call(this, outdir, outfile);

    this.options.verbose &&
    this.serverless.cli.log(
      `Zip ${isEmpty(entryFunction) ? 'service' : 'function'}: ${outdir} [${Date.now() - startZip} ms]`
    );

    if (get(['service', 'package', 'individually'], this.serverless)) {
      setArtifactPath.call(
        this,
        entryFunction,
        path.relative(this.serverless.config.servicePath, artifactPath)
      );
    }
    return artifactPath;
  });

  if (!get(['service', 'package', 'individually'], this.serverless) && !isEmpty(artifacts)) {
    // Set the service artifact to all functions
    const allFunctionNames = this.serverless.service.getAllFunctions();
    allFunctionNames.forEach(funcName => {
      const func = this.serverless.service.getFunction(funcName);
      setArtifactPath.call(this, func, path.relative(this.serverless.config.servicePath, artifacts[0]));
    });
    // For Google set the service artifact path
    if (get(['service', 'provider', 'name'], this.serverless) === 'google') {
      this.serverless.service.package = this.serverless.service.package || {};
      this.serverless.service.package.artifact = path.relative(this.serverless.config.servicePath, artifacts[0]);
    }
  }

  return null;
}

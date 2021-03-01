import * as archiver from 'archiver';
import * as childProcess from 'child_process';
import * as fs from 'fs-extra';
import * as path from 'path';
import { join } from 'ramda';

export class SpawnError extends Error {
  constructor(message: string, public stdout: string, public stderr: string) {
    super(message);
  }

  toString() {
    return `${this.message}\n${this.stderr}`;
  }
}

/**
 * Executes a child process without limitations on stdout and stderr.
 * On error (exit code is not 0), it rejects with a SpawnProcessError that contains the stdout and stderr streams,
 * on success it returns the streams in an object.
 * @param {string} command - Command
 * @param {string[]} [args] - Arguments
 * @param {Object} [options] - Options for child_process.spawn
 */
export function spawnProcess(
  command: string,
  args: string[],
  options: childProcess.SpawnOptionsWithoutStdio
) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = childProcess.spawn(command, args, options);
    let stdout = '';
    let stderr = '';
    // Configure stream encodings
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    // Listen to stream events
    child.stdout.on('data', data => {
      stdout += data;
    });
    child.stderr.on('data', data => {
      stderr += data;
    });
    child.on('error', err => {
      reject(err);
    });
    child.on('close', exitCode => {
      if (exitCode !== 0) {
        reject(
          new SpawnError(
            `${command} ${join(' ', args)} failed with code ${exitCode}`,
            stdout,
            stderr
          )
        );
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

/**
 * Find a file by walking up parent directories
 */
export function findUp(name: string, directory: string = process.cwd()): string | undefined {
  const absoluteDirectory = path.resolve(directory);

  if (fs.existsSync(path.join(directory, name))) {
    return directory;
  }

  const { root } = path.parse(absoluteDirectory);
  if (absoluteDirectory === root) {
    return undefined;
  }

  return findUp(name, path.dirname(absoluteDirectory));
}

/**
 * Forwards `rootDir` or finds project root folder.
 */
export function findProjectRoot(rootDir?: string): string | undefined {
  return rootDir ?? findUp('yarn.lock') ?? findUp('package-lock.json') ?? findUp('package.json');
}

export const humanSize = (size: number) => {
  const i = Math.floor(Math.log(size) / Math.log(1024));
  const sanitized = (size / Math.pow(1024, i)).toFixed(2);
  return `${sanitized} ${['B', 'KB', 'MB', 'GB', 'TB'][i]}`;
};

export const zip = (zipPath: string, filesPathList: { path: string; name: string }[]) => {
  fs.mkdirpSync(path.dirname(zipPath));
  const zip = archiver.create('zip');
  const output = fs.createWriteStream(zipPath);

  // write zip
  output.on('open', () => {
    zip.pipe(output);

    filesPathList.forEach(file => {
      const stats = fs.statSync(file.path);
      if (stats.isDirectory()) return;

      zip.append(fs.readFileSync(file.path), {
        name: file.name,
        mode: stats.mode,
        date: new Date(0), // necessary to get the same hash when zipping the same content
      });
    });

    zip.finalize();
  });

  return new Promise((resolve, reject) => {
    output.on('close', () => {
      resolve(zipPath);
    });
    zip.on('error', err => reject(err));
  });
};

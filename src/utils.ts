import { bestzip } from 'bestzip';
import * as childProcess from 'child_process';
import * as fs from 'fs-extra';
import * as path from 'path';
import { join } from 'ramda';
import { IFiles, IFile } from './types';

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
export function findUp(name: string | string[], directory: string = process.cwd()): string | undefined {
  const absoluteDirectory = path.resolve(directory);

  if (typeof name === 'string') {
    if (fs.existsSync(path.join(directory, name))) {
      return directory;
    }
  } else {
    /* For vs. .forEach so it can exit when we get a hit. */
    for (let x = 0; x < name.length; x++) {
      if (fs.existsSync(path.join(directory, name[x]))) {
        return directory;
      }
    }
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
  return rootDir ?? findUp(['yarn.lock', 'package-lock.json', 'package.json']);
}

export const humanSize = (size: number) => {
  const i = Math.floor(Math.log(size) / Math.log(1024));
  const sanitized = (size / Math.pow(1024, i)).toFixed(2);
  return `${sanitized} ${['B', 'KB', 'MB', 'GB', 'TB'][i]}`;
};

export const zip = (zipPath: string, filesPathList: IFiles, workingDir?: string) => {
  fs.mkdirpSync(path.dirname(zipPath));

  return bestzip({
    source: filesPathList.map((file: IFile) => file.localPath),
    destination: zipPath,
    cwd: workingDir || process.cwd()
  });
};

export function trimExtension(entry: string) {
  return entry.slice(0, -path.extname(entry).length);
}

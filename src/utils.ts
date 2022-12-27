import { bestzip } from 'bestzip';
import archiver from 'archiver';
import childProcess from 'child_process';
import { pipe } from 'fp-ts/lib/function';
import * as IO from 'fp-ts/lib/IO';
import * as IOO from 'fp-ts/lib/IOOption';
import * as TE from 'fp-ts/lib/TaskEither';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

import {
  copyFilesTask,
  mkdirpTask,
  removeTask,
  safeFileExistsIO,
  taskEitherToPromise,
  taskFromPromise,
} from './utils/fp-fs';

import type { IFiles } from './types';

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
export function spawnProcess(command: string, args: string[], options: childProcess.SpawnOptionsWithoutStdio) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = childProcess.spawn(command, args, options);
    let stdout = '';
    let stderr = '';

    // Configure stream encodings
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    // Listen to stream events
    child.stdout.on('data', (data) => {
      stdout += data;
    });
    child.stderr.on('data', (data) => {
      stderr += data;
    });
    child.on('error', (err) => {
      reject(err);
    });
    child.on('close', (exitCode) => {
      if (exitCode !== 0) {
        reject(new SpawnError(`${command} ${args.join(' ')} failed with code ${exitCode}`, stdout, stderr));
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

const rootOf = (p: string) => path.parse(path.resolve(p)).root;
const isPathRoot = (p: string) => rootOf(p) === path.resolve(p);
const findUpIO = (name: string, directory = process.cwd()): IOO.IOOption<string> =>
  pipe(path.resolve(directory), (dir) =>
    pipe(
      safeFileExistsIO(path.join(dir, name)),
      IO.chain((exists: boolean) =>
        exists ? IOO.some(dir) : isPathRoot(dir) ? IOO.none : findUpIO(name, path.dirname(dir))
      )
    )
  );

/**
 * Find a file by walking up parent directories
 */
export const findUp = (name: string) => pipe(findUpIO(name), IOO.toUndefined)();

/**
 * Forwards `rootDir` or finds project root folder.
 */
export const findProjectRoot = (rootDir?: string) =>
  pipe(
    IOO.fromNullable(rootDir),
    IOO.fold(() => findUpIO('yarn.lock'), IOO.of),
    IOO.fold(() => findUpIO('package-lock.json'), IOO.of),
    IOO.toUndefined
  )();

export const humanSize = (size: number) => {
  const exponent = Math.floor(Math.log(size) / Math.log(1024));
  const sanitized = (size / 1024 ** exponent).toFixed(2);

  return `${sanitized} ${['B', 'KB', 'MB', 'GB', 'TB'][exponent]}`;
};

export const zip = async (zipPath: string, filesPathList: IFiles, useNativeZip = false): Promise<void> => {
  // create a temporary directory to hold the final zip structure
  const tempDirName = `${path.basename(zipPath).slice(0, -4)}-${Date.now().toString()}`;
  const tempDirPath = path.join(os.tmpdir(), tempDirName);
  const files = filesPathList.map((file) => file.rootPath);

  const lazyZip = (): Promise<void> =>
    useNativeZip ? bestzip({ source: '*', destination: zipPath, cwd: tempDirPath }) : nodeZip(zipPath, files);

  await pipe(
    // create the random temporary folder
    mkdirpTask(tempDirPath),
    // copy all required files from origin path to (sometimes modified) target path
    TE.chain(() => copyFilesTask(files, tempDirPath)),
    // prepare zip folder
    TE.chain(() => mkdirpTask(path.dirname(zipPath))),
    // zip the temporary directory
    TE.chain(() => taskFromPromise(lazyZip)),
    // delete the temporary folder
    TE.chain(() => removeTask(tempDirPath)),
    taskEitherToPromise
  );
};

function nodeZip(zipPath: string, filesPathList: string[]): Promise<void> {
  const zipArchive = archiver.create('zip');
  const output = fs.createWriteStream(zipPath);

  // write zip
  output.on('open', () => {
    zipArchive.pipe(output);

    filesPathList.forEach((file) => {
      const stats = fs.statSync(file);
      if (stats.isDirectory()) return;

      zipArchive.append(fs.readFileSync(file), {
        name: path.basename(file),
        mode: stats.mode,
        date: new Date(0), // necessary to get the same hash when zipping the same content
      });
    });

    zipArchive.finalize();
  });

  return new Promise((resolve, reject) => {
    output.on('close', resolve);
    zipArchive.on('error', (err) => reject(err));
  });
}

export function trimExtension(entry: string) {
  return entry.slice(0, -path.extname(entry).length);
}

export const isEmpty = (obj: Record<string, unknown>) => {
  // eslint-disable-next-line no-unreachable-loop
  for (const _i in obj) return false;

  return true;
};

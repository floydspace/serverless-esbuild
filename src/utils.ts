import { bestzip } from 'bestzip';
import archiver from 'archiver';
import execa from 'execa';
import { constUndefined, pipe, flow } from '@effect/data/Function';
import * as Option from '@effect/data/Option';
import * as Effect from '@effect/io/Effect';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

import { copyEffect, mkdirpEffect, removeEffect, safeFileExistsEffect } from './utils/effect';

import type { IFile, IFiles } from './types';

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
export function spawnProcess(command: string, args: string[], options: execa.Options) {
  return execa(command, args, options);
}

const rootOf = (p: string) => path.parse(path.resolve(p)).root;
const isPathRoot = (p: string) => rootOf(p) === path.resolve(p);
const findUpEffect = (name: string, directory = process.cwd()): Effect.Effect<never, never, Option.Option<string>> =>
  pipe(path.resolve(directory), (dir) =>
    pipe(
      safeFileExistsEffect(path.join(dir, name)),
      Effect.flatMap((exists: boolean) => {
        if (exists) return Effect.succeed(Option.some(dir));
        if (isPathRoot(dir)) return Effect.succeed(Option.none());
        return findUpEffect(name, path.dirname(dir));
      })
    )
  );

/**
 * Find a file by walking up parent directories
 */
export const findUp = flow(findUpEffect, Effect.someOrElse(constUndefined), Effect.runSync);

/**
 * Forwards `rootDir` or finds project root folder.
 */
export const findProjectRoot = (rootDir?: string) =>
  pipe(
    Effect.sync(() => Option.fromNullable(rootDir)),
    Effect.someOrElseEffect(() =>
      pipe(
        findUpEffect('yarn.lock'),
        Effect.someOrElseEffect(() =>
          pipe(
            findUpEffect('pnpm-lock.yaml'),
            Effect.someOrElseEffect(() => pipe(findUpEffect('package-lock.json'), Effect.someOrElse(constUndefined)))
          )
        )
      )
    ),
    Effect.runSync
  );

export const humanSize = (size: number) => {
  const exponent = Math.floor(Math.log(size) / Math.log(1024));
  const sanitized = (size / 1024 ** exponent).toFixed(2);

  return `${sanitized} ${['B', 'KB', 'MB', 'GB', 'TB'][exponent]}`;
};

export const zip = async (zipPath: string, filesPathList: IFiles, useNativeZip = false): Promise<void> => {
  // create a temporary directory to hold the final zip structure
  const tempDirName = `${path.basename(zipPath).slice(0, -4)}-${Date.now().toString()}`;
  const tempDirPath = path.join(os.tmpdir(), tempDirName);

  const copyFileEffect = (file: IFile) => copyEffect(file.rootPath, path.join(tempDirPath, file.localPath));
  const copyFilesEffect = Effect.forEachPar(copyFileEffect);
  const bestZipEffect = Effect.promise(() => bestzip({ source: '*', destination: zipPath, cwd: tempDirPath }));
  const nodeZipEffect = Effect.promise(() => nodeZip(zipPath, filesPathList));

  await pipe(
    // create the random temporary folder
    mkdirpEffect(tempDirPath),
    // copy all required files from origin path to (sometimes modified) target path
    Effect.tap(() => copyFilesEffect(filesPathList)),
    // prepare zip folder
    Effect.tap(() => mkdirpEffect(path.dirname(zipPath))),
    // zip the temporary directory
    Effect.tap(() => (useNativeZip ? bestZipEffect : nodeZipEffect)),
    // delete the temporary folder
    Effect.tap(() => removeEffect(tempDirPath)),
    Effect.runPromise
  );
};

function nodeZip(zipPath: string, filesPathList: IFiles): Promise<void> {
  const zipArchive = archiver.create('zip');
  const output = fs.createWriteStream(zipPath);

  // write zip
  output.on('open', () => {
    zipArchive.pipe(output);

    filesPathList.forEach((file) => {
      const stats = fs.statSync(file.rootPath);
      if (stats.isDirectory()) return;

      zipArchive.append(fs.readFileSync(file.rootPath), {
        name: file.localPath,
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

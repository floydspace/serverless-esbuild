import { flow } from '@effect/data/Function';
import * as Effect from '@effect/io/Effect';
import { effectify } from '@effect/platform/Effectify';
import fs from 'fs-extra';

export const fileExistsEffect = (path: fs.PathLike) => Effect.try(() => fs.existsSync(path));
export const safeFileExistsEffect = flow(
  fileExistsEffect,
  Effect.catchAll(() => Effect.succeed(false))
);

export const mkdirpEffect: (dir: string) => Effect.Effect<never, Error, void> = effectify(fs.mkdirp);

export const readFileEffect: (file: number | fs.PathLike) => Effect.Effect<never, NodeJS.ErrnoException, Buffer> =
  effectify(fs.readFile);

export const copyEffect: (src: string, dest: string, options?: fs.CopyOptions) => Effect.Effect<never, Error, void> =
  effectify(fs.copy);

export const removeEffect: (dir: string) => Effect.Effect<never, Error, void> = effectify(fs.remove);

export const statEffect: (path: fs.PathLike) => Effect.Effect<never, NodeJS.ErrnoException, fs.Stats> = effectify(
  fs.stat
);

import { constFalse, flow } from 'fp-ts/lib/function';
import type { Lazy } from 'fp-ts/lib/function';
import * as E from 'fp-ts/lib/Either';
import * as IO from 'fp-ts/lib/IO';
import * as IOE from 'fp-ts/lib/IOEither';
import * as TE from 'fp-ts/lib/TaskEither';
import fs from 'fs-extra';

export const ioFromSync = <A>(f: Lazy<A>) => IOE.tryCatch(f, E.toError);
export const taskFromPromise = <A>(f: Lazy<Promise<A>>) => TE.tryCatch(f, E.toError);
export const eitherToPromise = <E, A>(e: E.Either<E, A>) =>
  new Promise<A>((resolve, reject) => {
    E.fold(reject, resolve)(e);
  });
export const taskEitherToPromise = <E, A>(te: TE.TaskEither<E, A>) => te().then(eitherToPromise);

export const fileExistsIO = (path: fs.PathLike) => ioFromSync(() => fs.existsSync(path));
export const safeFileExistsIO = flow(fileExistsIO, IOE.fold(IO.of(constFalse), IO.of));

export const mkdirpIO = (dir: string) => ioFromSync(() => fs.mkdirpSync(dir));
export const mkdirpTask: (dir: string) => TE.TaskEither<Error, void> = TE.taskify(fs.mkdirp);

export const readFileIO = (file: fs.PathOrFileDescriptor) => ioFromSync(() => fs.readFileSync(file));
export const readFileTask: (file: number | fs.PathLike) => TE.TaskEither<NodeJS.ErrnoException, Buffer> = TE.taskify(
  fs.readFile
);

export const copyIO = (src: string, dest: string, options?: fs.CopyOptionsSync) =>
  ioFromSync(() => fs.copySync(src, dest, options));
export const copyTask: (src: string, dest: string, options?: fs.CopyOptions) => TE.TaskEither<Error, void> = TE.taskify(
  fs.copy
);

export const removeIO = (dir: string) => ioFromSync(() => fs.removeSync(dir));
export const removeTask: (dir: string) => TE.TaskEither<Error, void> = TE.taskify(fs.remove);

export const statIO = (path: fs.PathLike) => ioFromSync(() => fs.statSync(path));
export const statTask: (path: fs.PathLike) => TE.TaskEither<NodeJS.ErrnoException, fs.Stats> = TE.taskify(fs.stat);

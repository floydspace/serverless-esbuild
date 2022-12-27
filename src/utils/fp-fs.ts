import { constFalse, flow, Lazy } from 'fp-ts/lib/function';
import * as E from 'fp-ts/lib/Either';
import * as IO from 'fp-ts/lib/IO';
import * as IOE from 'fp-ts/lib/IOEither';
import * as TE from 'fp-ts/lib/TaskEither';
import fs from 'fs-extra';
import path from 'path';

export const ioFromSync = <A>(f: Lazy<A>) => IOE.tryCatch(f, E.toError);
export const taskFromPromise = <A>(f: Lazy<Promise<A>>) => TE.tryCatch(f, E.toError);
export const eitherToPromise = <E, A>(e: E.Either<E, A>) =>
  new Promise<A>((resolve, reject) => E.fold(reject, resolve)(e));
export const taskEitherToPromise = <E, A>(te: TE.TaskEither<E, A>) => te().then(eitherToPromise);

export const fileExistsIO = (path: fs.PathLike) => ioFromSync(() => fs.existsSync(path));
export const safeFileExistsIO = flow(fileExistsIO, IOE.fold(IO.of(constFalse), IO.of));

export const mkdirpIO = (dir: string) => ioFromSync(() => fs.mkdirpSync(dir));
export const mkdirpTask = (dir: string) => taskFromPromise(() => fs.mkdirp(dir));

export const readFileIO = (file: fs.PathOrFileDescriptor) => ioFromSync(() => fs.readFileSync(file));
export const readFileTask = (file: fs.PathOrFileDescriptor) => taskFromPromise(() => fs.readFile(file));

export const copyIO = (src: string, dest: string, options?: fs.CopyOptionsSync) =>
  ioFromSync(() => fs.copySync(src, dest, options));
export const copyTask = (src: string, dest: string, options?: fs.CopyOptions) =>
  taskFromPromise(() => fs.copy(src, dest, options));
export const copyFilesTask = (files: string[], destDir: string) =>
  TE.traverseArray<string, void, Error>((file) => copyTask(file, path.join(destDir, path.basename(file))))(files);

export const removeIO = (dir: string) => ioFromSync(() => fs.removeSync(dir));
export const removeTask = (dir: string) => taskFromPromise(() => fs.remove(dir));

export const statIO = (path: fs.PathLike) => ioFromSync(() => fs.statSync(path));
export const statTask = (path: fs.PathLike) => taskFromPromise(() => fs.stat(path));

import { FileSystem, Error as PlatformError } from '@effect/platform';
import { Effect } from 'effect';
import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';

const FS = Effect.serviceFunctions(FileSystem.FileSystem);

export const makePath = (p: string) => FS.makeDirectory(p, { recursive: true });
export const safeFileExists = (p: string) => FS.exists(p).pipe(Effect.orElseSucceed(() => false));
export const safeFileRemove = (p: string) => FS.remove(p).pipe(Effect.orElse(() => Effect.void));
/**
 * `safeFileRemove` for a directory that is expected to have contents.
 *
 * `FS.remove` is non-recursive by default, so pointing it at a populated directory fails
 * with ENOTEMPTY. Callers here pipe through `Effect.orElse`, which swallows that failure --
 * so a missing `recursive` does not surface as an error, it just silently leaves the
 * directory on disk.
 */
export const safeDirRemove = (p: string) => FS.remove(p, { recursive: true }).pipe(Effect.orElse(() => Effect.void));
export const makeTempPathScoped = (dirName: string) =>
  Effect.acquireRelease(Effect.succeed(path.join(os.tmpdir(), dirName)).pipe(Effect.tap(makePath)), safeDirRemove);

export const FSyncLayer = FileSystem.layerNoop({
  exists: (p) =>
    Effect.try({
      try: () => fs.existsSync(p),
      catch: (error) =>
        PlatformError.SystemError({
          module: 'FileSystem',
          reason: 'Unknown',
          method: 'exists',
          pathOrDescriptor: p,
          message: (error as Error).message,
        }),
    }),
});

export default FS;

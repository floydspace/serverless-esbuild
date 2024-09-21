import { FileSystem, Error as PlatformError } from '@effect/platform';
import { Effect } from 'effect';
import fs from 'fs-extra';

const FS = Effect.serviceFunctions(FileSystem.FileSystem);

export const safeFileExists = (p: string) => FS.exists(p).pipe(Effect.orElseSucceed(() => false));
export const safeFileRemove = (p: string) => FS.remove(p).pipe(Effect.orElse(() => Effect.void));
export const makeTempDirScoped = (p: string) =>
  Effect.acquireRelease(FS.makeDirectory(p, { recursive: true }), () => safeFileRemove(p));

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

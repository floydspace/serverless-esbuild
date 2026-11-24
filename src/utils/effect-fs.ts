import * as NodeFileSystem from '@effect/platform-node/NodeFileSystem';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as FileSystem from 'effect/FileSystem';
import * as Layer from 'effect/Layer';
import * as PlatformError from 'effect/PlatformError';
import fs from 'fs-extra';

export const FSyncLayer = FileSystem.layerNoop({
  exists: (p) =>
    Effect.try({
      try: () => fs.existsSync(p),
      catch: (error) =>
        PlatformError.systemError({
          _tag: 'Unknown',
          module: 'FileSystem',
          method: 'exists',
          pathOrDescriptor: p,
          description: (error as Error).message,
        }),
    }),
});

export class FsUtils extends Context.Service<FsUtils>()('serverless-esbuild/FsUtils', {
  make: Effect.gen(function* () {
    const effectFs = yield* FileSystem.FileSystem;

    const safeFileExists = (p: string) => effectFs.exists(p).pipe(Effect.orElseSucceed(() => false));

    return {
      copy: effectFs.copy,
      makeTempDirectoryScoped: (prefix: string) => effectFs.makeTempDirectoryScoped({ prefix }),
      makePath: (p: string) => effectFs.makeDirectory(p, { recursive: true }),
      anyExists: (paths: string[]) =>
        Effect.all(paths.map(safeFileExists)).pipe(Effect.map((found) => found.some(Boolean))),
    };
  }),
}) {
  /** Requires a `FileSystem` to be provided separately */
  static readonly layerWithoutDependencies = Layer.effect(this, this.make);
  static readonly layer = this.layerWithoutDependencies.pipe(Layer.provide(NodeFileSystem.layer));
  /** Backed by synchronous `fs-extra` calls, so it can be run with `Effect.runSync` */
  static readonly layerSync = this.layerWithoutDependencies.pipe(Layer.provide(FSyncLayer));
}

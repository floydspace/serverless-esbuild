import * as Effect from 'effect/Effect';

import { FsUtils } from '../utils/effect-fs';

// Fail if anything imports the root entry point: it re-exports NodeRedis, which requires the optional `redis` peer.
vi.mock('@effect/platform-node', () => {
  throw new Error('The root entry point loads unrelated peer dependencies such as redis');
});

describe('FsUtils', () => {
  it('uses NodeFileSystem without loading the platform-node root entry point', async () => {
    const exists = Effect.gen(function* () {
      const fsUtils = yield* FsUtils;
      return yield* fsUtils.anyExists([__filename]);
    }).pipe(Effect.provide(FsUtils.layer), Effect.runPromise);

    await expect(exists).resolves.toBe(true);
  });
});

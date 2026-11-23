# Architecture & code conventions

- `src/index.ts` is the plugin class and hooks into package/deploy/offline/invoke-local. Packager implementations are in `src/packagers/`.
- Flow: `src/bundle.ts` runs esbuild, `src/pack-externals.ts` installs `external` dependencies, `src/pack.ts` zips the result.
- The packagers install `external` dependencies for the **user's** service, chosen by `custom.esbuild.packager` (factory in `src/packagers/index.ts`). They are unrelated to this repo's own package manager.
- The packagers, `src/utils/effect-fs.ts`, `src/helper.ts` and `src/bundle.ts` use Effect-TS (`effect` 4.x; platform modules such as `FileSystem` come from `effect` itself, `NodeFileSystem` from `@effect/platform-node`). New code in those areas should use Effect, not plain promises.
- `esbuild` is a peer dependency accepting `0.8 - 0.28`. Guard any esbuild API that older versions lack.
- `pnpm build` compiles with `tsconfig.build.json` (not `tsconfig.json`) into `dist/`.
- Config and option types are in `src/types.ts`. Document any option change in the README options tables.
- `effect` v4 is ESM-only while the plugin builds to CommonJS. That works because tsconfig uses `module: nodenext` (TS >= 5.8) and Node >= 20.19 / 22.12 can `require()` ESM; engines is `>=20.19.0`. Relative dynamic imports need a `.js` extension (see `src/packagers/index.ts`).

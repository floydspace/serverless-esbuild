import fs from 'fs-extra';
import globby from 'globby';
import pMap from 'p-map';

import { filterFilesForZipPackage, pack, copyPreBuiltResources } from '../pack';
import * as utils from '../utils';
import type { EsbuildFunctionDefinitionHandler, FunctionBuildResult } from '../types';
import type EsbuildServerlessPlugin from '../index';
import { SERVERLESS_FOLDER } from '../constants';

vi.mock('globby');
vi.mock('fs-extra');
vi.mock('p-map');

const mockCli = {
  log: vi.fn(),
};

describe('filterFilesForZipPackage', () => {
  it('should filter out files for another zip package', () => {
    expect(
      filterFilesForZipPackage({
        files: [
          {
            localPath: '__only_service-otherFnName/bin/imagemagick/include/ImageMagick/magick/method-attribute.h',
            rootPath:
              '/home/capaj/repos/google/search/.esbuild/.build/__only_service-otherFnName/bin/imagemagick/include/ImageMagick/magick/method-attribute.h',
          },

          {
            localPath: '__only_fnAlias/bin/imagemagick/include/ImageMagick/magick/method-attribute.h',
            rootPath:
              '/home/capaj/repos/google/search/.esbuild/.build/__only_fnAlias/bin/imagemagick/include/ImageMagick/magick/method-attribute.h',
          },
        ],

        depWhiteList: [],
        functionAlias: 'fnAlias',
        isGoogleProvider: false,
        hasExternals: false,
        includedFiles: [],
        excludedFiles: [],
      })
    ).toMatchInlineSnapshot(`
      [
        {
          "localPath": "__only_fnAlias/bin/imagemagick/include/ImageMagick/magick/method-attribute.h",
          "rootPath": "/home/capaj/repos/google/search/.esbuild/.build/__only_fnAlias/bin/imagemagick/include/ImageMagick/magick/method-attribute.h",
        },
      ]
    `);
  });
});

describe('pack', () => {
  beforeEach(() => {
    vi.mocked(globby).sync.mockReturnValue(['hello1.js', 'hello2.js']);
    vi.mocked(globby).mockResolvedValue([]);
    vi.mocked(fs).statSync.mockReturnValue({ size: 123 } as fs.Stats);

    vi.mocked(pMap).mockImplementation((entries, mapper) => {
      return Promise.all((entries as string[]).map((entry, index) => mapper(entry, index)));
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('metafiles', () => {
    function createPlugin(individually: boolean, metafile = true, extension = '.js'): EsbuildServerlessPlugin {
      return {
        buildResults: ['hello1', 'hello2'].map((name) => ({
          bundlePath: `src/${name}${extension}`,
          functionAlias: name,
          func: { handler: `src/${name}.handler`, events: [], package: {} },
        })),
        serverless: {
          service: { service: 'testApp', package: { individually } },
          cli: mockCli,
          getVersion: vi.fn().mockReturnValue('3.28.1'),
        },
        buildOptions: {
          metafile,
          packager: 'yarn',
          exclude: ['aws-sdk'],
          external: [],
          nativeZip: false,
          zipConcurrency: Infinity,
        },
        buildDirPath: '/workdir/.esbuild/.build',
        workDirPath: '/workdir/.esbuild',
        serviceDirPath: '/workdir',
        log: { debug: vi.fn(), verbose: vi.fn() },
      } as unknown as EsbuildServerlessPlugin;
    }

    it.each(['.js', '.mjs', '.cjs'])(
      'should include only the owning function metafile with %s output',
      async (extension) => {
        vi.mocked(globby).sync.mockReturnValue([
          `src/hello1${extension}`,
          `src/hello1${extension}.map`,
          'src/hello1-meta.json',
          `src/hello2${extension}`,
          `src/hello2${extension}.map`,
          'src/hello2-meta.json',
          'assets/user-meta.json',
        ]);
        const zipSpy = vi.spyOn(utils, 'zip').mockResolvedValue();

        await pack.call(createPlugin(true, true, extension));

        for (const [index, name] of ['hello1', 'hello2'].entries()) {
          expect(zipSpy.mock.calls[index]?.[1].map(({ localPath }) => localPath)).toEqual([
            `src/${name}${extension}`,
            `src/${name}${extension}.map`,
            `src/${name}-meta.json`,
            'assets/user-meta.json',
          ]);
        }
      }
    );

    it('should retain all function metafiles in a shared service archive', async () => {
      const files = ['src/hello1.js', 'src/hello1-meta.json', 'src/hello2.js', 'src/hello2-meta.json'];
      vi.mocked(globby).sync.mockReturnValue(files);
      const zipSpy = vi.spyOn(utils, 'zip').mockResolvedValue();

      await pack.call(createPlugin(false));

      expect(zipSpy).toHaveBeenCalledTimes(1);
      expect(zipSpy.mock.calls[0]?.[1].map(({ localPath }) => localPath)).toEqual(files);
    });

    it('should retain the same metafile for functions sharing an entry point', async () => {
      const files = ['src/hello1.js', 'src/hello1-meta.json'];
      vi.mocked(globby).sync.mockReturnValue(files);
      const plugin = createPlugin(true);
      plugin.buildResults = plugin.buildResults?.map((result) => ({ ...result, bundlePath: 'src/hello1.js' }));
      const zipSpy = vi.spyOn(utils, 'zip').mockResolvedValue();

      await pack.call(plugin);

      expect(zipSpy).toHaveBeenCalledTimes(2);
      for (const [, entries] of zipSpy.mock.calls) {
        expect(entries.map(({ localPath }) => localPath)).toEqual(files);
      }
    });

    it('should not exclude similarly named application assets when metafile generation is disabled', async () => {
      vi.mocked(globby).sync.mockReturnValue([
        'src/hello1.js',
        'src/hello1-meta.json',
        'src/hello2.js',
        'src/hello2-meta.json',
      ]);
      const zipSpy = vi.spyOn(utils, 'zip').mockResolvedValue();

      await pack.call(createPlugin(true, false));

      expect(zipSpy.mock.calls[0]?.[1].map(({ localPath }) => localPath)).toEqual([
        'src/hello1.js',
        'src/hello1-meta.json',
        'src/hello2-meta.json',
      ]);
    });
  });

  describe('individually', () => {
    it('should create zips with the functionAlias as the name', async () => {
      const buildResults: FunctionBuildResult[] = [
        {
          bundlePath: 'hello1.js',
          func: {
            handler: 'hello1.handler',
            events: [{ http: { path: 'hello', method: 'get' } }],
            name: 'serverless-example-dev-hello1',
            package: {},
          },
          functionAlias: 'hello1',
        },
        {
          bundlePath: 'hello2.js',
          func: {
            handler: 'hello2.handler',
            events: [{ http: { path: 'hello', method: 'get' } }],
            name: 'serverless-example-dev-hello2',
            package: {},
          },
          functionAlias: 'hello2',
        },
      ];

      const esbuildPlugin = {
        buildResults,
        serverless: {
          service: {
            package: {
              individually: true,
            },
          },
          cli: mockCli,
          getVersion: vi.fn().mockReturnValue('3.28.1'),
        },
        buildOptions: {
          zipConcurrency: Infinity,
          packager: 'yarn',
          exclude: ['aws-sdk'],
          external: [],
          nativeZip: false,
        },
        buildDirPath: '/workdir/serverless-esbuild/examples/individually/.esbuild/.build',
        workDirPath: '/workdir/serverless-esbuild/examples/individually/.esbuild/',
        serviceDirPath: '/workdir/serverless-esbuild/examples/individually',
        log: {
          error: vi.fn(),
          warning: vi.fn(),
          notice: vi.fn(),
          info: vi.fn(),
          debug: vi.fn(),
          verbose: vi.fn(),
          success: vi.fn(),
        },
      } as unknown as EsbuildServerlessPlugin;

      const zipSpy = vi.spyOn(utils, 'zip').mockResolvedValue();

      await pack.call(esbuildPlugin);

      expect(zipSpy).toHaveBeenCalledWith(
        '/workdir/serverless-esbuild/examples/individually/.esbuild/.serverless/hello1.zip',
        expect.any(Array),
        expect.any(Boolean)
      );
      expect(zipSpy).toHaveBeenCalledWith(
        '/workdir/serverless-esbuild/examples/individually/.esbuild/.serverless/hello2.zip',
        expect.any(Array),
        expect.any(Boolean)
      );
    });

    it('should call pMap with the right concurrency', async () => {
      const buildResults: FunctionBuildResult[] = [
        {
          bundlePath: 'hello1.js',
          func: {
            handler: 'hello1.handler',
            events: [{ http: { path: 'hello', method: 'get' } }],
            name: 'serverless-example-dev-hello1',
            package: {},
          },
          functionAlias: 'hello1',
        },
        {
          bundlePath: 'hello2.js',
          func: {
            handler: 'hello2.handler',
            events: [{ http: { path: 'hello', method: 'get' } }],
            name: 'serverless-example-dev-hello2',
            package: {},
          },
          functionAlias: 'hello2',
        },
      ];

      const esbuildPlugin = {
        buildResults,
        serverless: {
          service: {
            package: {
              individually: true,
            },
          },
          cli: mockCli,
          getVersion: vi.fn().mockReturnValue('3.28.1'),
        },
        buildOptions: {
          zipConcurrency: Infinity,
          packager: 'yarn',
          exclude: ['aws-sdk'],
          external: [],
          nativeZip: false,
        },
        buildDirPath: '/workdir/serverless-esbuild/examples/individually/.esbuild/.build',
        workDirPath: '/workdir/serverless-esbuild/examples/individually/.esbuild/',
        serviceDirPath: '/workdir/serverless-esbuild/examples/individually',
        log: {
          error: vi.fn(),
          warning: vi.fn(),
          notice: vi.fn(),
          info: vi.fn(),
          debug: vi.fn(),
          verbose: vi.fn(),
          success: vi.fn(),
        },
      } as unknown as EsbuildServerlessPlugin;

      await pack.call(esbuildPlugin);

      expect(pMap).toHaveBeenCalledWith(expect.any(Array), expect.any(Function), {
        concurrency: Infinity,
      });
    });
  });
});

describe('copyPreBuiltResources', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });
  function getMockEsbuildPlugin(bundleIndividually = true): EsbuildServerlessPlugin {
    return {
      functions: {
        hello1: { handler: 'hello1.handler', events: [], package: { artifact: 'hello1' }, skipEsbuild: true },
        hello2: { handler: 'hello2.handler', events: [], package: { artifact: 'hello2' }, skipEsbuild: true },
      },
      serverless: {
        service: {
          service: 'testApp',
          package: {
            individually: bundleIndividually,
          },
        },
        cli: mockCli,
        getVersion: vi.fn().mockReturnValue('3.28.1'),
      },
      buildOptions: {
        zipConcurrency: Infinity,
        packager: 'yarn',
        exclude: ['aws-sdk'],
        external: [],
        nativeZip: false,
      },
      buildDirPath: '/workdir/serverless-esbuild/examples/individually/.esbuild/.build',
      workDirPath: '/workdir/serverless-esbuild/examples/individually/.esbuild/',
      serviceDirPath: '/workdir/serverless-esbuild/examples/individually',
      packageOutputPath: '/workdir/serverless-esbuild/examples/minimal',
      log: {
        error: vi.fn(),
        warning: vi.fn(),
        notice: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        verbose: vi.fn(),
        success: vi.fn(),
      },
    } as unknown as EsbuildServerlessPlugin;
  }

  it('should copy the single artifact if not bundling individually', async () => {
    const mockEsbuildPlugin = getMockEsbuildPlugin(false);

    await copyPreBuiltResources.call(mockEsbuildPlugin);

    expect(mockEsbuildPlugin.serverless.service.package.artifact).toEqual(
      `${mockEsbuildPlugin.workDirPath}${SERVERLESS_FOLDER}/${mockEsbuildPlugin.serverless.service.service}.zip`
    );
    expect(fs.copy).toHaveBeenCalledTimes(1);
  });

  it('should copy the artifacts for all of the functions when bundling individually', async () => {
    const mockEsbuildPlugin = getMockEsbuildPlugin();

    await copyPreBuiltResources.call(mockEsbuildPlugin);

    expect(mockEsbuildPlugin.serverless.service.package.artifact).not.toBeDefined();
    expect(fs.copy).toHaveBeenCalledTimes(2);
    Object.keys(mockEsbuildPlugin.functions).forEach((functionAlias) => {
      const func = mockEsbuildPlugin.functions[functionAlias];
      expect(func?.package?.artifact).toEqual(`.esbuild/${SERVERLESS_FOLDER}/${functionAlias}.zip`);
    });
  });

  it('should not copy over artifacts for functions where `skipEsBuild` is false', async () => {
    const mockEsbuildPlugin = getMockEsbuildPlugin();
    mockEsbuildPlugin.functions.hello3 = {
      handler: 'hello3.handler',
      events: [],
      package: { artifact: 'hello3' },
      skipEsbuild: false,
    } as EsbuildFunctionDefinitionHandler;

    await copyPreBuiltResources.call(mockEsbuildPlugin);

    expect(mockEsbuildPlugin.serverless.service.package.artifact).not.toBeDefined();
    expect(fs.copy).toHaveBeenCalledTimes(2);
    Object.keys(mockEsbuildPlugin.functions).forEach((functionAlias) => {
      const func = mockEsbuildPlugin.functions[functionAlias] as EsbuildFunctionDefinitionHandler;
      if (func.skipEsbuild) {
        expect(func?.package?.artifact).toEqual(`.esbuild/${SERVERLESS_FOLDER}/${functionAlias}.zip`);
      }
    });
  });
});

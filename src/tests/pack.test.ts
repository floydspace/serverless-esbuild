import fs from 'fs-extra';
import globby from 'globby';
import pMap from 'p-map';

import { filterFilesForZipPackage, pack, copyPreBuiltResources } from '../pack';
import * as utils from '../utils';
import type { EsbuildFunctionDefinitionHandler, FunctionBuildResult } from '../types';
import type EsbuildServerlessPlugin from '../index';
import { SERVERLESS_FOLDER } from '../constants';

jest.mock('globby');
jest.mock('fs-extra');
jest.mock('p-map');

const mockCli = {
  log: jest.fn(),
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
    jest.mocked(globby).sync.mockReturnValue(['hello1.js', 'hello2.js']);
    jest.mocked(globby).mockResolvedValue([]);
    jest.mocked(fs).statSync.mockReturnValue({ size: 123 } as fs.Stats);

    jest.mocked(pMap).mockImplementation((entries, mapper) => {
      return Promise.all((entries as string[]).map((entry, index) => mapper(entry, index)));
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
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
          getVersion: jest.fn().mockReturnValue('3.28.1'),
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
          error: jest.fn(),
          warning: jest.fn(),
          notice: jest.fn(),
          info: jest.fn(),
          debug: jest.fn(),
          verbose: jest.fn(),
          success: jest.fn(),
        },
      } as unknown as EsbuildServerlessPlugin;

      const zipSpy = jest.spyOn(utils, 'zip').mockResolvedValue();

      await pack.call(esbuildPlugin);

      expect(zipSpy).toBeCalledWith(
        '/workdir/serverless-esbuild/examples/individually/.esbuild/.serverless/hello1.zip',
        expect.any(Array),
        expect.any(Boolean)
      );
      expect(zipSpy).toBeCalledWith(
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
          getVersion: jest.fn().mockReturnValue('3.28.1'),
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
          error: jest.fn(),
          warning: jest.fn(),
          notice: jest.fn(),
          info: jest.fn(),
          debug: jest.fn(),
          verbose: jest.fn(),
          success: jest.fn(),
        },
      } as unknown as EsbuildServerlessPlugin;

      await pack.call(esbuildPlugin);

      expect(pMap).toBeCalledWith(expect.any(Array), expect.any(Function), {
        concurrency: Infinity,
      });
    });
  });
});

describe('copyPreBuiltResources', () => {
  afterEach(() => {
    jest.clearAllMocks();
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
        getVersion: jest.fn().mockReturnValue('3.28.1'),
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
        error: jest.fn(),
        warning: jest.fn(),
        notice: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
        verbose: jest.fn(),
        success: jest.fn(),
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

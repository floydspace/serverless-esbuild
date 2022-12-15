import { filterFilesForZipPackage, pack } from '../pack';
import * as utils from '../utils';

import fs from 'fs-extra';
import globby from 'globby';

import type { FunctionBuildResult } from '../types';

jest.mock('globby');
jest.mock('fs-extra');

const mockCli = {
  log: jest.fn(),
};

describe('filterFilesForZipPackage', () => {
  it('should filter out files for another zip package', () => {
    expect(
      filterFilesForZipPackage({
        allPatternFilesToIncludedFiles: [
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
  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('individually', () => {
    it('should create zips with the functionAlias as the name', async () => {
      const zipSpy = jest.spyOn(utils, 'zip').mockResolvedValue();
      jest.mocked(globby).sync.mockReturnValue(['hello1.js', 'hello2.js']);
      jest.mocked(globby).mockResolvedValue([]);
      jest.mocked(fs).statSync.mockReturnValue({ size: 123 } as fs.Stats);

      const buildResults: FunctionBuildResult[] = [
        {
          bundlePath: 'hello1.js',
          func: {
            handler: 'hello1.handler',
            events: [{ http: { path: 'hello', method: 'get' } }],
            name: 'serverless-example-dev-hello1',
            package: { patterns: [] },
          },
          functionAlias: 'hello1',
        },
        {
          bundlePath: 'hello2.js',
          func: {
            handler: 'hello2.handler',
            events: [{ http: { path: 'hello', method: 'get' } }],
            name: 'serverless-example-dev-hello2',
            package: { patterns: [] },
          },
          functionAlias: 'hello2',
        },
      ];

      const esbuildPlugin = {
        serverless: {
          service: {
            package: {
              individually: true,
            },
          },
          cli: mockCli,
          getVersion: jest.fn().mockReturnValue('1.19.0'),
        },
        buildOptions: {
          packager: 'yarn',
          exclude: ['aws-sdk'],
          external: [],
          nativeZip: false,
        },
        buildDirPath: '/workdir/serverless-esbuild/examples/individually/.esbuild/.build',
        workDirPath: '/workdir/serverless-esbuild/examples/individually/.esbuild/',
        serviceDirPath: '/workdir/serverless-esbuild/examples/individually',
        buildResults,
        log: {
          error: jest.fn(),
          warning: jest.fn(),
          notice: jest.fn(),
          info: jest.fn(),
          debug: jest.fn(),
          verbose: jest.fn(),
          success: jest.fn(),
        },
      };

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
  });
});

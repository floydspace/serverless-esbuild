import { FunctionBuildResult } from '..';
import { filterFilesForZipPackage, pack } from '../pack';
import * as utils from '../utils';

import * as fs from 'fs-extra';
import * as globby from 'globby';
import { mocked } from 'ts-jest/utils';

jest.mock('globby');
jest.mock('fs-extra');

const mockCli = {
  log: jest.fn(),
};

describe('filterFilesForZipPackage', () => {
  it('should filter out files for another zip package', () => {
    expect(
      filterFilesForZipPackage({
        files: [
          {
            localPath:
              '__only_service-otherFnName/bin/imagemagick/include/ImageMagick/magick/method-attribute.h',
            rootPath:
              '/home/capaj/repos/google/search/.esbuild/.build/__only_service-otherFnName/bin/imagemagick/include/ImageMagick/magick/method-attribute.h',
          },
          {
            localPath:
              '__only_service-fnName/bin/imagemagick/include/ImageMagick/magick/method-attribute.h',
            rootPath:
              '/home/capaj/repos/google/search/.esbuild/.build/__only_service-fnName/bin/imagemagick/include/ImageMagick/magick/method-attribute.h',
          },
        ],
        depWhiteList: [],
        fnName: 'service-fnName',
        isGoogleProvider: false,
        hasExternals: false,
        includedFiles: [],
        excludedFiles: [],
      })
    ).toMatchInlineSnapshot(`
      Array [
        Object {
          "localPath": "__only_service-fnName/bin/imagemagick/include/ImageMagick/magick/method-attribute.h",
          "rootPath": "/home/capaj/repos/google/search/.esbuild/.build/__only_service-fnName/bin/imagemagick/include/ImageMagick/magick/method-attribute.h",
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
    it('should create zips with the same name as the function', async () => {
      const zipSpy = jest.spyOn(utils, 'zip').mockResolvedValue();
      mocked(globby, true).sync.mockReturnValue(['hello1.js', 'hello2.js']);
      mocked(globby).mockResolvedValue([]);
      mocked(fs).statSync.mockReturnValue({ size: 123 } as fs.Stats);

      const buildResults: FunctionBuildResult[] = [
        {
          result: { errors: [], warnings: [] },
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
          result: { errors: [], warnings: [] },
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
      };

      await pack.call(esbuildPlugin);

      expect(zipSpy).toBeCalledWith(
        '/workdir/serverless-esbuild/examples/individually/.esbuild/.serverless/serverless-example-dev-hello1.zip',
        expect.any(Array),
        expect.any(Boolean)
      );
      expect(zipSpy).toBeCalledWith(
        '/workdir/serverless-esbuild/examples/individually/.esbuild/.serverless/serverless-example-dev-hello2.zip',
        expect.any(Array),
        expect.any(Boolean)
      );
    });
  });
});

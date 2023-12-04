import fs from 'fs-extra';
import os from 'os';
import path from 'path';

import { extractFunctionEntries, flatDep, getDepsFromBundle, isESM, stripEntryResolveExtensions } from '../helper';

import type { Configuration, DependencyMap, IFile } from '../types';

jest.mock('fs-extra');

afterAll(() => {
  jest.resetAllMocks();
});

describe('extractFunctionEntries', () => {
  const cwd = process.cwd();

  describe('aws', () => {
    it('should return entries for handlers which reference files in the working directory', () => {
      jest.mocked(fs.existsSync).mockReturnValue(true);
      const functionDefinitions = {
        function1: {
          events: [],
          handler: 'file1.handler',
        },
        function2: {
          events: [],
          handler: 'file2.handler',
        },
      };

      const fileNames = extractFunctionEntries(cwd, 'aws', functionDefinitions);

      expect(fileNames).toStrictEqual([
        {
          entry: 'file1.ts',
          func: functionDefinitions.function1,
          functionAlias: 'function1',
        },
        {
          entry: 'file2.ts',
          func: functionDefinitions.function2,
          functionAlias: 'function2',
        },
      ]);
    });

    it('should return entries for handlers which reference directories that contain index files', () => {
      jest.mocked(fs.existsSync).mockImplementation((fPath) => {
        return typeof fPath !== 'string' || fPath.endsWith('/index.ts');
      });

      const functionDefinitions = {
        function1: {
          events: [],
          handler: 'dir1.handler',
        },
        function2: {
          events: [],
          handler: 'dir2.handler',
        },
      };

      const fileNames = extractFunctionEntries(cwd, 'aws', functionDefinitions);

      expect(fileNames).toStrictEqual([
        {
          entry: 'dir1/index.ts',
          func: functionDefinitions.function1,
          functionAlias: 'function1',
        },
        {
          entry: 'dir2/index.ts',
          func: functionDefinitions.function2,
          functionAlias: 'function2',
        },
      ]);
    });

    it('should return entries for handlers which reference files in folders in the working directory', () => {
      jest.mocked(fs.existsSync).mockReturnValue(true);
      const functionDefinitions = {
        function1: {
          events: [],
          handler: 'folder/file1.handler',
        },
        function2: {
          events: [],
          handler: 'folder/file2.handler',
        },
      };

      const fileNames = extractFunctionEntries(cwd, 'aws', functionDefinitions);

      expect(fileNames).toStrictEqual([
        {
          entry: 'folder/file1.ts',
          func: functionDefinitions.function1,
          functionAlias: 'function1',
        },
        {
          entry: 'folder/file2.ts',
          func: functionDefinitions.function2,
          functionAlias: 'function2',
        },
      ]);
    });

    it('should return entries for handlers which reference files using a relative path in the working directory', () => {
      jest.mocked(fs.existsSync).mockReturnValue(true);
      const functionDefinitions = {
        function1: {
          events: [],
          handler: './file1.handler',
        },
        function2: {
          events: [],
          handler: './file2.handler',
        },
      };

      const fileNames = extractFunctionEntries(cwd, 'aws', functionDefinitions);

      expect(fileNames).toStrictEqual([
        {
          entry: 'file1.ts',
          func: functionDefinitions.function1,
          functionAlias: 'function1',
        },
        {
          entry: 'file2.ts',
          func: functionDefinitions.function2,
          functionAlias: 'function2',
        },
      ]);
    });

    it('should allow resolve extensions custom Esbuild setting', () => {
      jest.mocked(fs.existsSync).mockReturnValue(true);
      const functionDefinitions = {
        function1: {
          events: [],
          handler: './file1.handler',
        },
        function2: {
          events: [],
          handler: './file2.handler',
        },
      };

      const fileNames = extractFunctionEntries(cwd, 'aws', functionDefinitions, ['.custom.ts']);

      expect(fileNames).toStrictEqual([
        {
          entry: 'file1.custom.ts',
          func: functionDefinitions.function1,
          functionAlias: 'function1',
        },
        {
          entry: 'file2.custom.ts',
          func: functionDefinitions.function2,
          functionAlias: 'function2',
        },
      ]);
    });

    it('should not return entries for handlers which have skipEsbuild set to true', async () => {
      jest.mocked(fs.existsSync).mockReturnValue(true);
      const functionDefinitions = {
        function1: {
          events: [],
          handler: 'file1.handler',
        },
        function2: {
          events: [],
          handler: 'file2.handler',
          skipEsbuild: true,
        },
      };

      const fileNames = extractFunctionEntries(cwd, 'aws', functionDefinitions);

      expect(fileNames).toStrictEqual([
        {
          entry: 'file1.ts',
          func: functionDefinitions.function1,
          functionAlias: 'function1',
        },
      ]);
    });

    it('should return entries for handlers on a Windows platform', () => {
      jest.mocked(fs.existsSync).mockReturnValue(true);
      jest.spyOn(path, 'relative').mockReturnValueOnce('src\\file1.ts');
      jest.spyOn(os, 'platform').mockReturnValueOnce('win32');
      const functionDefinitions = {
        function1: {
          events: [],
          handler: 'file1.handler',
        },
      };

      const fileNames = extractFunctionEntries(cwd, 'aws', functionDefinitions);

      expect(fileNames).toStrictEqual([
        {
          entry: 'src/file1.ts',
          func: functionDefinitions.function1,
          functionAlias: 'function1',
        },
      ]);
    });

    it('should throw an error if the handlers reference a file which does not exist', () => {
      jest.mocked(fs.existsSync).mockReturnValue(false);
      const functionDefinitions = {
        function1: {
          events: [],
          handler: 'file1.handler',
        },
        function2: {
          events: [],
          handler: 'file2.handler',
        },
      };

      expect(() => extractFunctionEntries(cwd, 'aws', functionDefinitions)).toThrowError();
    });
  });

  describe('azure', () => {
    it('should return entries for handlers which reference files in the working directory', () => {
      jest.mocked(fs.existsSync).mockReturnValue(true);
      const functionDefinitions = {
        function1: {
          events: [],
          handler: 'file1.handler',
        },
        function2: {
          events: [],
          handler: 'file2.handler',
        },
      };

      const fileNames = extractFunctionEntries(cwd, 'azure', functionDefinitions);

      expect(fileNames).toStrictEqual([
        {
          entry: 'file1.ts',
          func: functionDefinitions.function1,
          functionAlias: 'function1',
        },
        {
          entry: 'file2.ts',
          func: functionDefinitions.function2,
          functionAlias: 'function2',
        },
      ]);
    });

    it('should return entries for handlers which reference directories that contain index files', () => {
      jest.mocked(fs.existsSync).mockImplementation((fPath) => {
        return typeof fPath !== 'string' || fPath.endsWith('/index.ts');
      });

      const functionDefinitions = {
        function1: {
          events: [],
          handler: 'dir1.handler',
        },
        function2: {
          events: [],
          handler: 'dir2.handler',
        },
      };

      const fileNames = extractFunctionEntries(cwd, 'azure', functionDefinitions);

      expect(fileNames).toStrictEqual([
        {
          entry: 'dir1/index.ts',
          func: functionDefinitions.function1,
          functionAlias: 'function1',
        },
        {
          entry: 'dir2/index.ts',
          func: functionDefinitions.function2,
          functionAlias: 'function2',
        },
      ]);
    });

    it('should return entries for handlers which reference files in folders in the working directory', () => {
      jest.mocked(fs.existsSync).mockReturnValue(true);
      const functionDefinitions = {
        function1: {
          events: [],
          handler: 'folder/file1.handler',
        },
        function2: {
          events: [],
          handler: 'folder/file2.handler',
        },
      };

      const fileNames = extractFunctionEntries(cwd, 'azure', functionDefinitions);

      expect(fileNames).toStrictEqual([
        {
          entry: 'folder/file1.ts',
          func: functionDefinitions.function1,
          functionAlias: 'function1',
        },
        {
          entry: 'folder/file2.ts',
          func: functionDefinitions.function2,
          functionAlias: 'function2',
        },
      ]);
    });

    it('should return entries for handlers which reference files using a relative path in the working directory', () => {
      jest.mocked(fs.existsSync).mockReturnValue(true);
      const functionDefinitions = {
        function1: {
          events: [],
          handler: './file1.handler',
        },
        function2: {
          events: [],
          handler: './file2.handler',
        },
      };

      const fileNames = extractFunctionEntries(cwd, 'azure', functionDefinitions);

      expect(fileNames).toStrictEqual([
        {
          entry: 'file1.ts',
          func: functionDefinitions.function1,
          functionAlias: 'function1',
        },
        {
          entry: 'file2.ts',
          func: functionDefinitions.function2,
          functionAlias: 'function2',
        },
      ]);
    });

    it('should return entries for handlers on a Windows platform', () => {
      jest.mocked(fs.existsSync).mockReturnValue(true);
      jest.spyOn(path, 'relative').mockReturnValueOnce('src\\file1.ts');
      jest.spyOn(os, 'platform').mockReturnValueOnce('win32');
      const functionDefinitions = {
        function1: {
          events: [],
          handler: 'file1.handler',
        },
      };

      const fileNames = extractFunctionEntries(cwd, 'azure', functionDefinitions);

      expect(fileNames).toStrictEqual([
        {
          entry: 'src/file1.ts',
          func: functionDefinitions.function1,
          functionAlias: 'function1',
        },
      ]);
    });

    it('should throw an error if the handlers reference a file which does not exist', () => {
      jest.mocked(fs.existsSync).mockReturnValue(false);
      const functionDefinitions = {
        function1: {
          events: [],
          handler: 'file1.handler',
        },
        function2: {
          events: [],
          handler: 'file2.handler',
        },
      };

      expect(() => extractFunctionEntries(cwd, 'azure', functionDefinitions)).toThrowError();
    });
  });
});

describe('getDepsFromBundle', () => {
  const inputPath = './';

  describe('require statements', () => {
    it('should extract deps from a string', () => {
      jest.mocked(fs).readFileSync.mockReturnValue(`
        require("@scope/package1");
        require("package2");
        function req3() {
          return require('package3');
        }
      `);
      expect(getDepsFromBundle(inputPath, false)).toStrictEqual(['@scope/package1', 'package2', 'package3']);
    });

    it('should extract the base dep from a string', () => {
      jest
        .mocked(fs)
        .readFileSync.mockReturnValue(
          'require("@scope/package1/subpath");require("package2/subpath");require("@scope/package3/subpath/subpath");require("package4/subpath/subpath")'
        );
      expect(getDepsFromBundle(inputPath, false)).toStrictEqual([
        '@scope/package1',
        'package2',
        '@scope/package3',
        'package4',
      ]);
    });

    it('should remove duplicate package requires', () => {
      jest
        .mocked(fs)
        .readFileSync.mockReturnValue('require("package1/subpath");require("package1");require("package1")');
      expect(getDepsFromBundle(inputPath, false)).toStrictEqual(['package1']);
    });
  });

  describe('import statements', () => {
    it('should extract deps from a string', () => {
      jest.mocked(fs).readFileSync.mockReturnValue(
        `
        import * as n from "package1";
        import "package2";
        import {hello as r} from "package3";

        function dynamicImport() {
          return import('package4');
        }
        `
      );
      expect(getDepsFromBundle(inputPath, true)).toStrictEqual(['package1', 'package2', 'package3', 'package4']);
    });

    it('should extract deps from a minified string', () => {
      jest
        .mocked(fs)
        .readFileSync.mockReturnValue('import*as n from"package1";import"package2";import{hello as r}from"package3";');
      expect(getDepsFromBundle(inputPath, true)).toStrictEqual(['package1', 'package2', 'package3']);
    });
  });
});

describe('isESM', () => {
  it('should return true when format is set to esm', () => {
    const config = {
      format: 'esm',
    } as Partial<Configuration> as Configuration;

    expect(isESM(config)).toBe(true);
  });

  it('should return true when platform is set to neutral and format is not set', () => {
    const config = {
      platform: 'neutral',
    } as Partial<Configuration> as Configuration;

    expect(isESM(config)).toBe(true);
  });

  it('should return false when platform is set to node and format is not set', () => {
    const config = {
      platform: 'node',
    } as Partial<Configuration> as Configuration;

    expect(isESM(config)).toBe(false);
  });
});

describe('flatDeps', () => {
  describe('basic', () => {
    it('should pull all the dependencies from samchungy-a and samchungy-b', () => {
      const depMap: DependencyMap = {
        'samchungy-a': {
          dependencies: {
            'samchungy-dep-a': {
              isRootDep: true,
              version: '1.0.0',
            },
          },
          version: '2.0.0',
        },
        'samchungy-b': {
          dependencies: {
            'samchungy-dep-a': {
              version: '2.0.0',
            },
          },
          version: '2.0.0',
        },
        'samchungy-dep-a': {
          version: '1.0.0',
        },
      };

      const expectedResult: string[] = ['samchungy-a', 'samchungy-dep-a', 'samchungy-b'];

      const result = flatDep(depMap, ['samchungy-a', 'samchungy-b']);

      expect(result).toStrictEqual(expectedResult);
    });

    it('should pull only the dependencies of samchungy-b', () => {
      const depMap: DependencyMap = {
        'samchungy-a': {
          dependencies: {
            'samchungy-dep-a': {
              isRootDep: true,
              version: '1.0.0',
            },
          },
          version: '2.0.0',
        },
        'samchungy-b': {
          dependencies: {
            'samchungy-dep-a': {
              version: '2.0.0',
            },
          },
          version: '2.0.0',
        },
        'samchungy-dep-a': {
          version: '1.0.0',
        },
      };

      const expectedResult: string[] = ['samchungy-b'];

      const result = flatDep(depMap, ['samchungy-b']);

      expect(result).toStrictEqual(expectedResult);
    });
  });

  describe('deduped', () => {
    it('should pull all the dependencies from samchungy-a and samchungy-b', () => {
      const depMap: DependencyMap = {
        'samchungy-a': {
          version: '3.0.0',
          dependencies: {
            'samchungy-dep-b': { version: '3.0.0', isRootDep: true },
          },
        },
        'samchungy-b': {
          version: '5.0.0',
          dependencies: {
            'samchungy-dep-b': { version: '3.0.0', isRootDep: true },
          },
        },
        'samchungy-dep-b': {
          version: '3.0.0',
          dependencies: {
            'samchungy-dep-c': { version: '^1.0.0', isRootDep: true },
            'samchungy-dep-d': { version: '^1.0.0', isRootDep: true },
          },
        },
        'samchungy-dep-c': {
          version: '1.0.0',
          dependencies: {
            'samchungy-dep-e': { version: '^1.0.0', isRootDep: true },
          },
        },
        'samchungy-dep-d': {
          version: '1.0.0',
          dependencies: {
            'samchungy-dep-e': { version: '^1.0.0', isRootDep: true },
          },
        },
        'samchungy-dep-e': { version: '1.0.0' },
      };

      const expectedResult: string[] = [
        'samchungy-a',
        'samchungy-dep-b',
        'samchungy-dep-c',
        'samchungy-dep-e',
        'samchungy-dep-d',
        'samchungy-b',
      ];

      const result = flatDep(depMap, ['samchungy-a', 'samchungy-b']);

      expect(result).toStrictEqual(expectedResult);
    });

    it('should pull only the dependencies from samchungy-a', () => {
      const depMap: DependencyMap = {
        'samchungy-a': {
          version: '3.0.0',
          dependencies: {
            'samchungy-dep-b': { version: '3.0.0', isRootDep: true },
          },
        },
        'samchungy-b': {
          version: '5.0.0',
          dependencies: {
            'samchungy-dep-b': { version: '3.0.0', isRootDep: true },
          },
        },
        'samchungy-dep-b': {
          version: '3.0.0',
          dependencies: {
            'samchungy-dep-c': { version: '^1.0.0', isRootDep: true },
            'samchungy-dep-d': { version: '^1.0.0', isRootDep: true },
          },
        },
        'samchungy-dep-c': {
          version: '1.0.0',
          dependencies: {
            'samchungy-dep-e': { version: '^1.0.0', isRootDep: true },
          },
        },
        'samchungy-dep-d': {
          version: '1.0.0',
          dependencies: {
            'samchungy-dep-e': { version: '^1.0.0', isRootDep: true },
          },
        },
        'samchungy-dep-e': { version: '1.0.0' },
      };

      const expectedResult: string[] = [
        'samchungy-a',
        'samchungy-dep-b',
        'samchungy-dep-c',
        'samchungy-dep-e',
        'samchungy-dep-d',
        'samchungy-b',
      ];

      const result = flatDep(depMap, ['samchungy-a', 'samchungy-b']);

      expect(result).toStrictEqual(expectedResult);
    });
  });
});

describe('stripEntryResolveExtensions', () => {
  it('should remove custom extension prefixes', () => {
    const result = stripEntryResolveExtensions({ localPath: 'test.custom.js' } as IFile, ['.custom.js']);
    expect(result.localPath).toEqual('test.js');
  });

  it('should ignore prefixes not inside the resolve extensions list', () => {
    const result = stripEntryResolveExtensions({ localPath: 'test.other.js' } as IFile, ['.custom.js']);
    expect(result.localPath).toEqual('test.other.js');
  });
});

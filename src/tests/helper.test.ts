import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { mocked } from 'ts-jest/utils';

import { extractFileNames, flatDep, getDepsFromBundle } from '../helper';
import { DependencyMap } from '../types';

jest.mock('fs-extra');

const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

afterEach(() => {
  jest.resetAllMocks();
});

describe('extractFileNames', () => {
  const cwd = process.cwd();

  describe('aws', () => {
    it('should return entries for handlers which reference files in the working directory', () => {
      mocked(fs.existsSync).mockReturnValue(true);
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

      const fileNames = extractFileNames(cwd, 'aws', functionDefinitions);

      expect(fileNames).toStrictEqual([
        {
          entry: 'file1.ts',
          func: functionDefinitions['function1'],
          functionAlias: 'function1',
        },
        {
          entry: 'file2.ts',
          func: functionDefinitions['function2'],
          functionAlias: 'function2',
        },
      ]);
    });

    it('should return entries for handlers which reference files in folders in the working directory', () => {
      mocked(fs.existsSync).mockReturnValue(true);
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

      const fileNames = extractFileNames(cwd, 'aws', functionDefinitions);

      expect(fileNames).toStrictEqual([
        {
          entry: 'folder/file1.ts',
          func: functionDefinitions['function1'],
          functionAlias: 'function1',
        },
        {
          entry: 'folder/file2.ts',
          func: functionDefinitions['function2'],
          functionAlias: 'function2',
        },
      ]);
    });

    it('should return entries for handlers which reference files using a relative path in the working directory', () => {
      mocked(fs.existsSync).mockReturnValue(true);
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

      const fileNames = extractFileNames(cwd, 'aws', functionDefinitions);

      expect(fileNames).toStrictEqual([
        {
          entry: 'file1.ts',
          func: functionDefinitions['function1'],
          functionAlias: 'function1',
        },
        {
          entry: 'file2.ts',
          func: functionDefinitions['function2'],
          functionAlias: 'function2',
        },
      ]);
    });

    it('should return entries for handlers on a Windows platform', () => {
      mocked(fs.existsSync).mockReturnValue(true);
      jest.spyOn(path, 'relative').mockReturnValueOnce('src\\file1.ts');
      jest.spyOn(os, 'platform').mockReturnValueOnce('win32');
      const functionDefinitions = {
        function1: {
          events: [],
          handler: 'file1.handler',
        },
      };

      const fileNames = extractFileNames(cwd, 'aws', functionDefinitions);

      expect(fileNames).toStrictEqual([
        {
          entry: 'src/file1.ts',
          func: functionDefinitions['function1'],
          functionAlias: 'function1',
        },
      ]);
    });

    it('should throw an error if the handlers reference a file which does not exist', () => {
      mocked(fs.existsSync).mockReturnValue(false);
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

      expect(() => extractFileNames(cwd, 'aws', functionDefinitions)).toThrowError();
      expect(consoleSpy).toBeCalled();
    });
  });
});

describe('getDepsFromBundle', () => {
  const path = './';
  describe('node platform', () => {
    const platform = 'node';
    it('should extract deps from a string', () => {
      mocked(fs).readFileSync.mockReturnValue('require("@scope/package1");require("package2")');
      expect(getDepsFromBundle(path, platform)).toStrictEqual(['@scope/package1', 'package2']);
    });

    it('should extract the base dep from a string', () => {
      mocked(fs).readFileSync.mockReturnValue(
        'require("@scope/package1/subpath");require("package2/subpath");require("@scope/package3/subpath/subpath")require("package4/subpath/subpath")'
      );
      expect(getDepsFromBundle(path, platform)).toStrictEqual([
        '@scope/package1',
        'package2',
        '@scope/package3',
        'package4',
      ]);
    });

    it('should remove duplicate package requires', () => {
      mocked(fs).readFileSync.mockReturnValue(
        'require("package1/subpath");require("package1");require("package1")'
      );
      expect(getDepsFromBundle(path, platform)).toStrictEqual(['package1']);
    });
  });

  describe('neutral platform', () => {
    const platform = 'neutral';

    it('should extract deps from a string', () => {
      mocked(fs).readFileSync.mockReturnValue(
        `
        import * as n from "package1";
        import "package2";
        import {hello as r} from "package3";
        `
      );
      expect(getDepsFromBundle(path, platform)).toStrictEqual(['package1', 'package2', 'package3']);
    });
    it('should extract deps from a minified string', () => {
      mocked(fs).readFileSync.mockReturnValue(
        'import*as n from"package1";import"package2";import{hello as r}from"package3";'
      );
      expect(getDepsFromBundle(path, platform)).toStrictEqual(['package1', 'package2', 'package3']);
    });
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

      const expectedResult: string[] = ['samchungy-dep-a', 'samchungy-a', 'samchungy-b'];

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
        'samchungy-dep-e',
        'samchungy-dep-c',
        'samchungy-dep-d',
        'samchungy-dep-b',
        'samchungy-a',
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
        'samchungy-dep-e',
        'samchungy-dep-c',
        'samchungy-dep-d',
        'samchungy-dep-b',
        'samchungy-a',
        'samchungy-b',
      ];

      const result = flatDep(depMap, ['samchungy-a', 'samchungy-b']);

      expect(result).toStrictEqual(expectedResult);
    });
  });
});

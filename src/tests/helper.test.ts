import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { mocked } from 'ts-jest/utils';

import { extractFileNames } from '../helper';

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

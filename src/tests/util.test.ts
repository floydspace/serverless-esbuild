import fs from 'fs-extra';
import mockFs from 'mock-fs';
import path from 'path';
import extract from 'extract-zip';
import globby from 'globby';
import crypto from 'crypto';

import { findProjectRoot, zip } from '../utils';

describe('utils/findProjectRoot', () => {
  it('should properly Find a Project Root.', () => {
    /* Broken implementation in pack-externals we're trying to fix. */
    const rootPackageJsonPath = path.join(findProjectRoot() || '', './package.json');

    /* Looking up at project root relative to ./src/tests/ */
    expect(rootPackageJsonPath).toEqual(path.join(__dirname, '../../package.json'));
  });
});

describe('utils/zip', () => {
  beforeEach(() => {
    mockFs({
      '/src': {
        'test.txt': 'lorem ipsum',
        modules: {
          'module.txt': 'lorem ipsum 2',
        },
      },
      '/dist': {},
    });
  });

  afterEach(() => {
    mockFs.restore();
  });

  it('should fail with.', async () => {
    const source = '/src';
    const destination = '/dist';
    const zipPath = path.join(destination, 'archive.zip');
    const filesPathList = [
      {
        rootPath: path.join(source, 'incorrect.txt'),
        localPath: 'test.txt',
      },
    ];

    await expect(zip(zipPath, filesPathList)).rejects.toThrowError(
      // eslint-disable-next-line @typescript-eslint/quotes
      "ENOENT, no such file or directory '/src/incorrect.txt'"
    );
  });

  it.each([{ useNativeZip: true }, { useNativeZip: false }])(
    'should properly archive files when useNativeZip=$useNativeZip.',
    async ({ useNativeZip }) => {
      const source = '/src';
      const destination = '/dist';
      const zipPath = path.join(destination, 'archive.zip');
      const filesPathList = [
        {
          rootPath: path.join(source, 'test.txt'),
          localPath: 'test.txt',
        },
        {
          rootPath: path.join(source, 'modules', 'module.txt'),
          localPath: 'modules/module.txt',
        },
      ];

      await zip(zipPath, filesPathList, useNativeZip);

      expect(fs.existsSync(zipPath)).toEqual(true);

      await extract(zipPath, { dir: destination });

      const files = await globby(['**/*'], { cwd: destination, dot: true });

      expect(files).toEqual(['archive.zip', 'test.txt', 'modules/module.txt']);

      // native zip is not deterministic
      if (!useNativeZip) {
        const data = fs.readFileSync(zipPath);
        const fileHash = crypto.createHash('sha256').update(data).digest('base64');
        expect(fileHash).toEqual('iCZdyHJ7ON2LLwBIE6gQmRvBTzXBogSqJTMvHSenzGk=');
      }
    }
  );
});

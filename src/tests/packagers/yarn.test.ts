import { Yarn } from '../../packagers/yarn';
import type { YarnDeps } from '../../packagers/yarn';
import type { DependenciesResult } from '../../types';

import * as utils from '../../utils';

jest.mock('process');
describe('Yarn Packager', () => {
  const yarn = new Yarn({});
  const path = './';

  describe('Yarn Classic', () => {
    let spawnSpy: jest.SpyInstance;

    beforeEach(() => {
      spawnSpy = jest.spyOn(utils, 'spawnProcess');
    });

    afterEach(() => {
      jest.resetAllMocks();
      jest.restoreAllMocks();
    });

    beforeEach(() => {
      spawnSpy = jest.spyOn(utils, 'spawnProcess');
    });

    afterEach(() => {
      jest.resetAllMocks();
      jest.restoreAllMocks();
    });

    it('should call spawnProcess with the correct arguments for listing yarn dependencies', async () => {
      spawnSpy.mockImplementation((_, args) => {
        if (args[0] === '-v') {
          return Promise.resolve({
            stderr: '',
            stdout: '1.0.1',
          });
        }

        if (args[0] === 'list') {
          return Promise.resolve({
            stderr: '',
            stdout: '{"type":"tree","data":{"type":"list","trees":[]}}',
          });
        }

        return Promise.resolve({
          stderr: '',
          stdout: '',
        });
      });

      await yarn.getProdDependencies(path);

      expect(spawnSpy).toHaveBeenCalledWith('yarn', ['list', '--json', '--production'], { cwd: './' });
    });

    it('should call spawnProcess with the correct arguments for listing yarn dependencies when depth is provided', async () => {
      spawnSpy.mockImplementation((_, args) => {
        if (args[0] === '-v') {
          return Promise.resolve({
            stderr: '',
            stdout: '1.0.1',
          });
        }

        if (args[0] === 'list') {
          return Promise.resolve({
            stderr: '',
            stdout: '{"type":"tree","data":{"type":"list","trees":[]}}',
          });
        }

        return Promise.resolve({
          stderr: '',
          stdout: '',
        });
      });

      await yarn.getProdDependencies(path, 2);

      expect(spawnSpy).toHaveBeenCalledWith('yarn', ['list', '--depth=2', '--json', '--production'], {
        cwd: './',
      });
    });

    it('should create a dependency tree from yarn output', async () => {
      const yarnOutput: YarnDeps = {
        type: 'tree',
        data: {
          type: 'list',
          trees: [
            {
              name: 'samchungy-a@2.0.0',
              children: [
                {
                  name: 'samchungy-dep-a@1.0.0',
                  color: 'dim',
                  shadow: true,
                },
              ],
              hint: null,
              color: 'bold',
              depth: 0,
            },
            {
              name: 'samchungy-b@2.0.0',
              children: [
                {
                  name: 'samchungy-dep-a@2.0.0',
                  color: 'dim',
                  shadow: true,
                },
                {
                  name: 'samchungy-dep-a@2.0.0',
                  children: [],
                  hint: null,
                  color: 'bold',
                  depth: 0,
                },
              ],
              hint: null,
              color: 'bold',
              depth: 0,
            },
            {
              name: 'samchungy-dep-a@1.0.0',
              children: [],
              hint: null,
              color: null,
              depth: 0,
            },
          ],
        },
      };
      const expectedResult: DependenciesResult = {
        dependencies: {
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
        },
      };

      spawnSpy.mockImplementation((_, args) => {
        if (args[0] === '-v') {
          return Promise.resolve({
            stderr: '',
            stdout: '1.0.1',
          });
        }

        if (args[0] === 'list') {
          return Promise.resolve({
            stderr: '',
            stdout: JSON.stringify(yarnOutput),
          });
        }

        return Promise.resolve({
          stderr: '',
          stdout: '',
        });
      });

      const result = await yarn.getProdDependencies(path, 2);

      expect(result).toStrictEqual(expectedResult);
    });

    it('should create a dependency tree which handles deduping from yarn output', async () => {
      const yarnOutput: YarnDeps = {
        type: 'tree',
        data: {
          type: 'list',
          trees: [
            {
              name: 'samchungy-a@3.0.0',
              children: [{ name: 'samchungy-dep-b@3.0.0', color: 'dim', shadow: true }],
              hint: null,
              color: 'bold',
              depth: 0,
            },
            {
              name: 'samchungy-b@5.0.0',
              children: [{ name: 'samchungy-dep-b@3.0.0', color: 'dim', shadow: true }],
              hint: null,
              color: 'bold',
              depth: 0,
            },
            {
              name: 'samchungy-dep-b@3.0.0',
              children: [
                { name: 'samchungy-dep-c@^1.0.0', color: 'dim', shadow: true },
                { name: 'samchungy-dep-d@^1.0.0', color: 'dim', shadow: true },
              ],
              hint: null,
              color: null,
              depth: 0,
            },
            {
              name: 'samchungy-dep-c@1.0.0',
              children: [{ name: 'samchungy-dep-e@^1.0.0', color: 'dim', shadow: true }],
              hint: null,
              color: null,
              depth: 0,
            },
            {
              name: 'samchungy-dep-d@1.0.0',
              children: [{ name: 'samchungy-dep-e@^1.0.0', color: 'dim', shadow: true }],
              hint: null,
              color: null,
              depth: 0,
            },
            {
              name: 'samchungy-dep-e@1.0.0',
              children: [],
              hint: null,
              color: null,
              depth: 0,
            },
          ],
        },
      };

      const expectedResult: DependenciesResult = {
        dependencies: {
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
        },
      };

      spawnSpy.mockImplementation((_, args) => {
        if (args[0] === '-v') {
          return Promise.resolve({
            stderr: '',
            stdout: '1.0.1',
          });
        }

        if (args[0] === 'list') {
          return Promise.resolve({
            stderr: '',
            stdout: JSON.stringify(yarnOutput),
          });
        }

        return Promise.resolve({
          stderr: '',
          stdout: '',
        });
      });

      const result = await yarn.getProdDependencies(path, 2);

      expect(result).toStrictEqual(expectedResult);
    });

    it('should skip install if the noInstall option is true', async () => {
      const yarnWithoutInstall = new Yarn({
        noInstall: true,
      });

      await expect(yarnWithoutInstall.install(path, [], false)).resolves.toBeUndefined();
      expect(spawnSpy).toHaveBeenCalledTimes(0);
    });
  });

  describe('Yarn Berry', () => {
    let spawnSpy: jest.SpyInstance;

    beforeEach(() => {
      spawnSpy = jest.spyOn(utils, 'spawnProcess');
    });

    afterEach(() => {
      jest.resetAllMocks();
      jest.restoreAllMocks();
    });

    it('should call spawnProcess with the correct arguments for yarn berry', async () => {
      spawnSpy.mockImplementation((_, args) => {
        if (args[0] === '-v') {
          return Promise.resolve({
            stderr: '',
            stdout: '2.4.3',
          });
        }

        if (args[0] === 'info' && args[1] === '-AR') {
          return Promise.resolve({
            stderr: '',
            stdout: '{"value":"lodash@npm:4.17.21","children":{"Version":"4.17.21"}}',
          });
        }

        return Promise.resolve({
          stderr: '',
          stdout: '',
        });
      });

      await yarn.getProdDependencies(path);

      expect(spawnSpy).toHaveBeenCalledTimes(2);
      expect(spawnSpy).toHaveBeenNthCalledWith(1, 'yarn', ['-v'], { cwd: './' });
      expect(spawnSpy).toHaveBeenNthCalledWith(2, 'yarn', ['info', '-AR', '--json'], { cwd: './' });
    });

    it('should create a dependency tree from yarn berry output', async () => {
      const expectedResult: DependenciesResult = {
        dependencies: {
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
        },
      };

      // 버전 조회 시 Yarn Berry 버전 반환
      spawnSpy.mockImplementation((_, args) => {
        if (args[0] === '-v') {
          return Promise.resolve({
            stderr: '',
            stdout: '2.4.3',
          });
        }

        if (args[0] === 'info' && args[1] === '-AR') {
          return Promise.resolve({
            stderr: '',
            stdout: `{"value":"samchungy-a@npm:3.0.0","children":{"Version":"3.0.0","Dependencies":[{"descriptor":"samchungy-dep-b@npm:3.0.0","locator":"samchungy-dep-b@npm:3.0.0"}]}}
{"value":"samchungy-b@npm:5.0.0","children":{"Version":"5.0.0","Dependencies":[{"descriptor":"samchungy-dep-b@npm:3.0.0","locator":"samchungy-dep-b@npm:3.0.0"}]}}
{"value":"samchungy-dep-b@npm:3.0.0","children":{"Version":"3.0.0","Dependencies":[{"descriptor":"samchungy-dep-c@npm:^1.0.0","locator":"samchungy-dep-c@npm:1.0.0"},{"descriptor":"samchungy-dep-d@npm:^1.0.0","locator":"samchungy-dep-d@npm:1.0.0"}]}}
{"value":"samchungy-dep-c@npm:1.0.0","children":{"Version":"1.0.0","Dependencies":[{"descriptor":"samchungy-dep-e@npm:^1.0.0","locator":"samchungy-dep-e@npm:1.0.0"}]}}
{"value":"samchungy-dep-d@npm:1.0.0","children":{"Version":"1.0.0","Dependencies":[{"descriptor":"samchungy-dep-e@npm:^1.0.0","locator":"samchungy-dep-e@npm:1.0.0"}]}}
{"value":"samchungy-dep-e@npm:1.0.0","children":{"Version":"1.0.0"}}`,
          });
        }

        return Promise.resolve({
          stderr: '',
          stdout: '',
        });
      });

      const result = await yarn.getProdDependencies(path);

      expect(result).toStrictEqual(expectedResult);
    });
  });
});

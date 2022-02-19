import { Yarn, YarnDeps } from '../../packagers/yarn';
import { DependenciesResult } from '../../types';

import * as utils from '../../utils';

jest.mock('process');
describe('Yarn Packager', () => {
  const yarn = new Yarn();
  const path = './';

  let spawnSpy = jest.spyOn(utils, 'spawnProcess');

  beforeEach(() => {
    spawnSpy = jest.spyOn(utils, 'spawnProcess');
  });

  afterEach(() => {
    jest.resetAllMocks();
    jest.restoreAllMocks();
  });

  it('should call spawnProcess with the correct arguments for listing yarn dependencies', async () => {
    spawnSpy.mockResolvedValueOnce({
      stderr: '',
      stdout: '{"type":"tree","data":{"type":"list","trees":[]}}',
    });

    await yarn.getProdDependencies(path);

    expect(spawnSpy).toBeCalledTimes(1);
    expect(spawnSpy).toBeCalledWith('yarn', ['list', '--json', '--production'], { cwd: './' });
  });

  it('should call spawnProcess with the correct arguments for listing yarn dependencies when depth is provided', async () => {
    spawnSpy.mockResolvedValueOnce({
      stderr: '',
      stdout: '{"type":"tree","data":{"type":"list","trees":[]}}',
    });

    await yarn.getProdDependencies(path, 2);

    expect(spawnSpy).toBeCalledTimes(1);
    expect(spawnSpy).toBeCalledWith('yarn', ['list', '--depth=2', '--json', '--production'], {
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

    spawnSpy.mockResolvedValueOnce({
      stderr: '',
      stdout: JSON.stringify(yarnOutput),
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

    spawnSpy.mockResolvedValueOnce({
      stderr: '',
      stdout: JSON.stringify(yarnOutput),
    });

    const result = await yarn.getProdDependencies(path, 2);

    expect(result).toStrictEqual(expectedResult);
  });
});

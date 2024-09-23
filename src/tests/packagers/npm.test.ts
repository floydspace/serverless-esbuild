import { NPM } from '../../packagers/npm';
import type { NpmV6Deps, NpmV7Deps } from '../../packagers/npm';
import type { DependenciesResult } from '../../types';
import * as utils from '../../utils';

jest.mock('process');
describe('NPM Packager', () => {
  const npm = new NPM();
  const path = './';

  let spawnSpy: jest.SpyInstance;

  beforeEach(() => {
    spawnSpy = jest.spyOn(utils, 'spawnProcess');
  });

  afterEach(() => {
    jest.resetAllMocks();
    jest.restoreAllMocks();
  });

  it('should call spawnProcess with the correct arguments for getting the npm version', async () => {
    spawnSpy
      .mockResolvedValueOnce({ stderr: '', stdout: '6.0.0' })
      .mockResolvedValueOnce({ stderr: '', stdout: '{"dependencies":{}}' });

    await npm.getProdDependencies(path);

    expect(spawnSpy).toHaveBeenCalledTimes(2);
    expect(spawnSpy).toHaveBeenCalledWith('npm', ['--version'], { cwd: './' });
  });

  it('should call spawnProcess with the correct arguments for listing dependencies on npm', async () => {
    spawnSpy
      .mockResolvedValueOnce({ stderr: '', stdout: '6.0.0' })
      .mockResolvedValueOnce({ stderr: '', stdout: '{"dependencies":{}}' });

    await npm.getProdDependencies(path);

    expect(spawnSpy).toHaveBeenCalledTimes(2);
    expect(spawnSpy).toHaveBeenCalledWith('npm', ['ls', '-json', '-prod', '-long'], { cwd: './' });
  });

  it('should call spawnProcess with the correct arguments for listing dependencies on npm v7', async () => {
    spawnSpy
      .mockResolvedValueOnce({ stderr: '', stdout: '7.0.0' })
      .mockResolvedValueOnce({ stderr: '', stdout: '{"dependencies":{}}' });

    await npm.getProdDependencies(path);

    expect(spawnSpy).toHaveBeenCalledTimes(2);
    expect(spawnSpy).toHaveBeenCalledWith('npm', ['ls', '-json', '--omit=dev', '-long', '-all'], {
      cwd: './',
    });
  });

  it('should call spawnProcess with the correct arguments for listing dependencies when depth is provided', async () => {
    spawnSpy.mockResolvedValueOnce({ stderr: '', stdout: '{"dependencies":{}}' });

    await npm.getProdDependencies(path, 2);

    expect(spawnSpy).toHaveBeenCalledTimes(2);
    expect(spawnSpy).toHaveBeenCalledWith('npm', ['ls', '-json', '-prod', '-long', '-depth=2'], {
      cwd: './',
    });
  });

  it('should create the same dependency tree from npm v6 and npm v7 output', async () => {
    const v6depsList: NpmV6Deps = {
      name: 'serverless-example',
      version: '1.0.0',
      description: 'Packaged externals for serverless-example',
      private: true,
      scripts: {},
      dependencies: {
        'samchungy-a': {
          _args: [
            ['samchungy-a@2.0.0', '/workdir/.esbuild/.build'],
            ['samchungy-a@2.0.0', '/workdir/.esbuild/.build'],
          ],
          _from: 'samchungy-a@2.0.0',
          _id: 'samchungy-a@2.0.0',
          _integrity: 'sha512-gUv/cvd9AFYvvGep0e9m1wSAf3dfnb71eri5TjtgC6N7qvJALXFaFVOkLNBHEYGEm2ZJdosXvGqr3ISZ7Yh46Q==',
          _location: '/samchungy-a',
          _phantomChildren: {},
          _requested: {
            type: 'version',
            registry: true,
            raw: 'samchungy-a@2.0.0',
            name: 'samchungy-a',
            escapedName: 'samchungy-a',
            rawSpec: '2.0.0',
            saveSpec: null,
            fetchSpec: '2.0.0',
          },
          _requiredBy: ['/'],
          _resolved: 'https://registry.npmjs.org/samchungy-a/-/samchungy-a-2.0.0.tgz',
          _spec: '2.0.0',
          _where: '/workdir/.esbuild/.build',
          author: '',
          dependencies: {
            'samchungy-dep-a': {
              _args: [
                ['samchungy-dep-a@1.0.0', '/workdir/.esbuild/.build'],
                ['samchungy-dep-a@1.0.0', '/workdir/.esbuild/.build'],
              ],
              _from: 'samchungy-dep-a@1.0.0',
              _id: 'samchungy-dep-a@1.0.0',
              _integrity:
                'sha512-NVac5aAU+p7bsIrUTQO438vAO8MHyNILbeckhzxhadIUqGx3L9kEZ5HTqZ+XqDIRARmOU6UmFtus6Bc7q5+mWA==',
              _location: '/samchungy-dep-a',
              _phantomChildren: {},
              _requested: {
                type: 'version',
                registry: true,
                raw: 'samchungy-dep-a@1.0.0',
                name: 'samchungy-dep-a',
                escapedName: 'samchungy-dep-a',
                rawSpec: '1.0.0',
                saveSpec: '[Circular]',
                fetchSpec: '1.0.0',
              },
              _requiredBy: ['/samchungy-a'],
              _resolved: 'https://registry.npmjs.org/samchungy-dep-a/-/samchungy-dep-a-1.0.0.tgz',
              _spec: '1.0.0',
              _where: '/workdir/.esbuild/.build',
              author: '',
              license: 'ISC',
              main: 'index.js',
              name: 'samchungy-dep-a',
              scripts: {
                test: 'echo "Error: no test specified" && exit 1',
              },
              version: '1.0.0',
              readme: 'ERROR: No README data found!',
              dependencies: {},
              devDependencies: {},
              optionalDependencies: {},
              _dependencies: {},
              path: '/workdir/.esbuild/.build/node_modules/samchungy-dep-a',
              error: '[Circular]',
              extraneous: false,
            },
          },
          license: 'ISC',
          main: 'index.js',
          name: 'samchungy-a',
          scripts: {
            test: 'echo "Error: no test specified" && exit 1',
          },
          version: '2.0.0',
          readme: 'ERROR: No README data found!',
          devDependencies: {},
          optionalDependencies: {},
          _dependencies: {
            'samchungy-dep-a': '1.0.0',
          },
          path: '/workdir/.esbuild/.build/node_modules/samchungy-a',
          error: '[Circular]',
          extraneous: false,
        },
        'samchungy-b': {
          _args: [
            ['samchungy-b@2.0.0', '/workdir/.esbuild/.build'],
            ['samchungy-b@2.0.0', '/workdir/.esbuild/.build'],
          ],
          _from: 'samchungy-b@2.0.0',
          _id: 'samchungy-b@2.0.0',
          _integrity: 'sha512-i42OG9FC2Py3RfbI8bBFZi3VoN7+MxM0OUvFcWrsIgqvZMUDVI4hNKHqpE6GTt07gDDqQnxlMNehbrsQLtHRVA==',
          _location: '/samchungy-b',
          _phantomChildren: {},
          _requested: {
            type: 'version',
            registry: true,
            raw: 'samchungy-b@2.0.0',
            name: 'samchungy-b',
            escapedName: 'samchungy-b',
            rawSpec: '2.0.0',
            saveSpec: '[Circular]',
            fetchSpec: '2.0.0',
          },
          _requiredBy: ['/'],
          _resolved: 'https://registry.npmjs.org/samchungy-b/-/samchungy-b-2.0.0.tgz',
          _spec: '2.0.0',
          _where: '/workdir/.esbuild/.build',
          author: '',
          dependencies: {
            'samchungy-dep-a': {
              _args: [
                ['samchungy-dep-a@2.0.0', '/workdir/.esbuild/.build'],
                ['samchungy-dep-a@2.0.0', '/workdir/.esbuild/.build'],
              ],
              _from: 'samchungy-dep-a@2.0.0',
              _id: 'samchungy-dep-a@2.0.0',
              _integrity:
                'sha512-Yp30ASjwmyLWCGhlLTqWZa8MlBeBiaaHsmxXMwwQxK/o044vhCsPeugHqhtsZq7Xiq68/TcBux/LKId6eyPNjA==',
              _location: '/samchungy-b/samchungy-dep-a',
              _phantomChildren: {},
              _requested: {
                type: 'version',
                registry: true,
                raw: 'samchungy-dep-a@2.0.0',
                name: 'samchungy-dep-a',
                escapedName: 'samchungy-dep-a',
                rawSpec: '2.0.0',
                saveSpec: '[Circular]',
                fetchSpec: '2.0.0',
              },
              _requiredBy: ['/samchungy-b'],
              _resolved: 'https://registry.npmjs.org/samchungy-dep-a/-/samchungy-dep-a-2.0.0.tgz',
              _spec: '2.0.0',
              _where: '/workdir/.esbuild/.build',
              author: '',
              license: 'ISC',
              main: 'index.js',
              name: 'samchungy-dep-a',
              scripts: {
                test: 'echo "Error: no test specified" && exit 1',
              },
              version: '2.0.0',
              readme: 'ERROR: No README data found!',
              dependencies: {},
              devDependencies: {},
              optionalDependencies: {},
              _dependencies: {},
              path: '/workdir/.esbuild/.build/node_modules/samchungy-b/node_modules/samchungy-dep-a',
              error: '[Circular]',
              extraneous: false,
            },
          },
          license: 'ISC',
          main: 'index.js',
          name: 'samchungy-b',
          scripts: {
            test: 'echo "Error: no test specified" && exit 1',
          },
          version: '2.0.0',
          readme: 'ERROR: No README data found!',
          devDependencies: {},
          optionalDependencies: {},
          _dependencies: {
            'samchungy-dep-a': '2.0.0',
          },
          path: '/workdir/.esbuild/.build/node_modules/samchungy-b',
          error: '[Circular]',
          extraneous: false,
        },
      },
      readme: 'ERROR: No README data found!',
      _id: 'serverless-example@1.0.0',
      _shrinkwrap: {
        name: 'serverless-example',
        version: '1.0.0',
        lockfileVersion: 1,
        requires: true,
        dependencies: {
          'samchungy-a': {
            version: '2.0.0',
            resolved: 'https://registry.npmjs.org/samchungy-a/-/samchungy-a-2.0.0.tgz',
            integrity:
              'sha512-gUv/cvd9AFYvvGep0e9m1wSAf3dfnb71eri5TjtgC6N7qvJALXFaFVOkLNBHEYGEm2ZJdosXvGqr3ISZ7Yh46Q==',
            requires: {
              'samchungy-dep-a': '1.0.0',
            },
          },
          'samchungy-b': {
            version: '2.0.0',
            resolved: 'https://registry.npmjs.org/samchungy-b/-/samchungy-b-2.0.0.tgz',
            integrity:
              'sha512-i42OG9FC2Py3RfbI8bBFZi3VoN7+MxM0OUvFcWrsIgqvZMUDVI4hNKHqpE6GTt07gDDqQnxlMNehbrsQLtHRVA==',
            requires: {
              'samchungy-dep-a': '2.0.0',
            },
            dependencies: {
              'samchungy-dep-a': {
                version: '2.0.0',
                resolved: 'https://registry.npmjs.org/samchungy-dep-a/-/samchungy-dep-a-2.0.0.tgz',
                integrity:
                  'sha512-Yp30ASjwmyLWCGhlLTqWZa8MlBeBiaaHsmxXMwwQxK/o044vhCsPeugHqhtsZq7Xiq68/TcBux/LKId6eyPNjA==',
              },
            },
          },
          'samchungy-dep-a': {
            version: '1.0.0',
            resolved: 'https://registry.npmjs.org/samchungy-dep-a/-/samchungy-dep-a-1.0.0.tgz',
            integrity:
              'sha512-NVac5aAU+p7bsIrUTQO438vAO8MHyNILbeckhzxhadIUqGx3L9kEZ5HTqZ+XqDIRARmOU6UmFtus6Bc7q5+mWA==',
          },
        },
      },
      devDependencies: {},
      optionalDependencies: {},
      _dependencies: {
        'samchungy-a': '2.0.0',
        'samchungy-b': '2.0.0',
      },
      path: '/workdir/.esbuild/.build',
      error: '[Circular]',
      extraneous: false,
    };

    const v7depsList: NpmV7Deps = {
      version: '1.0.0',
      name: 'serverless-example',
      description: 'Packaged externals for serverless-example',
      private: true,
      scripts: {},
      _id: 'serverless-example@1.0.0',
      extraneous: false,
      path: '/workdir/.esbuild/.build',
      _dependencies: {
        'samchungy-a': '2.0.0',
        'samchungy-b': '2.0.0',
      },
      devDependencies: {},
      peerDependencies: {},
      dependencies: {
        'samchungy-a': {
          version: '2.0.0',
          resolved: 'https://registry.npmjs.org/samchungy-a/-/samchungy-a-2.0.0.tgz',
          name: 'samchungy-a',
          integrity: 'sha512-gUv/cvd9AFYvvGep0e9m1wSAf3dfnb71eri5TjtgC6N7qvJALXFaFVOkLNBHEYGEm2ZJdosXvGqr3ISZ7Yh46Q==',
          _id: 'samchungy-a@2.0.0',
          extraneous: false,
          path: '/workdir/.esbuild/.build/node_modules/samchungy-a',
          _dependencies: {
            'samchungy-dep-a': '1.0.0',
          },
          devDependencies: {},
          peerDependencies: {},
          dependencies: {
            'samchungy-dep-a': {
              version: '1.0.0',
              resolved: 'https://registry.npmjs.org/samchungy-dep-a/-/samchungy-dep-a-1.0.0.tgz',
              name: 'samchungy-dep-a',
              integrity:
                'sha512-NVac5aAU+p7bsIrUTQO438vAO8MHyNILbeckhzxhadIUqGx3L9kEZ5HTqZ+XqDIRARmOU6UmFtus6Bc7q5+mWA==',
              _id: 'samchungy-dep-a@1.0.0',
              extraneous: false,
              path: '/workdir/.esbuild/.build/node_modules/samchungy-dep-a',
              _dependencies: {},
              devDependencies: {},
              peerDependencies: {},
            },
          },
        },
        'samchungy-b': {
          version: '2.0.0',
          resolved: 'https://registry.npmjs.org/samchungy-b/-/samchungy-b-2.0.0.tgz',
          name: 'samchungy-b',
          integrity: 'sha512-i42OG9FC2Py3RfbI8bBFZi3VoN7+MxM0OUvFcWrsIgqvZMUDVI4hNKHqpE6GTt07gDDqQnxlMNehbrsQLtHRVA==',
          _id: 'samchungy-b@2.0.0',
          extraneous: false,
          path: '/workdir/.esbuild/.build/node_modules/samchungy-b',
          _dependencies: {
            'samchungy-dep-a': '2.0.0',
          },
          devDependencies: {},
          peerDependencies: {},
          dependencies: {
            'samchungy-dep-a': {
              version: '2.0.0',
              resolved: 'https://registry.npmjs.org/samchungy-dep-a/-/samchungy-dep-a-2.0.0.tgz',
              name: 'samchungy-dep-a',
              integrity:
                'sha512-Yp30ASjwmyLWCGhlLTqWZa8MlBeBiaaHsmxXMwwQxK/o044vhCsPeugHqhtsZq7Xiq68/TcBux/LKId6eyPNjA==',
              _id: 'samchungy-dep-a@2.0.0',
              extraneous: false,
              path: '/workdir/.esbuild/.build/node_modules/samchungy-b/node_modules/samchungy-dep-a',
              _dependencies: {},
              devDependencies: {},
              peerDependencies: {},
            },
          },
        },
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

    spawnSpy
      .mockResolvedValueOnce({ stderr: '', stdout: '6.0.0' })
      .mockResolvedValueOnce({ stderr: '', stdout: JSON.stringify(v6depsList) });

    const v6dependencies = await npm.getProdDependencies(path);

    spawnSpy
      .mockResolvedValueOnce({ stderr: '', stdout: '7.0.0' })
      .mockResolvedValueOnce({ stderr: '', stdout: JSON.stringify(v7depsList) });

    const v7dependencies = await npm.getProdDependencies(path);

    expect(v6dependencies).toStrictEqual(expectedResult);
    expect(v7dependencies).toStrictEqual(expectedResult);
  });

  it('should create the same dependency tree which handles deduping for both npm v6 and v7', async () => {
    const v6depsList: NpmV6Deps = {
      name: 'serverless-example',
      version: '1.0.0',
      description: 'Packaged externals for serverless-example',
      private: true,
      scripts: {},
      dependencies: {
        'samchungy-a': {
          _args: [
            ['samchungy-a@3.0.0', '/workdir/.esbuild/.build'],
            ['samchungy-a@3.0.0', '/workdir/.esbuild/.build'],
          ],
          _from: 'samchungy-a@3.0.0',
          _id: 'samchungy-a@3.0.0',
          _integrity: 'sha512-5u55rgjPpASgPDU2jLYf4HCt31jUVtzy/r42q4SyJ4W+ItggEk+8w3WBfXRcQgxYyyWflL1F9w85u3Wudj542g==',
          _location: '/samchungy-a',
          _phantomChildren: {},
          _requested: {
            type: 'version',
            registry: true,
            raw: 'samchungy-a@3.0.0',
            name: 'samchungy-a',
            escapedName: 'samchungy-a',
            rawSpec: '3.0.0',
            saveSpec: null,
            fetchSpec: '3.0.0',
          },
          _requiredBy: ['/'],
          _resolved: 'https://registry.npmjs.org/samchungy-a/-/samchungy-a-3.0.0.tgz',
          _spec: '3.0.0',
          _where: '/workdir/.esbuild/.build',
          author: '',
          dependencies: {
            'samchungy-dep-b': {
              _args: [
                ['samchungy-dep-b@3.0.0', '/workdir/.esbuild/.build'],
                ['samchungy-dep-b@3.0.0', '/workdir/.esbuild/.build'],
              ],
              _from: 'samchungy-dep-b@3.0.0',
              _id: 'samchungy-dep-b@3.0.0',
              _integrity:
                'sha512-fy6RAnofLSnLHgOUmgsFz0ZFnJcJeNHT+qUfHJ7daIFlBaciRDR6v5sdWm7mAM2EzQ1KFf2hmKJVFZgthVeCAw==',
              _location: '/samchungy-dep-b',
              _phantomChildren: {},
              _requested: {
                type: 'version',
                registry: true,
                raw: 'samchungy-dep-b@3.0.0',
                name: 'samchungy-dep-b',
                escapedName: 'samchungy-dep-b',
                rawSpec: '3.0.0',
                saveSpec: '[Circular]',
                fetchSpec: '3.0.0',
              },
              _requiredBy: ['/samchungy-a', '/samchungy-b'],
              _resolved: 'https://registry.npmjs.org/samchungy-dep-b/-/samchungy-dep-b-3.0.0.tgz',
              _spec: '3.0.0',
              _where: '/workdir/.esbuild/.build',
              author: '',
              dependencies: {
                'samchungy-dep-c': {
                  _args: [
                    ['samchungy-dep-c@1.0.0', '/workdir/.esbuild/.build'],
                    ['samchungy-dep-c@1.0.0', '/workdir/.esbuild/.build'],
                  ],
                  _from: 'samchungy-dep-c@1.0.0',
                  _id: 'samchungy-dep-c@1.0.0',
                  _integrity:
                    'sha512-YMLl+vnxi7kNr59zq+FFVfBBKyPyxqc7LUU92ZYTkTJaEGHNlCyC2fVC+diIVaomhn4CNAqmOGIVqbr5sq8lQg==',
                  _location: '/samchungy-dep-c',
                  _phantomChildren: {},
                  _requested: {
                    type: 'version',
                    registry: true,
                    raw: 'samchungy-dep-c@1.0.0',
                    name: 'samchungy-dep-c',
                    escapedName: 'samchungy-dep-c',
                    rawSpec: '1.0.0',
                    saveSpec: '[Circular]',
                    fetchSpec: '1.0.0',
                  },
                  _requiredBy: ['/samchungy-dep-b'],
                  _resolved: 'https://registry.npmjs.org/samchungy-dep-c/-/samchungy-dep-c-1.0.0.tgz',
                  _spec: '1.0.0',
                  _where: '/workdir/.esbuild/.build',
                  author: '',
                  dependencies: {
                    'samchungy-dep-e': {
                      _args: [
                        ['samchungy-dep-e@1.0.0', '/workdir/.esbuild/.build'],
                        ['samchungy-dep-e@1.0.0', '/workdir/.esbuild/.build'],
                      ],
                      _from: 'samchungy-dep-e@1.0.0',
                      _id: 'samchungy-dep-e@1.0.0',
                      _integrity:
                        'sha512-phnrKKAOuZdVrVk86R6CNU62YC4bRr/Ru1SokC5ZqkXh4QR30XU4ApSTuLbFADb6F3HWKZTGelaoklyMW2mveg==',
                      _location: '/samchungy-dep-e',
                      _phantomChildren: {},
                      _requested: {
                        type: 'version',
                        registry: true,
                        raw: 'samchungy-dep-e@1.0.0',
                        name: 'samchungy-dep-e',
                        escapedName: 'samchungy-dep-e',
                        rawSpec: '1.0.0',
                        saveSpec: '[Circular]',
                        fetchSpec: '1.0.0',
                      },
                      _requiredBy: ['/samchungy-dep-c', '/samchungy-dep-d'],
                      _resolved: 'https://registry.npmjs.org/samchungy-dep-e/-/samchungy-dep-e-1.0.0.tgz',
                      _spec: '1.0.0',
                      _where: '/workdir/.esbuild/.build',
                      author: '',
                      license: 'ISC',
                      main: 'index.js',
                      name: 'samchungy-dep-e',
                      scripts: { test: 'echo "Error: no test specified" && exit 1' },
                      version: '1.0.0',
                      readme: 'ERROR: No README data found!',
                      dependencies: {},
                      devDependencies: {},
                      optionalDependencies: {},
                      _dependencies: {},
                      path: '/workdir/.esbuild/.build/node_modules/samchungy-dep-e',
                      error: '[Circular]',
                      extraneous: false,
                    },
                  },
                  license: 'ISC',
                  main: 'index.js',
                  name: 'samchungy-dep-c',
                  scripts: { test: 'echo "Error: no test specified" && exit 1' },
                  version: '1.0.0',
                  readme: 'ERROR: No README data found!',
                  devDependencies: {},
                  optionalDependencies: {},
                  _dependencies: { 'samchungy-dep-e': '^1.0.0' },
                  path: '/workdir/.esbuild/.build/node_modules/samchungy-dep-c',
                  error: '[Circular]',
                  extraneous: false,
                },
                'samchungy-dep-d': {
                  _args: [
                    ['samchungy-dep-d@1.0.0', '/workdir/.esbuild/.build'],
                    ['samchungy-dep-d@1.0.0', '/workdir/.esbuild/.build'],
                  ],
                  _from: 'samchungy-dep-d@1.0.0',
                  _id: 'samchungy-dep-d@1.0.0',
                  _integrity:
                    'sha512-yxXY2+OVhx1e5QZWSWrCajs5b2FCD0CV2ztss+7x4IgQbM0u5gMfzva31kMZFzX2iLJ7iy+09DYpe34TSRrzsA==',
                  _location: '/samchungy-dep-d',
                  _phantomChildren: {},
                  _requested: {
                    type: 'version',
                    registry: true,
                    raw: 'samchungy-dep-d@1.0.0',
                    name: 'samchungy-dep-d',
                    escapedName: 'samchungy-dep-d',
                    rawSpec: '1.0.0',
                    saveSpec: '[Circular]',
                    fetchSpec: '1.0.0',
                  },
                  _requiredBy: ['/samchungy-dep-b'],
                  _resolved: 'https://registry.npmjs.org/samchungy-dep-d/-/samchungy-dep-d-1.0.0.tgz',
                  _spec: '1.0.0',
                  _where: '/workdir/.esbuild/.build',
                  author: '',
                  dependencies: {
                    'samchungy-dep-e': {
                      _args: '[Circular]',
                      _from: 'samchungy-dep-e@1.0.0',
                      _id: 'samchungy-dep-e@1.0.0',
                      _integrity:
                        'sha512-phnrKKAOuZdVrVk86R6CNU62YC4bRr/Ru1SokC5ZqkXh4QR30XU4ApSTuLbFADb6F3HWKZTGelaoklyMW2mveg==',
                      _location: '/samchungy-dep-e',
                      _phantomChildren: '[Circular]',
                      _requested: {
                        type: 'version',
                        registry: true,
                        raw: 'samchungy-dep-e@1.0.0',
                        name: 'samchungy-dep-e',
                        escapedName: 'samchungy-dep-e',
                        rawSpec: '1.0.0',
                        saveSpec: '[Circular]',
                        fetchSpec: '1.0.0',
                      },
                      _requiredBy: '[Circular]',
                      _resolved: 'https://registry.npmjs.org/samchungy-dep-e/-/samchungy-dep-e-1.0.0.tgz',
                      _spec: '1.0.0',
                      _where: '/workdir/.esbuild/.build',
                      author: '',
                      license: 'ISC',
                      main: 'index.js',
                      name: 'samchungy-dep-e',
                      scripts: '[Circular]',
                      version: '1.0.0',
                      readme: 'ERROR: No README data found!',
                      dependencies: {},
                      devDependencies: '[Circular]',
                      optionalDependencies: '[Circular]',
                      _dependencies: '[Circular]',
                      path: '/workdir/.esbuild/.build/node_modules/samchungy-dep-e',
                      error: '[Circular]',
                      extraneous: false,
                      _deduped: 'samchungy-dep-e',
                    },
                  },
                  license: 'ISC',
                  main: 'index.js',
                  name: 'samchungy-dep-d',
                  scripts: { test: 'echo "Error: no test specified" && exit 1' },
                  version: '1.0.0',
                  readme: 'ERROR: No README data found!',
                  devDependencies: {},
                  optionalDependencies: {},
                  _dependencies: { 'samchungy-dep-e': '^1.0.0' },
                  path: '/workdir/.esbuild/.build/node_modules/samchungy-dep-d',
                  error: '[Circular]',
                  extraneous: false,
                },
              },
              license: 'ISC',
              main: 'index.js',
              name: 'samchungy-dep-b',
              scripts: { test: 'echo "Error: no test specified" && exit 1' },
              version: '3.0.0',
              readme: 'ERROR: No README data found!',
              devDependencies: {},
              optionalDependencies: {},
              _dependencies: { 'samchungy-dep-c': '^1.0.0', 'samchungy-dep-d': '^1.0.0' },
              path: '/workdir/.esbuild/.build/node_modules/samchungy-dep-b',
              error: '[Circular]',
              extraneous: false,
            },
          },
          license: 'ISC',
          main: 'index.js',
          name: 'samchungy-a',
          scripts: { test: 'echo "Error: no test specified" && exit 1' },
          version: '3.0.0',
          readme: 'ERROR: No README data found!',
          devDependencies: {},
          optionalDependencies: {},
          _dependencies: { 'samchungy-dep-b': '3.0.0' },
          path: '/workdir/.esbuild/.build/node_modules/samchungy-a',
          error: '[Circular]',
          extraneous: false,
        },
        'samchungy-b': {
          _args: [
            ['samchungy-b@5.0.0', '/workdir/.esbuild/.build'],
            ['samchungy-b@5.0.0', '/workdir/.esbuild/.build'],
          ],
          _from: 'samchungy-b@5.0.0',
          _id: 'samchungy-b@5.0.0',
          _integrity: 'sha512-Swb34L5tb1agVosN97lXr+HzMzYXvwt2XuZAe9YGVzAWYduObaS5Rc0lwYUkILqKmwqLmtb29Jc2veiNAmU2zw==',
          _location: '/samchungy-b',
          _phantomChildren: {},
          _requested: {
            type: 'version',
            registry: true,
            raw: 'samchungy-b@5.0.0',
            name: 'samchungy-b',
            escapedName: 'samchungy-b',
            rawSpec: '5.0.0',
            saveSpec: '[Circular]',
            fetchSpec: '5.0.0',
          },
          _requiredBy: ['/'],
          _resolved: 'https://registry.npmjs.org/samchungy-b/-/samchungy-b-5.0.0.tgz',
          _spec: '5.0.0',
          _where: '/workdir/.esbuild/.build',
          author: '',
          dependencies: {
            'samchungy-dep-b': {
              _args: '[Circular]',
              _from: 'samchungy-dep-b@3.0.0',
              _id: 'samchungy-dep-b@3.0.0',
              _integrity:
                'sha512-fy6RAnofLSnLHgOUmgsFz0ZFnJcJeNHT+qUfHJ7daIFlBaciRDR6v5sdWm7mAM2EzQ1KFf2hmKJVFZgthVeCAw==',
              _location: '/samchungy-dep-b',
              _phantomChildren: '[Circular]',
              _requested: {
                type: 'version',
                registry: true,
                raw: 'samchungy-dep-b@3.0.0',
                name: 'samchungy-dep-b',
                escapedName: 'samchungy-dep-b',
                rawSpec: '3.0.0',
                saveSpec: '[Circular]',
                fetchSpec: '3.0.0',
              },
              _requiredBy: '[Circular]',
              _resolved: 'https://registry.npmjs.org/samchungy-dep-b/-/samchungy-dep-b-3.0.0.tgz',
              _spec: '3.0.0',
              _where: '/workdir/.esbuild/.build',
              author: '',
              dependencies: {},
              license: 'ISC',
              main: 'index.js',
              name: 'samchungy-dep-b',
              scripts: '[Circular]',
              version: '3.0.0',
              readme: 'ERROR: No README data found!',
              devDependencies: '[Circular]',
              optionalDependencies: '[Circular]',
              _dependencies: '[Circular]',
              path: '/workdir/.esbuild/.build/node_modules/samchungy-dep-b',
              error: '[Circular]',
              extraneous: false,
              _deduped: 'samchungy-dep-b',
            },
          },
          license: 'ISC',
          main: 'index.js',
          name: 'samchungy-b',
          scripts: { test: 'echo "Error: no test specified" && exit 1' },
          version: '5.0.0',
          readme: 'ERROR: No README data found!',
          devDependencies: {},
          optionalDependencies: {},
          _dependencies: { 'samchungy-dep-b': '3.0.0' },
          path: '/workdir/.esbuild/.build/node_modules/samchungy-b',
          error: '[Circular]',
          extraneous: false,
        },
      },
      readme: 'ERROR: No README data found!',
      _id: 'serverless-example@1.0.0',
      _shrinkwrap: {
        name: 'serverless-example',
        version: '1.0.0',
        lockfileVersion: 1,
        requires: true,
        dependencies: {
          'samchungy-a': {
            version: '3.0.0',
            resolved: 'https://registry.npmjs.org/samchungy-a/-/samchungy-a-3.0.0.tgz',
            integrity:
              'sha512-5u55rgjPpASgPDU2jLYf4HCt31jUVtzy/r42q4SyJ4W+ItggEk+8w3WBfXRcQgxYyyWflL1F9w85u3Wudj542g==',
            requires: { 'samchungy-dep-b': '3.0.0' },
          },
          'samchungy-b': {
            version: '5.0.0',
            resolved: 'https://registry.npmjs.org/samchungy-b/-/samchungy-b-5.0.0.tgz',
            integrity:
              'sha512-Swb34L5tb1agVosN97lXr+HzMzYXvwt2XuZAe9YGVzAWYduObaS5Rc0lwYUkILqKmwqLmtb29Jc2veiNAmU2zw==',
            requires: { 'samchungy-dep-b': '3.0.0' },
          },
          'samchungy-dep-b': {
            version: '3.0.0',
            resolved: 'https://registry.npmjs.org/samchungy-dep-b/-/samchungy-dep-b-3.0.0.tgz',
            integrity:
              'sha512-fy6RAnofLSnLHgOUmgsFz0ZFnJcJeNHT+qUfHJ7daIFlBaciRDR6v5sdWm7mAM2EzQ1KFf2hmKJVFZgthVeCAw==',
            requires: { 'samchungy-dep-c': '^1.0.0', 'samchungy-dep-d': '^1.0.0' },
          },
          'samchungy-dep-c': {
            version: '1.0.0',
            resolved: 'https://registry.npmjs.org/samchungy-dep-c/-/samchungy-dep-c-1.0.0.tgz',
            integrity:
              'sha512-YMLl+vnxi7kNr59zq+FFVfBBKyPyxqc7LUU92ZYTkTJaEGHNlCyC2fVC+diIVaomhn4CNAqmOGIVqbr5sq8lQg==',
            requires: { 'samchungy-dep-e': '^1.0.0' },
          },
          'samchungy-dep-d': {
            version: '1.0.0',
            resolved: 'https://registry.npmjs.org/samchungy-dep-d/-/samchungy-dep-d-1.0.0.tgz',
            integrity:
              'sha512-yxXY2+OVhx1e5QZWSWrCajs5b2FCD0CV2ztss+7x4IgQbM0u5gMfzva31kMZFzX2iLJ7iy+09DYpe34TSRrzsA==',
            requires: { 'samchungy-dep-e': '^1.0.0' },
          },
          'samchungy-dep-e': {
            version: '1.0.0',
            resolved: 'https://registry.npmjs.org/samchungy-dep-e/-/samchungy-dep-e-1.0.0.tgz',
            integrity:
              'sha512-phnrKKAOuZdVrVk86R6CNU62YC4bRr/Ru1SokC5ZqkXh4QR30XU4ApSTuLbFADb6F3HWKZTGelaoklyMW2mveg==',
          },
        },
      },
      devDependencies: {},
      optionalDependencies: {},
      _dependencies: { 'samchungy-a': '3.0.0', 'samchungy-b': '5.0.0' },
      path: '/workdir/.esbuild/.build',
      error: '[Circular]',
      extraneous: false,
    };

    const v7depsList: NpmV7Deps = {
      version: '1.0.0',
      name: 'serverless-example',
      description: 'Packaged externals for serverless-example',
      private: true,
      scripts: {},
      _id: 'serverless-example@1.0.0',
      extraneous: false,
      path: '/workdir/.esbuild/.build',
      _dependencies: { 'samchungy-a': '3.0.0', 'samchungy-b': '5.0.0' },
      devDependencies: {},
      peerDependencies: {},
      dependencies: {
        'samchungy-a': {
          version: '3.0.0',
          resolved: 'https://registry.npmjs.org/samchungy-a/-/samchungy-a-3.0.0.tgz',
          name: 'samchungy-a',
          integrity: 'sha512-5u55rgjPpASgPDU2jLYf4HCt31jUVtzy/r42q4SyJ4W+ItggEk+8w3WBfXRcQgxYyyWflL1F9w85u3Wudj542g==',
          _id: 'samchungy-a@3.0.0',
          extraneous: false,
          path: '/workdir/.esbuild/.build/node_modules/samchungy-a',
          _dependencies: { 'samchungy-dep-b': '3.0.0' },
          devDependencies: {},
          peerDependencies: {},
          dependencies: {
            'samchungy-dep-b': {
              version: '3.0.0',
              resolved: 'https://registry.npmjs.org/samchungy-dep-b/-/samchungy-dep-b-3.0.0.tgz',
              name: 'samchungy-dep-b',
              integrity:
                'sha512-fy6RAnofLSnLHgOUmgsFz0ZFnJcJeNHT+qUfHJ7daIFlBaciRDR6v5sdWm7mAM2EzQ1KFf2hmKJVFZgthVeCAw==',
              _id: 'samchungy-dep-b@3.0.0',
              extraneous: false,
              path: '/workdir/.esbuild/.build/node_modules/samchungy-dep-b',
              _dependencies: {
                'samchungy-dep-c': '^1.0.0',
                'samchungy-dep-d': '^1.0.0',
              },
              devDependencies: {},
              peerDependencies: {},
              dependencies: {
                'samchungy-dep-c': {
                  version: '1.0.0',
                  resolved: 'https://registry.npmjs.org/samchungy-dep-c/-/samchungy-dep-c-1.0.0.tgz',
                  name: 'samchungy-dep-c',
                  integrity:
                    'sha512-YMLl+vnxi7kNr59zq+FFVfBBKyPyxqc7LUU92ZYTkTJaEGHNlCyC2fVC+diIVaomhn4CNAqmOGIVqbr5sq8lQg==',
                  _id: 'samchungy-dep-c@1.0.0',
                  extraneous: false,
                  path: '/workdir/.esbuild/.build/node_modules/samchungy-dep-c',
                  _dependencies: { 'samchungy-dep-e': '^1.0.0' },
                  devDependencies: {},
                  peerDependencies: {},
                  dependencies: {
                    'samchungy-dep-e': {
                      version: '1.0.0',
                      resolved: 'https://registry.npmjs.org/samchungy-dep-e/-/samchungy-dep-e-1.0.0.tgz',
                      name: 'samchungy-dep-e',
                      integrity:
                        'sha512-phnrKKAOuZdVrVk86R6CNU62YC4bRr/Ru1SokC5ZqkXh4QR30XU4ApSTuLbFADb6F3HWKZTGelaoklyMW2mveg==',
                      _id: 'samchungy-dep-e@1.0.0',
                      extraneous: false,
                      path: '/workdir/.esbuild/.build/node_modules/samchungy-dep-e',
                      _dependencies: {},
                      devDependencies: {},
                      peerDependencies: {},
                    },
                  },
                },
                'samchungy-dep-d': {
                  version: '1.0.0',
                  resolved: 'https://registry.npmjs.org/samchungy-dep-d/-/samchungy-dep-d-1.0.0.tgz',
                  name: 'samchungy-dep-d',
                  integrity:
                    'sha512-yxXY2+OVhx1e5QZWSWrCajs5b2FCD0CV2ztss+7x4IgQbM0u5gMfzva31kMZFzX2iLJ7iy+09DYpe34TSRrzsA==',
                  _id: 'samchungy-dep-d@1.0.0',
                  extraneous: false,
                  path: '/workdir/.esbuild/.build/node_modules/samchungy-dep-d',
                  _dependencies: { 'samchungy-dep-e': '^1.0.0' },
                  devDependencies: {},
                  peerDependencies: {},
                  dependencies: {
                    'samchungy-dep-e': {
                      version: '1.0.0',
                      name: 'samchungy-dep-e',
                      resolved: 'https://registry.npmjs.org/samchungy-dep-e/-/samchungy-dep-e-1.0.0.tgz',
                      integrity:
                        'sha512-phnrKKAOuZdVrVk86R6CNU62YC4bRr/Ru1SokC5ZqkXh4QR30XU4ApSTuLbFADb6F3HWKZTGelaoklyMW2mveg==',
                      _id: 'samchungy-dep-e@1.0.0',
                      extraneous: false,
                      path: '/workdir/.esbuild/.build/node_modules/samchungy-dep-e',
                      _dependencies: {},
                      devDependencies: {},
                      peerDependencies: {},
                    },
                  },
                },
              },
            },
          },
        },
        'samchungy-b': {
          version: '5.0.0',
          resolved: 'https://registry.npmjs.org/samchungy-b/-/samchungy-b-5.0.0.tgz',
          name: 'samchungy-b',
          integrity: 'sha512-Swb34L5tb1agVosN97lXr+HzMzYXvwt2XuZAe9YGVzAWYduObaS5Rc0lwYUkILqKmwqLmtb29Jc2veiNAmU2zw==',
          _id: 'samchungy-b@5.0.0',
          extraneous: false,
          path: '/workdir/.esbuild/.build/node_modules/samchungy-b',
          _dependencies: { 'samchungy-dep-b': '3.0.0' },
          devDependencies: {},
          peerDependencies: {},
          dependencies: {
            'samchungy-dep-b': {
              version: '3.0.0',
              name: 'samchungy-dep-b',
              resolved: 'https://registry.npmjs.org/samchungy-dep-b/-/samchungy-dep-b-3.0.0.tgz',
              integrity:
                'sha512-fy6RAnofLSnLHgOUmgsFz0ZFnJcJeNHT+qUfHJ7daIFlBaciRDR6v5sdWm7mAM2EzQ1KFf2hmKJVFZgthVeCAw==',
              _id: 'samchungy-dep-b@3.0.0',
              extraneous: false,
              path: '/workdir/.esbuild/.build/node_modules/samchungy-dep-b',
              _dependencies: {
                'samchungy-dep-c': '^1.0.0',
                'samchungy-dep-d': '^1.0.0',
              },
              devDependencies: {},
              peerDependencies: {},
            },
          },
        },
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
            'samchungy-dep-c': { version: '1.0.0', isRootDep: true },
            'samchungy-dep-d': { version: '1.0.0', isRootDep: true },
          },
        },
        'samchungy-dep-c': {
          version: '1.0.0',
          dependencies: {
            'samchungy-dep-e': { version: '1.0.0', isRootDep: true },
          },
        },
        'samchungy-dep-d': {
          version: '1.0.0',
          dependencies: {
            'samchungy-dep-e': { version: '1.0.0', isRootDep: true },
          },
        },
        'samchungy-dep-e': { version: '1.0.0' },
      },
    };

    spawnSpy
      .mockResolvedValueOnce({ stderr: '', stdout: '6.0.0' })
      .mockResolvedValueOnce({ stderr: '', stdout: JSON.stringify(v6depsList) });

    const v6dependencies = await npm.getProdDependencies(path);

    spawnSpy
      .mockResolvedValueOnce({ stderr: '', stdout: '7.0.0' })
      .mockResolvedValueOnce({ stderr: '', stdout: JSON.stringify(v7depsList) });

    const v7dependencies = await npm.getProdDependencies(path);

    expect(v6dependencies).toStrictEqual(expectedResult);
    expect(v7dependencies).toStrictEqual(expectedResult);
  });

  it('should handle no dependencies returned from npm output', async () => {
    const v6depsList: NpmV6Deps = {
      name: 'serverless-example',
      version: '1.0.0',
      description: 'Packaged externals for serverless-example',
      private: true,
      scripts: {},
      readme: 'ERROR: No README data found!',
      _id: 'serverless-example@1.0.0',
      _shrinkwrap: {},
      devDependencies: {},
      optionalDependencies: {},
      _dependencies: {},
      path: '/workdir/.esbuild/.build',
      error: '[Circular]',
      extraneous: false,
    };

    const expectedResult: DependenciesResult = {};

    spawnSpy
      .mockResolvedValueOnce({ stderr: '', stdout: '6.0.0' })
      .mockResolvedValueOnce({ stderr: '', stdout: JSON.stringify(v6depsList) });

    const v6dependencies = await npm.getProdDependencies(path);

    expect(v6dependencies).toStrictEqual(expectedResult);
  });

  it.each([
    'npm ERR! code ELSPROBLEMS',
    'npm ERR! extraneous: foo@1.2.3 ./bar/node_modules/foo',
    'npm ERR! missing: foo-1@1.0.0, required by foo-2@1.0.0',
    'npm ERR! peer dep missing: foo@1.2.3',
  ])('should ignore npm error "%s"', async (ignoredNpmError) => {
    const v7depsList: NpmV7Deps = {
      version: '1.0.0',
      name: 'serverless-example',
      description: 'Packaged externals for serverless-example',
      private: true,
      scripts: {},
      _id: 'serverless-example@1.0.0',
      extraneous: false,
      path: '/workdir/.esbuild/.build',
      _dependencies: {
        'samchungy-a': '2.0.0',
        'samchungy-b': '2.0.0',
      },
      devDependencies: {},
      peerDependencies: {},
      dependencies: {
        'samchungy-a': {
          version: '2.0.0',
          resolved: 'https://registry.npmjs.org/samchungy-a/-/samchungy-a-2.0.0.tgz',
          name: 'samchungy-a',
          integrity: 'sha512-gUv/cvd9AFYvvGep0e9m1wSAf3dfnb71eri5TjtgC6N7qvJALXFaFVOkLNBHEYGEm2ZJdosXvGqr3ISZ7Yh46Q==',
          _id: 'samchungy-a@2.0.0',
          extraneous: false,
          path: '/workdir/.esbuild/.build/node_modules/samchungy-a',
          _dependencies: {
            'samchungy-dep-a': '1.0.0',
          },
          devDependencies: {},
          peerDependencies: {},
          dependencies: {
            'samchungy-dep-a': {
              version: '1.0.0',
              resolved: 'https://registry.npmjs.org/samchungy-dep-a/-/samchungy-dep-a-1.0.0.tgz',
              name: 'samchungy-dep-a',
              integrity:
                'sha512-NVac5aAU+p7bsIrUTQO438vAO8MHyNILbeckhzxhadIUqGx3L9kEZ5HTqZ+XqDIRARmOU6UmFtus6Bc7q5+mWA==',
              _id: 'samchungy-dep-a@1.0.0',
              extraneous: false,
              path: '/workdir/.esbuild/.build/node_modules/samchungy-dep-a',
              _dependencies: {},
              devDependencies: {},
              peerDependencies: {},
            },
          },
        },
        'samchungy-b': {
          version: '2.0.0',
          resolved: 'https://registry.npmjs.org/samchungy-b/-/samchungy-b-2.0.0.tgz',
          name: 'samchungy-b',
          integrity: 'sha512-i42OG9FC2Py3RfbI8bBFZi3VoN7+MxM0OUvFcWrsIgqvZMUDVI4hNKHqpE6GTt07gDDqQnxlMNehbrsQLtHRVA==',
          _id: 'samchungy-b@2.0.0',
          extraneous: false,
          path: '/workdir/.esbuild/.build/node_modules/samchungy-b',
          _dependencies: {
            'samchungy-dep-a': '2.0.0',
          },
          devDependencies: {},
          peerDependencies: {},
          dependencies: {
            'samchungy-dep-a': {
              version: '2.0.0',
              resolved: 'https://registry.npmjs.org/samchungy-dep-a/-/samchungy-dep-a-2.0.0.tgz',
              name: 'samchungy-dep-a',
              integrity:
                'sha512-Yp30ASjwmyLWCGhlLTqWZa8MlBeBiaaHsmxXMwwQxK/o044vhCsPeugHqhtsZq7Xiq68/TcBux/LKId6eyPNjA==',
              _id: 'samchungy-dep-a@2.0.0',
              extraneous: false,
              path: '/workdir/.esbuild/.build/node_modules/samchungy-b/node_modules/samchungy-dep-a',
              _dependencies: {},
              devDependencies: {},
              peerDependencies: {},
            },
          },
        },
      },
    };

    const npm7stderr: string = ''.concat(
      ignoredNpmError,
      '\n',
      JSON.stringify(
        {
          error: {
            code: 'TEST_ERROR_CODE',
            summary: 'test summary',
            detail: 'test detail',
          },
        },
        null,
        1
      )
    );

    spawnSpy
      .mockResolvedValueOnce({ stderr: '', stdout: '7.0.0' })
      .mockRejectedValueOnce(new utils.SpawnError('a spawn error', JSON.stringify(v7depsList), npm7stderr));

    const result = await npm.getProdDependencies(path);

    expect(result).toStrictEqual({ stdout: JSON.stringify(v7depsList) });
  });
});

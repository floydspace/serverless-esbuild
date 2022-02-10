import { NPM, NpmDeps } from '../../packagers/npm';

import * as utils from '../../utils';

jest.mock('process');
describe('NPM Packager', () => {
  const npm = new NPM();
  const path = './';

  let spawnSpy = jest.spyOn(utils, 'spawnProcess');

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

    expect(spawnSpy).toBeCalledTimes(2);
    expect(spawnSpy).toBeCalledWith('npm', ['--version'], { cwd: './' });
  });

  it('should call spawnProcess with the correct arguments for listing dependencies on npm', async () => {
    spawnSpy
      .mockResolvedValueOnce({ stderr: '', stdout: '6.0.0' })
      .mockResolvedValueOnce({ stderr: '', stdout: '{"dependencies":{}}' });

    await npm.getProdDependencies(path);

    expect(spawnSpy).toBeCalledTimes(2);
    expect(spawnSpy).toBeCalledWith('npm', ['ls', '-json', '-prod', '-long'], { cwd: './' });
  });

  it('should call spawnProcess with the correct arguments for listing dependencies on npm v7', async () => {
    spawnSpy
      .mockResolvedValueOnce({ stderr: '', stdout: '7.0.0' })
      .mockResolvedValueOnce({ stderr: '', stdout: '{"dependencies":{}}' });

    await npm.getProdDependencies(path);

    expect(spawnSpy).toBeCalledTimes(2);
    expect(spawnSpy).toBeCalledWith('npm', ['ls', '-json', '-prod', '-long', '-all'], {
      cwd: './',
    });
  });

  it('should call spawnProcess with the correct arguments for listing dependencies when depth is provided', async () => {
    spawnSpy.mockResolvedValueOnce({ stderr: '', stdout: '{"dependencies":{}}' });

    await npm.getProdDependencies(path, 2);

    expect(spawnSpy).toBeCalledTimes(1);
    expect(spawnSpy).toBeCalledWith('npm', ['ls', '-json', '-prod', '-long', '-depth=2'], {
      cwd: './',
    });
  });

  it('should create a dependency tree from npm v6 output', async () => {
    const depsList: NpmDeps = {
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
          _integrity:
            'sha512-gUv/cvd9AFYvvGep0e9m1wSAf3dfnb71eri5TjtgC6N7qvJALXFaFVOkLNBHEYGEm2ZJdosXvGqr3ISZ7Yh46Q==',
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
          _integrity:
            'sha512-i42OG9FC2Py3RfbI8bBFZi3VoN7+MxM0OUvFcWrsIgqvZMUDVI4hNKHqpE6GTt07gDDqQnxlMNehbrsQLtHRVA==',
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
    spawnSpy
      .mockResolvedValueOnce({ stderr: '', stdout: '6.0.0' })
      .mockResolvedValueOnce({ stderr: '', stdout: JSON.stringify(depsList) });

    const dependencies = await npm.getProdDependencies(path);
    expect(dependencies).toStrictEqual({
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
    });
  });

  it('should create a dependency tree from npm v7 output', async () => {
    const depsList: NpmDeps = {
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
          integrity:
            'sha512-gUv/cvd9AFYvvGep0e9m1wSAf3dfnb71eri5TjtgC6N7qvJALXFaFVOkLNBHEYGEm2ZJdosXvGqr3ISZ7Yh46Q==',
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
          integrity:
            'sha512-i42OG9FC2Py3RfbI8bBFZi3VoN7+MxM0OUvFcWrsIgqvZMUDVI4hNKHqpE6GTt07gDDqQnxlMNehbrsQLtHRVA==',
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
    spawnSpy
      .mockResolvedValueOnce({ stderr: '', stdout: '7.0.0' })
      .mockResolvedValueOnce({ stderr: '', stdout: JSON.stringify(depsList) });

    const dependencies = await npm.getProdDependencies(path);
    expect(dependencies).toStrictEqual({
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
    });
  });
});

import { preLocal } from '../pre-local';

import type EsbuildServerlessPlugin from '../index';

const chdirSpy = jest.spyOn(process, 'chdir').mockImplementation();

afterEach(() => {
  jest.resetAllMocks();
});

it('should call chdir with the buildDirPath if the invoked function is a node function', () => {
  const esbuildPlugin = {
    buildDirPath: 'workdir/.build',
    serverless: {
      config: {},
    },
    options: {
      function: 'hello',
    },
    functions: {
      hello: {},
    },
  };

  preLocal.call(esbuildPlugin as unknown as EsbuildServerlessPlugin);

  expect(chdirSpy).toBeCalledWith(esbuildPlugin.buildDirPath);
});

it('should not call chdir if the invoked function is not a node function', () => {
  const esbuildPlugin = {
    buildDirPath: 'workdir/.build',
    serverless: {
      config: {},
    },
    options: {
      function: 'hello',
    },
    functions: {},
  };

  preLocal.call(esbuildPlugin as unknown as EsbuildServerlessPlugin);

  expect(chdirSpy).not.toBeCalled();
});

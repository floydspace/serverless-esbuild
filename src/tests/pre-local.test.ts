import { preLocal } from '../pre-local';

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
  preLocal.call(esbuildPlugin);
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
  preLocal.call(esbuildPlugin);
  expect(chdirSpy).not.toBeCalled();
});

import { PartialDeep } from 'type-fest';
import EsbuildServerlessPlugin from '..';
import { bundle } from '../bundle';
import { build } from 'esbuild';
import { FunctionBuildResult, FunctionEntry } from '../types';
import pMap from 'p-map';
import { mocked } from 'ts-jest/utils';

jest.mock('esbuild');
jest.mock('p-map');

const esbuildPlugin = (override?: Partial<EsbuildServerlessPlugin>): EsbuildServerlessPlugin =>
  ({
    prepare: jest.fn(),
    serverless: {
      cli: {
        log: jest.fn(),
      },
    },
    buildOptions: {
      concurrency: Infinity,
      bundle: true,
      target: 'node12',
      external: [],
      exclude: ['aws-sdk'],
      nativeZip: false,
      packager: 'npm',
      installExtraArgs: [],
      watch: {},
      keepOutputDirectory: false,
      packagerOptions: {},
      platform: 'node',
    },
    plugins: [],
    buildDirPath: '/workdir/.esbuild',
    functionEntries: [],
    log: {
      error: jest.fn(),
      warning: jest.fn(),
      notice: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
      success: jest.fn(),
    },
    ...override,
  } as PartialDeep<EsbuildServerlessPlugin> as EsbuildServerlessPlugin);

beforeEach(() => {
  mocked(pMap).mockImplementation((entries, mapper) => {
    return Promise.all((entries as string[]).map((entry, index) => mapper(entry, index)));
  });
});

afterEach(() => {
  jest.resetAllMocks();
});

it('should call esbuild only once when functions share the same entry', async () => {
  const functionEntries: FunctionEntry[] = [
    {
      entry: 'file1.ts',
      func: {
        events: [],
        handler: 'file1.handler',
      },
      functionAlias: 'func1',
    },
    {
      entry: 'file1.ts',
      func: {
        events: [],
        handler: 'file1.handler2',
      },
      functionAlias: 'func2',
    },
  ];

  await bundle.call(esbuildPlugin({ functionEntries }));

  expect(build).toBeCalledTimes(1);
});

it('should only call esbuild multiple times when functions have different entries', async () => {
  const functionEntries: FunctionEntry[] = [
    {
      entry: 'file1.ts',
      func: {
        events: [],
        handler: 'file1.handler',
      },
      functionAlias: 'func1',
    },
    {
      entry: 'file2.ts',
      func: {
        events: [],
        handler: 'file2.handler',
      },
      functionAlias: 'func2',
    },
  ];

  await bundle.call(esbuildPlugin({ functionEntries }));

  expect(build).toBeCalledTimes(2);
});

it('should set buildResults after compilation is complete', async () => {
  const functionEntries: FunctionEntry[] = [
    {
      entry: 'file1.ts',
      func: {
        events: [],
        handler: 'file1.handler',
      },
      functionAlias: 'func1',
    },
    {
      entry: 'file2.ts',
      func: {
        events: [],
        handler: 'file2.handler',
      },
      functionAlias: 'func2',
    },
  ];

  const expectedResults: FunctionBuildResult[] = [
    {
      bundlePath: 'file1.js',
      func: { events: [], handler: 'file1.handler' },
      functionAlias: 'func1',
    },
    {
      bundlePath: 'file2.js',
      func: { events: [], handler: 'file2.handler' },
      functionAlias: 'func2',
    },
  ];

  const plugin = esbuildPlugin({ functionEntries });

  await bundle.call(plugin);

  expect(plugin.buildResults).toStrictEqual(expectedResults);
});

it('should set the concurrency for pMap with the concurrency specified', async () => {
  const functionEntries: FunctionEntry[] = [
    {
      entry: 'file1.ts',
      func: {
        events: [],
        handler: 'file1.handler',
      },
      functionAlias: 'func1',
    },
  ];

  const plugin = esbuildPlugin({ functionEntries });

  await bundle.call(plugin);

  expect(pMap).toBeCalledWith(expect.any(Array), expect.any(Function), {
    concurrency: Infinity,
  });
});

it('should filter out non esbuild options', async () => {
  const functionEntries: FunctionEntry[] = [
    {
      entry: 'file1.ts',
      func: {
        events: [],
        handler: 'file1.handler',
      },
      functionAlias: 'func1',
    },
  ];

  const plugin = esbuildPlugin({ functionEntries });

  await bundle.call(plugin);

  expect(build).toBeCalledWith({
    bundle: true,
    entryPoints: ['file1.ts'],
    external: ['aws-sdk'],
    incremental: false,
    outdir: '/workdir/.esbuild',
    platform: 'node',
    plugins: [],
    target: 'node12',
  });
});

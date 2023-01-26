import { build } from 'esbuild';
import pMap from 'p-map';
import type { PartialDeep } from 'type-fest';

import { bundle } from '../bundle';

import type { Configuration, FunctionBuildResult, FunctionEntry } from '../types';
import type EsbuildServerlessPlugin from '../index';

jest.mock('esbuild');
jest.mock('p-map');

const getBuild = async () => {
  const pkg: any = await import('esbuild');
  if (pkg.context) return pkg.context;
  return build;
};

const esbuildPlugin = (override?: Partial<EsbuildServerlessPlugin>): EsbuildServerlessPlugin =>
  ({
    prepare: jest.fn(),
    serverless: {
      cli: {
        log: jest.fn(),
      },
      classes: {
        Error,
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
      outputFileExtension: '.js',
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
  jest.mocked(pMap).mockImplementation((entries, mapper) => {
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

  const proxy = await getBuild();
  expect(proxy).toBeCalledTimes(1);
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

  const proxy = await getBuild();
  expect(proxy).toBeCalledTimes(2);
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

  const config: any = {
    bundle: true,
    entryPoints: ['file1.ts'],
    external: ['aws-sdk'],
    incremental: false,
    outdir: '/workdir/.esbuild',
    platform: 'node',
    plugins: [],
    target: 'node12',
  };

  const proxy = await getBuild();
  const pkg: any = await import('esbuild');
  if (pkg.context) delete config.incremental;

  expect(proxy).toBeCalledWith(config);
});

describe('buildOption platform node', () => {
  it('should set buildResults buildPath after compilation is complete with default extension', async () => {
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

  it('should set buildResults buildPath after compilation is complete with ".cjs" extension', async () => {
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

    const buildOptions: Partial<Configuration> = {
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
      outputFileExtension: '.cjs',
    };

    const expectedResults: FunctionBuildResult[] = [
      {
        bundlePath: 'file1.cjs',
        func: { events: [], handler: 'file1.handler' },
        functionAlias: 'func1',
      },
      {
        bundlePath: 'file2.cjs',
        func: { events: [], handler: 'file2.handler' },
        functionAlias: 'func2',
      },
    ];

    const plugin = esbuildPlugin({ functionEntries, buildOptions: buildOptions as any });

    await bundle.call(plugin);

    expect(plugin.buildResults).toStrictEqual(expectedResults);
  });

  it('should error when trying to use ".mjs" extension', async () => {
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

    const buildOptions: Partial<Configuration> = {
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
      outputFileExtension: '.mjs',
    };

    const plugin = esbuildPlugin({ functionEntries, buildOptions: buildOptions as any });

    const expectedError = 'ERROR: Non esm builds should not output a file with extension ".mjs".';

    try {
      await bundle.call(plugin);
    } catch (error) {
      expect(error).toHaveProperty('message', expectedError);
    }
  });
});

describe('buildOption platform neutral', () => {
  it('should set buildResults buildPath after compilation is complete with default extension', async () => {
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

    const buildOptions: Partial<Configuration> = {
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
      platform: 'neutral',
      outputFileExtension: '.js',
    };

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

    const plugin = esbuildPlugin({ functionEntries, buildOptions: buildOptions as any });

    await bundle.call(plugin);

    expect(plugin.buildResults).toStrictEqual(expectedResults);
  });

  it('should set buildResults buildPath after compilation is complete with ".mjs" extension', async () => {
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

    const buildOptions: Partial<Configuration> = {
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
      platform: 'neutral',
      outputFileExtension: '.mjs',
    };

    const expectedResults: FunctionBuildResult[] = [
      {
        bundlePath: 'file1.mjs',
        func: { events: [], handler: 'file1.handler' },
        functionAlias: 'func1',
      },
      {
        bundlePath: 'file2.mjs',
        func: { events: [], handler: 'file2.handler' },
        functionAlias: 'func2',
      },
    ];

    const plugin = esbuildPlugin({ functionEntries, buildOptions: buildOptions as any });

    await bundle.call(plugin);

    expect(plugin.buildResults).toStrictEqual(expectedResults);
  });

  it('should error when trying to use ".cjs" extension', async () => {
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

    const buildOptions: Partial<Configuration> = {
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
      platform: 'neutral',
      outputFileExtension: '.cjs',
    };

    const plugin = esbuildPlugin({ functionEntries, buildOptions: buildOptions as any });

    const expectedError = 'ERROR: format "esm" or platform "neutral" should not output a file with extension ".cjs".';

    try {
      await bundle.call(plugin);
    } catch (error) {
      expect(error).toHaveProperty('message', expectedError);
    }
  });
});

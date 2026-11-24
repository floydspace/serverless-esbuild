import path from 'node:path';

import fs from 'fs-extra';
import type Serverless from 'serverless';
import type Service from 'serverless/classes/Service';

import EsbuildServerlessPlugin from '../index';
import type { ImprovedServerlessOptions } from '../types';

vi.mock('fs-extra');

const mockProvider: Service['provider'] = {
  name: 'aws',
  region: 'us-east-1',
  stage: 'dev',
  runtime: 'nodejs18.x',
  compiledCloudFormationTemplate: {
    Resources: {},
  },
  versionFunctions: true,
};

const mockGetFunction = vi.fn();

const packageIndividuallyService: Partial<Service> = {
  functions: {
    hello1: { handler: 'hello1.handler', events: [], package: { artifact: 'hello1' } },
    hello2: { handler: 'hello2.handler', events: [], package: { artifact: 'hello2' } },
  },
  package: { individually: true },
  provider: mockProvider,
  getFunction: mockGetFunction,
};

const packageService: Partial<Service> = {
  functions: {
    hello1: { handler: 'hello1.handler', events: [] },
    hello2: { handler: 'hello2.handler', events: [] },
  },
  package: { artifact: 'hello' },
  provider: mockProvider,
  getFunction: mockGetFunction,
};

const patternsService: Partial<Service> = {
  functions: {
    hello1: { handler: 'hello1.handler', events: [] },
    hello2: { handler: 'hello2.handler', events: [], package: {} },
    hello3: { handler: 'hello3.handler', events: [], package: { patterns: ['excluded-by-default.json'] } },
  },
  package: { patterns: ['!excluded-by-default.json'] },
  provider: mockProvider,
  getFunction: mockGetFunction,
};

const workDir = path.join(__dirname, 'fixtures');

const mockServerlessConfig = (serviceOverride?: Partial<Service>): Serverless => {
  const service = {
    ...packageIndividuallyService,
    ...serviceOverride,
  } as Service;

  const mockCli = {
    log: vi.fn(),
  };

  return {
    service,
    config: {
      servicePath: workDir,
      serviceDir: workDir,
    },
    configSchemaHandler: {
      defineCustomProperties: vi.fn(),
      defineFunctionEvent: vi.fn(),
      defineFunctionEventProperties: vi.fn(),
      defineFunctionProperties: vi.fn(),
      defineProvider: vi.fn(),
      defineTopLevelProperty: vi.fn(),
    },
    cli: mockCli,
  } as Partial<Serverless> as Serverless;
};

const mockOptions: ImprovedServerlessOptions = {
  region: 'us-east-1',
  stage: 'dev',
};

afterEach(() => {
  vi.resetAllMocks();
});

/**
 * Wraps a CommonJS module that exports a function in a `vi.fn` spy, so a native `require` of it
 * (which `vi.mock` cannot intercept) returns the spy. The original export is restored after the test.
 */
const spyOnRequire = <T extends (...args: never[]) => unknown>(modulePath: string) => {
  const resolvedPath = require.resolve(modulePath);
  const original = require(resolvedPath) as T;
  const spy = vi.fn(original);

  require.cache[resolvedPath]!.exports = spy;
  onTestFinished(() => {
    require.cache[resolvedPath]!.exports = original;
  });

  return spy;
};

describe('Config file', () => {
  it('should apply options from an async config factory before initialization completes', async () => {
    const config = spyOnRequire(path.join(workDir, 'async-config.js'));
    const serverless = mockServerlessConfig({ custom: { esbuild: { config: './async-config.js' } } });
    const plugin = new EsbuildServerlessPlugin(serverless, mockOptions);

    await plugin.hooks.initialize?.();

    expect(config).toHaveBeenCalledWith(serverless);
    expect(plugin.buildDirPath).toBe(path.join(workDir, '.esbuild', 'custom-build'));
    expect(plugin.buildOptions?.packagerOptions).toEqual({ noInstall: true, ignoreLockfile: false });
  });

  it('should fail initialization when an async config factory rejects', async () => {
    const serverless = mockServerlessConfig({ custom: { esbuild: { config: './async-config-rejects.js' } } });
    const plugin = new EsbuildServerlessPlugin(serverless, mockOptions);

    await expect(plugin.hooks.initialize?.()).rejects.toThrow('config failed');
  });
});

describe('Move Artifacts', () => {
  it('should copy files from the esbuild folder to the serverless folder', async () => {
    const plugin = new EsbuildServerlessPlugin(mockServerlessConfig(), mockOptions);

    await plugin.hooks.initialize?.();

    await plugin.moveArtifacts();

    expect(fs.copy).toHaveBeenCalledWith(
      path.join(workDir, '.esbuild', '.serverless'),
      path.join(workDir, '.serverless')
    );
  });

  describe('function option', () => {
    it('should update the selected functions base path to the serverless folder', async () => {
      mockGetFunction.mockReturnValue(packageIndividuallyService.functions?.hello1);
      const plugin = new EsbuildServerlessPlugin(mockServerlessConfig(), {
        ...mockOptions,
        function: 'hello1',
      });

      await plugin.hooks.initialize?.();

      await plugin.moveArtifacts();

      expect(plugin.functions).toMatchInlineSnapshot(`
        {
          "hello1": {
            "events": [],
            "handler": "hello1.handler",
            "package": {
              "artifact": ".serverless/hello1",
            },
          },
        }
      `);
    });
  });

  describe('package individually', () => {
    it('should update function package artifacts base path to the serverless folder', async () => {
      const plugin = new EsbuildServerlessPlugin(mockServerlessConfig(), mockOptions);

      await plugin.hooks.initialize?.();

      await plugin.moveArtifacts();

      expect(plugin.functions).toMatchInlineSnapshot(`
        {
          "hello1": {
            "events": [],
            "handler": "hello1.handler",
            "package": {
              "artifact": ".serverless/hello1",
            },
          },
          "hello2": {
            "events": [],
            "handler": "hello2.handler",
            "package": {
              "artifact": ".serverless/hello2",
            },
          },
        }
      `);
    });

    it('should only update the base path of node functions', async () => {
      const plugin = new EsbuildServerlessPlugin(
        mockServerlessConfig({
          functions: {
            ...packageIndividuallyService.functions,
            hello3: { handler: 'hello3.handler', events: [], runtime: 'python2.7' },
          },
        }),
        mockOptions
      );

      await plugin.hooks.initialize?.();

      await plugin.moveArtifacts();

      expect(plugin.functions).toMatchInlineSnapshot(`
        {
          "hello1": {
            "events": [],
            "handler": "hello1.handler",
            "package": {
              "artifact": ".serverless/hello1",
            },
          },
          "hello2": {
            "events": [],
            "handler": "hello2.handler",
            "package": {
              "artifact": ".serverless/hello2",
            },
          },
        }
      `);
    });

    it('should skip function if skipEsbuild is set to true', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const hello3 = { handler: 'hello3.handler', events: [], skipEsbuild: true };
      const plugin = new EsbuildServerlessPlugin(
        mockServerlessConfig({
          functions: {
            ...packageIndividuallyService.functions,
            hello3,
          },
        }),
        mockOptions
      );
      await plugin.hooks.initialize?.();

      await plugin.moveArtifacts();

      expect(plugin.functions).toMatchInlineSnapshot(`
        {
          "hello1": {
            "events": [],
            "handler": "hello1.handler",
            "package": {
              "artifact": ".serverless/hello1",
            },
          },
          "hello2": {
            "events": [],
            "handler": "hello2.handler",
            "package": {
              "artifact": ".serverless/hello2",
            },
          },
          "hello3": {
            "events": [],
            "handler": "hello3.handler",
            "skipEsbuild": true,
          },
        }
      `);

      expect(plugin.functionEntries).toEqual(
        expect.arrayContaining([
          {
            entry: expect.stringContaining('/hello1.ts'),
            func: {
              events: [],
              handler: 'hello1.handler',
              package: {
                artifact: '.serverless/hello1',
              },
            },
            functionAlias: 'hello1',
          },
          {
            entry: expect.stringContaining('/hello2.ts'),
            func: {
              events: [],
              handler: 'hello2.handler',
              package: {
                artifact: '.serverless/hello2',
              },
            },
            functionAlias: 'hello2',
          },
        ])
      );
      expect(plugin.functionEntries).not.toContain(
        expect.objectContaining({
          functionAlias: 'hello3',
        })
      );
    });
  });

  describe('service package', () => {
    it('should update the service package artifact base path to the serverless folder', async () => {
      const plugin = new EsbuildServerlessPlugin(mockServerlessConfig(packageService), mockOptions);

      await plugin.hooks.initialize?.();

      await plugin.moveArtifacts();

      expect(plugin.serverless.service.package.artifact).toBe('.serverless/hello');
    });
  });
});

describe('Prepare', () => {
  describe('function package', () => {
    it('should set package patterns on functions only if supplied', async () => {
      const plugin = new EsbuildServerlessPlugin(mockServerlessConfig(patternsService), mockOptions);

      await plugin.hooks.initialize?.();

      plugin.prepare();

      expect(plugin.functions).toMatchInlineSnapshot(`
        {
          "hello1": {
            "events": [],
            "handler": "hello1.handler",
            "package": {},
          },
          "hello2": {
            "events": [],
            "handler": "hello2.handler",
            "package": {},
          },
          "hello3": {
            "events": [],
            "handler": "hello3.handler",
            "package": {
              "patterns": [
                "excluded-by-default.json",
              ],
            },
          },
        }
      `);
    });

    it('should copy the previous build resources if skipBuild is true', async () => {
      const skipBuildServerlessConfig = {
        ...patternsService,
        custom: {
          esbuild: {
            skipBuild: true,
          },
        },
      };
      const plugin = new EsbuildServerlessPlugin(mockServerlessConfig(skipBuildServerlessConfig), mockOptions);
      const copyPreBuiltResourcesSpy = vi.spyOn(plugin, 'copyPreBuiltResources');
      const prepareSpy = vi.spyOn(plugin, 'prepare');

      await plugin.hooks.initialize?.();
      expect(copyPreBuiltResourcesSpy).toHaveBeenCalled();
      expect(prepareSpy).toHaveBeenCalled();
    });
  });
});

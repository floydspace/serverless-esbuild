import Serverless from 'serverless';
import Service from 'serverless/classes/Service';
import EsbuildServerlessPlugin from '../index';

import fs from 'fs-extra';

jest.mock('fs-extra');

const mockProvider: Service['provider'] = {
  name: 'aws',
  region: 'us-east-1',
  stage: 'dev',
  runtime: 'nodejs12.x',
  compiledCloudFormationTemplate: {
    Resources: {},
  },
  versionFunctions: true,
};

const mockGetFunction = jest.fn();

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

const mockServerlessConfig = (serviceOverride?: Partial<Service>): Serverless => {
  const service = {
    ...packageIndividuallyService,
    ...serviceOverride,
  } as Service;

  const mockCli = {
    log: jest.fn(),
  };

  return {
    service,
    config: {
      servicePath: '/workDir',
    },
    cli: mockCli,
  } as Partial<Serverless> as Serverless;
};

const mockOptions: Serverless.Options = {
  region: 'us-east-1',
  stage: 'dev',
};

afterEach(() => {
  jest.resetAllMocks();
});

describe('Move Artifacts', () => {
  it('should copy files from the esbuild folder to the serverless folder', async () => {
    const plugin = new EsbuildServerlessPlugin(mockServerlessConfig(), mockOptions);
    plugin.hooks.initialize();

    await plugin.moveArtifacts();

    expect(fs.copy).toBeCalledWith('/workDir/.esbuild/.serverless', '/workDir/.serverless');
  });

  describe('function option', () => {
    it('should update the selected functions base path to the serverless folder', async () => {
      mockGetFunction.mockReturnValue(packageIndividuallyService.functions.hello1);
      const plugin = new EsbuildServerlessPlugin(mockServerlessConfig(), {
        ...mockOptions,
        function: 'hello1',
      });
      plugin.hooks.initialize();

      await plugin.moveArtifacts();

      expect(plugin.functions).toMatchInlineSnapshot(`
        Object {
          "hello1": Object {
            "events": Array [],
            "handler": "hello1.handler",
            "package": Object {
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
      plugin.hooks.initialize();

      await plugin.moveArtifacts();

      expect(plugin.functions).toMatchInlineSnapshot(`
        Object {
          "hello1": Object {
            "events": Array [],
            "handler": "hello1.handler",
            "package": Object {
              "artifact": ".serverless/hello1",
            },
          },
          "hello2": Object {
            "events": Array [],
            "handler": "hello2.handler",
            "package": Object {
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
      plugin.hooks.initialize();

      await plugin.moveArtifacts();

      expect(plugin.functions).toMatchInlineSnapshot(`
        Object {
          "hello1": Object {
            "events": Array [],
            "handler": "hello1.handler",
            "package": Object {
              "artifact": ".serverless/hello1",
            },
          },
          "hello2": Object {
            "events": Array [],
            "handler": "hello2.handler",
            "package": Object {
              "artifact": ".serverless/hello2",
            },
          },
        }
      `);
    });
  });

  describe('service package', () => {
    it('should update the service package artifact base path to the serverless folder', async () => {
      const plugin = new EsbuildServerlessPlugin(mockServerlessConfig(packageService), mockOptions);
      plugin.hooks.initialize();

      await plugin.moveArtifacts();

      expect(plugin.serverless.service.package.artifact).toBe('.serverless/hello');
    });
  });
});

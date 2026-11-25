import type { MockInstance } from 'vitest';
import { Pnpm } from '../../packagers/pnpm';
import * as utils from '../../utils';

describe('Pnpm Packager', () => {
  const pnpm = new Pnpm();
  const path = './';
  const expectedCommand = /^win/.test(process.platform) ? 'pnpm.cmd' : 'pnpm';

  let spawnSpy: MockInstance;

  beforeEach(() => {
    spawnSpy = vi.spyOn(utils, 'spawnProcess');
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.restoreAllMocks();
  });

  it('should call spawnProcess with --ignore-workspace when listing pnpm dependencies', async () => {
    spawnSpy.mockResolvedValueOnce({
      stderr: '',
      stdout: '[{"dependencies":{}}]',
    });

    await pnpm.getProdDependencies(path);

    expect(spawnSpy).toHaveBeenCalledTimes(1);
    expect(spawnSpy).toHaveBeenCalledWith(expectedCommand, ['--ignore-workspace', 'ls', '--prod', '--json'], {
      cwd: './',
    });
  });

  it('should call spawnProcess with --ignore-workspace and depth when depth is provided', async () => {
    spawnSpy.mockResolvedValueOnce({
      stderr: '',
      stdout: '[{"dependencies":{}}]',
    });

    await pnpm.getProdDependencies(path, 2);

    expect(spawnSpy).toHaveBeenCalledTimes(1);
    expect(spawnSpy).toHaveBeenCalledWith(
      expectedCommand,
      ['--ignore-workspace', 'ls', '--prod', '--json', '--depth=2'],
      {
        cwd: './',
      }
    );
  });

  it('should return the first package entry parsed from pnpm ls output', async () => {
    const expectedResult = {
      name: 'serverless-example',
      version: '1.0.0',
      dependencies: {
        lodash: {
          version: '4.17.21',
        },
      },
    };

    spawnSpy.mockResolvedValueOnce({
      stderr: '',
      stdout: JSON.stringify([expectedResult]),
    });

    const result = await pnpm.getProdDependencies(path);

    expect(result).toStrictEqual(expectedResult);
  });
});

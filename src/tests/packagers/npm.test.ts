import { NPM } from '../../packagers/npm';
import * as path from 'path';
import * as mockSpawn from 'mock-spawn';

describe('test NPM class', () => {
  let spawnSpy = mockSpawn();

  beforeEach(() => {
    spawnSpy = mockSpawn();
    require('child_process').spawn = spawnSpy;
  });

  it('should properly get the dependencies list', async () => {
    spawnSpy.sequence.add(spawnSpy.simple(0, '6.0.0'));
    spawnSpy.sequence.add(spawnSpy.simple(0, '{"dependencies":{}}'));

    const npm = new NPM();
    const dependencies = await npm.getProdDependencies(path.join('./'));

    expect(spawnSpy.calls.length).toStrictEqual(2);
    expect(spawnSpy.calls[0].args).toStrictEqual(['--version']);
    expect(spawnSpy.calls[1].args).toStrictEqual(['ls', '-json', '-prod', '-long']);
    expect(dependencies).toStrictEqual({ dependencies: {} });
  });

  it('should properly get the dependencies list w/ depth', async () => {
    spawnSpy.sequence.add(spawnSpy.simple(0, '{"dependencies":{}}'));

    const npm = new NPM();
    const dependencies = await npm.getProdDependencies(path.join('./'), 2);

    expect(spawnSpy.calls.length).toStrictEqual(1);
    expect(spawnSpy.calls[0].args).toStrictEqual(['ls', '-json', '-prod', '-long', '-depth=2']);
    expect(dependencies).toStrictEqual({ dependencies: {} });
  });

  it('should properly get the dependencies list (npm version >= 7)', async () => {
    spawnSpy.sequence.add(spawnSpy.simple(0, '7.0.0'));
    spawnSpy.sequence.add(spawnSpy.simple(0, '{"dependencies":{}}'));

    const npm = new NPM();
    const dependencies = await npm.getProdDependencies(path.join('./'));

    expect(spawnSpy.calls.length).toStrictEqual(2);
    expect(spawnSpy.calls[0].args).toStrictEqual(['--version']);
    expect(spawnSpy.calls[1].args).toStrictEqual(['ls', '-json', '-prod', '-long', '-all']);
    expect(dependencies).toStrictEqual({ dependencies: {} });
  });

  it('should properly get the dependencies list w/ depth (npm version >= 7)', async () => {
    spawnSpy.sequence.add(spawnSpy.simple(0, '{"dependencies":{}}'));

    const npm = new NPM();
    const dependencies = await npm.getProdDependencies(path.join('./'), 2);

    expect(spawnSpy.calls.length).toStrictEqual(1);
    expect(spawnSpy.calls[0].args).toStrictEqual(['ls', '-json', '-prod', '-long', '-depth=2']);
    expect(dependencies).toStrictEqual({ dependencies: {} });
  });
});

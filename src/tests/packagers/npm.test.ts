import { NPM } from '../../packagers/npm';
import * as path from 'path';
import * as mockSpawn from 'mock-spawn';

describe('test NPM class', () => {
  it('should properly get the dependencies list', async () => {
    jest.resetAllMocks();

    const mySpawn = mockSpawn();
    require('child_process').spawn = mySpawn;

    mySpawn.sequence.add(mySpawn.simple(0, '6.0.0'));
    mySpawn.sequence.add(mySpawn.simple(0, '{"dependencies":{}}'));

    const npm = new NPM();
    const dependencies = await npm.getProdDependencies(path.join('./'));
    
    expect(mySpawn.calls.length).toStrictEqual(2);
    expect(mySpawn.calls[0].args).toStrictEqual(['--version']);
    expect(mySpawn.calls[1].args).toStrictEqual(['ls', '-json', '-prod']);
    expect(dependencies).toStrictEqual({'dependencies':{}});
    jest.resetAllMocks();
  });

  it('should properly get the dependencies list w/ depth', async () => {
    jest.resetAllMocks();

    const mySpawn = mockSpawn();
    require('child_process').spawn = mySpawn;

    mySpawn.sequence.add(mySpawn.simple(0, '{"dependencies":{}}'));

    const npm = new NPM();
    const dependencies = await npm.getProdDependencies(path.join('./'), 2);
    
    expect(mySpawn.calls.length).toStrictEqual(1);
    expect(mySpawn.calls[0].args).toStrictEqual(['ls', '-json', '-prod', '-depth=2']);
    expect(dependencies).toStrictEqual({'dependencies':{}});
    jest.resetAllMocks();
  });

  it('should properly get the dependencies list (npm version >= 7)', async () => {
    jest.resetAllMocks();

    const mySpawn = mockSpawn();
    require('child_process').spawn = mySpawn;

    mySpawn.sequence.add(mySpawn.simple(0, '7.0.0'));
    mySpawn.sequence.add(mySpawn.simple(0, '{"dependencies":{}}'));

    const npm = new NPM();
    const dependencies = await npm.getProdDependencies(path.join('./'));
    
    expect(mySpawn.calls.length).toStrictEqual(2);
    expect(mySpawn.calls[0].args).toStrictEqual(['--version']);
    expect(mySpawn.calls[1].args).toStrictEqual(['ls', '-json', '-prod', '-all']);
    expect(dependencies).toStrictEqual({'dependencies':{}});
    jest.resetAllMocks();
  });

  it('should properly get the dependencies list w/ depth (npm version >= 7)', async () => {
    jest.resetAllMocks();

    const mySpawn = mockSpawn();
    require('child_process').spawn = mySpawn;

    mySpawn.sequence.add(mySpawn.simple(0, '{"dependencies":{}}'));

    const npm = new NPM();
    const dependencies = await npm.getProdDependencies(path.join('./'), 2);
    
    expect(mySpawn.calls.length).toStrictEqual(1);
    expect(mySpawn.calls[0].args).toStrictEqual(['ls', '-json', '-prod', '-depth=2']);
    expect(dependencies).toStrictEqual({'dependencies':{}});
    jest.resetAllMocks();
  });
});

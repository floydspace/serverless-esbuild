import { getModuleVersion, getProdModules } from '../pack-externals';

import type EsbuildServerlessPlugin from '../index';

describe('pack-externals/getModuleVersion', () => {
  it('should keep a version range from package.json', () => {
    expect(getModuleVersion('^1.2.0', '1.2.3')).toEqual('^1.2.0');
  });

  it('should use the installed version when package.json has no version', () => {
    expect(getModuleVersion(undefined, '1.2.3')).toEqual('1.2.3');
  });

  it.each(['catalog:', 'catalog:frontend', 'workspace:*', 'workspace:^'])(
    'should use the installed version instead of %s',
    (dependencyVersion) => {
      expect(getModuleVersion(dependencyVersion, '1.2.3')).toEqual('1.2.3');
    }
  );

  it('should return no version for a workspace-only protocol when the module is not installed', () => {
    expect(getModuleVersion('catalog:', undefined)).toBeUndefined();
  });
});

describe('pack-externals/getProdModules', () => {
  const callGetProdModules = (dependencies: Record<string, string>) => {
    const warning = vi.fn();
    const plugin = {
      serverless: { utils: { readFileSync: () => ({ dependencies }) } },
      log: { warning, debug: vi.fn() },
      buildOptions: { exclude: [] },
    } as unknown as EsbuildServerlessPlugin;

    const modules = getProdModules.call(
      plugin,
      [{ external: 'not-installed-module' }],
      'missing/package.json',
      'missing/package.json'
    );

    return { warning, modules };
  };

  it('should warn when a workspace-only protocol cannot be resolved because the module is not installed', () => {
    const { modules, warning } = callGetProdModules({ 'not-installed-module': 'catalog:' });

    expect(modules).toEqual(['not-installed-module']);
    expect(warning).toHaveBeenCalledWith(expect.stringContaining("Could not resolve 'catalog:'"));
  });

  it('should not warn when a version range is used for a module that is not installed', () => {
    const { modules, warning } = callGetProdModules({ 'not-installed-module': '^1.2.0' });

    expect(modules).toEqual(['not-installed-module@^1.2.0']);
    expect(warning).not.toHaveBeenCalled();
  });
});

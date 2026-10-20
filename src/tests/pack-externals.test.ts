import { getModuleVersion } from '../pack-externals';

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

import { findProjectRoot } from '../utils';
import * as path from 'path';

describe('utils/findProjectRoot', () => {
  it('should properly Find a Project Root.', () => {
    /* Broken implementation in pack-externals we're trying to fix. */
    const rootPackageJsonPath = path.join(findProjectRoot() || '', './package.json');

    /* Looking up at project root relative to ./src/tests/ */
    expect(rootPackageJsonPath).toEqual(path.join(__dirname, '../../package.json'));
  });
});

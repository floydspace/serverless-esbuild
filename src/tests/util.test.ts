import { findProjectRoot } from '../utils';
import path from 'path';

describe('A Util Function.', () => {
    it('Should properly Find a Project Root.', () => {
        const rootPackageJsonPath = path.join(findProjectRoot(), './package.json');
        console.log(rootPackageJsonPath);

        expect(rootPackageJsonPath).toEqual(path.join(__dirname, '../../package.json'));
    });
});

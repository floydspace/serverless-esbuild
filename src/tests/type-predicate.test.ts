import { isPackagerId } from '../type-predicate';

describe('isPackagerId()', () => {
  it('Returns true for valid input', () => {
    ['npm', 'pnpm', 'yarn'].forEach((id) => {
      expect(isPackagerId(id)).toBeTruthy();
    });
  });

  it('Returns false for invalid input', () => {
    ['not-a-real-packager-id', false, 123, [], {}].forEach((id) => {
      expect(isPackagerId(id)).toBeFalsy();
    });
  });
});

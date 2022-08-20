import type { PackagerId } from './types';

export function isPackagerId(input: unknown): input is PackagerId {
  return input === 'npm' || input === 'pnpm' || input === 'yarn';
}

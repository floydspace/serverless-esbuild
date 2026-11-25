import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    projects: [
      {
        extends: true,
        test: { name: 'unit', root: 'src', include: ['tests/**/*.test.ts'] },
      },
      {
        extends: true,
        test: { name: 'e2e', root: 'e2e', include: ['*.test.ts'] },
      },
    ],
  },
});

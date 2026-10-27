import { defineConfig } from 'vitest/config';

// Root suite: workspace/scaffold checks under test/. api and web carry their own configs.
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    testTimeout: 120_000,
    coverage: {
      provider: 'v8',
      include: ['test/**/*.ts'],
      exclude: ['**/*.test.ts'],
      all: true,
      reporter: ['text', 'json-summary', 'lcov'],
      reportsDirectory: 'coverage',
    },
  },
});

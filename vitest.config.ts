import { defineConfig } from 'vitest/config';
// import tsconfigPaths from 'vite-tsconfig-paths';
import path from 'path';

export default defineConfig({
  // plugins: [tsconfigPaths()],
  test: {
    alias: {
      '@status-machina/knexjs-pg-pattern': path.resolve(
        __dirname,
        process.env.TEST_COVERAGE === 'true' ? './src' : './dist',
      ),
    },
    typecheck: {
      tsconfig: './tsconfig.json',
    },
    coverage: {
      provider: 'istanbul',
      enabled: process.env.TEST_COVERAGE === 'true',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'knexfile.ts',
        'migrations/**',
        'scripts/**',
        'dist/**',
        'tsup.config.ts',
        'vitest.config.ts',
        'src/migration-functions.ts',
      ],
    },
  },
});

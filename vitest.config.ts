import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    alias: {
      '@status-machina/knexjs-pg-pattern': './dist',
    },
    typecheck: {
      tsconfig: './tsconfig.json',
    },
    coverage: {
      provider: 'istanbul',
      exclude: [
        'knexfile.ts',
        'migrations/**',
        'scripts/**',
        'dist/**',
        'tsup.config.ts',
        'vitest.config.ts',
      ],
      include: ['src/**/*.ts'],
    },
  },
});

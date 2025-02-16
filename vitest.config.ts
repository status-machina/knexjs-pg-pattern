import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    alias: {
      '@status-machina/knexjs-pg-pattern': './dist',
    },
    typecheck: {
      tsconfig: './tsconfig.test.json',
    },
  },
});

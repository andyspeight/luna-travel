import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// No jsdom: every tested module is pure. The '@' alias mirrors tsconfig paths so
// the test files import exactly what the app imports.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/__tests__/**/*.test.ts'],
    environment: 'node',
  },
});

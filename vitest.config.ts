import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// No jsdom: every tested module is pure. The '@' alias mirrors tsconfig paths so
// the test files import exactly what the app imports.
export default defineConfig({
  // The same JSX transform Next uses, for the one route that draws an image.
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/__tests__/**/*.test.ts'],
    environment: 'node',
    // Pinned, because several suites assert on clock times a traveller reads.
    // The container already runs UTC, so this changes nothing here — it stops
    // the same tests failing on a laptop in London between March and October.
    env: { TZ: 'UTC' },
  },
});

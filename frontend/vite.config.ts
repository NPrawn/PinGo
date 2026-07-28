import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { rm } from 'node:fs/promises';
import { fileURLToPath, URL } from 'node:url';
import { join } from 'node:path';
import type { Plugin } from 'vite';

/**
 * The Claude design prototype lives in `public/` so the team can still open it
 * at `/pingo-user.html` during development. Vite copies `public/` verbatim into
 * the build, which would ship ~4.7 MB of Babel and React UMD bundles that the
 * app itself does not use, so drop those files from the production output.
 *
 * Remove this plugin once the prototype files leave `public/`.
 */
function excludePrototypeFromBuild(): Plugin {
  const PREFIX = 'pingo-';
  return {
    name: 'pingo-exclude-prototype-from-build',
    apply: 'build',
    async closeBundle() {
      const outDir = fileURLToPath(new URL('./dist', import.meta.url));
      const { readdir } = await import('node:fs/promises');
      const entries = await readdir(outDir).catch(() => []);
      await Promise.all(
        entries
          .filter((name) => name.startsWith(PREFIX))
          .map((name) => rm(join(outDir, name), { force: true })),
      );
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), excludePrototypeFromBuild()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});

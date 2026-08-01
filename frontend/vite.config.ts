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

/**
 * 개발 서버가 대신 호출해 줄 백엔드.
 *
 * 실기기 확인 때 필요하다. 배포 백엔드의 CORS 허용 목록에 LAN 주소(`http://192.168.x.x:5173`)가
 * 없어서 폰에서 직접 부르면 403이 되는데, 개발 서버가 대신 부르면 브라우저에는 같은 오리진
 * 요청이라 CORS가 발생하지 않는다. IP가 바뀔 때마다 백엔드에 허용 요청을 넣지 않아도 된다.
 *
 * 프록시를 타려면 `VITE_API_BASE_URL`을 빈 값으로 두어야 한다. 그러면 앱이 상대 경로로
 * 호출하고, 그 요청이 아래 target으로 전달된다.
 */
const DEV_API_TARGET = process.env.VITE_DEV_API_TARGET ?? 'http://localhost:8080';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), excludePrototypeFromBuild()],
  server: {
    proxy: {
      '/api': { target: DEV_API_TARGET, changeOrigin: true },
      // 지도 도면 등 백엔드가 서빙하는 정적 파일. (API 명세서 2.5)
      '/uploads': { target: DEV_API_TARGET, changeOrigin: true },
    },
  },
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

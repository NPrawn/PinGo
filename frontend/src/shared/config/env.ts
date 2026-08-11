import { z } from 'zod';

const optionalUrl = z.union([z.url(), z.literal('')]).default('');
const envSchema = z.object({
  /**
   * 백엔드 주소. **빈 값이면 같은 오리진으로 호출한다.**
   *
   * 개발 서버의 `/api` 프록시를 타려고 비워 두는 경우가 있다(vite.config.ts). 실기기 확인에서
   * LAN 주소가 백엔드 CORS 허용 목록에 없을 때 쓴다.
   */
  VITE_API_BASE_URL: z
    .union([z.url(), z.literal('')])
    .default('https://jenkins.example.invalid'),
  VITE_WS_BASE_URL: z.url().default('wss://jenkins.example.invalid'),
  VITE_APP_ENV: z.enum(['development', 'test', 'production']).default('development'),
  // The presentation build uses deterministic captions unless explicitly disabled.
  VITE_DEMO_CAPTIONS: z.enum(['true', 'false']).default('true'),
  VITE_NAVER_MAP_BASE_URL: optionalUrl,
  VITE_STUN_URL: optionalUrl,
  VITE_TURN_URL: optionalUrl,
  VITE_TURN_USERNAME: z.string().default(''),
  VITE_TURN_CREDENTIAL: z.string().default(''),
});

export const env = envSchema.parse(import.meta.env);

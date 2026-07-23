import { z } from 'zod';

const optionalUrl = z.union([z.url(), z.literal('')]).default('');
const envSchema = z.object({
  VITE_API_BASE_URL: z.url().default('http://localhost:8080'),
  VITE_WS_BASE_URL: z.url().default('ws://localhost:8080'),
  VITE_APP_ENV: z.enum(['development', 'test', 'production']).default('development'),
  VITE_NAVER_MAP_BASE_URL: optionalUrl,
  VITE_STUN_URL: optionalUrl,
  VITE_TURN_URL: optionalUrl,
  VITE_TURN_USERNAME: z.string().default(''),
  VITE_TURN_CREDENTIAL: z.string().default(''),
});

export const env = envSchema.parse(import.meta.env);

import axios from 'axios';
import type { AxiosError } from 'axios';
import { env } from '@/shared/config';
import { clearAuthSession, getAccessToken } from './authSession';
import { ApiError, type ApiResponse } from './types';

export const apiClient = axios.create({
  baseURL: env.VITE_API_BASE_URL,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * 로그인 세션과 무관한 요청임을 표시한다.
 *
 * 자기만의 토큰을 쓰는 API 가 있다. 그런 요청에 로그인 토큰을 실으면 서버가 해석하지 못해
 * 401 이 나고, 그 401 로 멀쩡한 로그인이 풀린다.
 */
export type SkipAuthConfig = { skipAuth?: boolean };

apiClient.interceptors.request.use((config) => {
  if ((config as typeof config & SkipAuthConfig).skipAuth) return config;

  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/**
 * 로그인 세션이 없어졌음을 화면에 알리는 신호.
 *
 * 콘솔은 화면을 그릴 때만 세션을 확인해서, 세션이 지워져도 다음 화면 전환까지 아무 일도
 * 일어나지 않는다. 그러면 한참 뒤 엉뚱한 버튼을 눌렀을 때 로그인 화면이 튀어나온다.
 */
export const AUTH_EXPIRED_EVENT = 'pingo:auth-expired';

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiResponse<unknown>>) => {
    const body = error.response?.data;

    /**
     * 토큰을 실어 보낸 요청이 401 로 돌아왔을 때만 세션을 버린다.
     *
     * 로그인 없이 쓰는 API 도 상황에 따라 401 을 낸다. 그때까지 세션을 지우면, 사용자
     * 화면에서 벌어진 일로 상담자가 로그아웃되는 일이 생긴다.
     */
    const skipAuth = (error.config as (typeof error.config & SkipAuthConfig) | undefined)?.skipAuth;
    if (!skipAuth && error.response?.status === 401 && error.config?.headers?.Authorization) {
      clearAuthSession();
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    }
    return Promise.reject(
      new ApiError(body?.message ?? '서버 요청에 실패했습니다.', {
        code: body?.code ?? undefined,
        status: error.response?.status,
      }),
    );
  },
);

/**
 * 항목 3 — 내부 어드민성 API 응답(상담 목록 등).
 *
 * 200~300ms면 이상적, 500ms~1s는 참을 만하고, 1s를 넘기면 로딩 표시 없이는 답답하다
 * (NN/g 기준). 세 구간을 그대로 로그 등급으로 옮긴다 — 1s를 넘긴 요청이 있다면 그 화면에
 * 로딩 스피너가 있는지부터 확인해야 한다.
 */
const API_IDEAL_MS = 300;
const API_TOLERABLE_MS = 1000;

// 배포 환경 사용자에게는 콘솔 로그를 보여주지 않는다. 개발 빌드에서만 요청 시간을 잰다.
if (import.meta.env.DEV) {
  apiClient.interceptors.request.use((config) => {
    (config as typeof config & { _t0?: number })._t0 = performance.now();
    return config;
  });
  apiClient.interceptors.response.use((response) => {
    const t0 = (response.config as typeof response.config & { _t0?: number })._t0;
    if (t0) {
      const ms = performance.now() - t0;
      const label = `[api] ${response.config.method?.toUpperCase()} ${response.config.url} ${Math.round(ms)}ms`;
      if (ms > API_TOLERABLE_MS) console.warn(`${label} (1s 초과 · 로딩 표시 필요)`);
      else if (ms > API_IDEAL_MS) console.info(`${label} (참을 만함 · 이상적 구간은 ${API_IDEAL_MS}ms)`);
      else console.debug(label);
    }
    return response;
  });
}

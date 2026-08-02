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

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiResponse<unknown>>) => {
    const body = error.response?.data;
    if (error.response?.status === 401) clearAuthSession();
    return Promise.reject(
      new ApiError(body?.message ?? '서버 요청에 실패했습니다.', {
        code: body?.code ?? undefined,
        status: error.response?.status,
      }),
    );
  },
);

import axios from 'axios';
import { env } from '@/shared/config';

export const apiClient = axios.create({
  baseURL: env.VITE_API_BASE_URL,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => Promise.reject(error),
);

// TODO: Add an auth interceptor after the token storage and refresh contract is agreed.

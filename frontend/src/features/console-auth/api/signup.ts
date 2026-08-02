import { apiClient, ENDPOINTS, unwrap } from '@/shared/api';

export interface SignupRequest {
  loginId: string;
  password: string;
  name: string;
  stationId: number;
}

export interface SignupResponse {
  accountId: number;
  loginId: string;
  name: string;
  stationId: number;
}

export function signup(request: SignupRequest) {
  return unwrap<SignupResponse>(apiClient.post(ENDPOINTS.auth.signup, request));
}

export function checkLoginId(loginId: string) {
  return unwrap<boolean>(
    apiClient.get(ENDPOINTS.auth.checkLoginId, {
      params: { loginId },
    }),
  );
}

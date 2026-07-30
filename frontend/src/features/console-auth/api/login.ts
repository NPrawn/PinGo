import { apiClient, ENDPOINTS, unwrap } from '@/shared/api';

export interface LoginRequest {
  loginId: string;
  password: string;
}

export type AccountType = 'COUNSELOR' | 'ADMIN';

export type CounselorStatus = 'AVAILABLE' | 'BUSY' | 'OFFLINE';

export interface LoginResponse {
  accessToken: string;
  accountType: AccountType;
  accountId: number;
  name: string;
  stationId: number | null;
  status: CounselorStatus | null;
}

export async function login(request: LoginRequest): Promise<LoginResponse> {
  return unwrap<LoginResponse>(apiClient.post(ENDPOINTS.auth.login, request));
}

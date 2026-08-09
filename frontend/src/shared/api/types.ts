// 모든 JSON REST API가 공유하는 공통 응답 envelope.
// 백엔드는 null 필드를 생략하므로 code/message/data는 응답에 없을 수 있다.
export interface ApiResponse<T> {
  success: boolean;
  code?: string | null;
  message?: string | null;
  data?: T | null;
}

export class ApiError extends Error {
  readonly code?: string;
  readonly status?: number;

  constructor(message: string, options: { code?: string; status?: number } = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = options.code;
    this.status = options.status;
  }
}

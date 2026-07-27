// 모든 API가 공유하는 공통 응답 envelope. (API 명세서 2.2)
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string | null;
  // 실패 응답에만 존재한다.
  errorCode?: string;
}

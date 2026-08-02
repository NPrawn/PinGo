import type { AxiosResponse } from 'axios';
import { ApiError, type ApiResponse } from './types';

export async function unwrap<T>(request: Promise<AxiosResponse<ApiResponse<T>>>): Promise<T> {
  const { data: body } = await request;

  if (!body.success || body.data == null) {
    throw new ApiError(body.message ?? '요청을 처리하지 못했습니다.', {
      code: body.code ?? undefined,
    });
  }

  return body.data;
}

export async function unwrapVoid(
  request: Promise<AxiosResponse<ApiResponse<unknown>>>,
): Promise<void> {
  const { data: body } = await request;

  if (!body.success) {
    throw new ApiError(body.message ?? '요청을 처리하지 못했습니다.', {
      code: body.code ?? undefined,
    });
  }
}

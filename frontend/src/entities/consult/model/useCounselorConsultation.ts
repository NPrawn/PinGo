import { useQuery } from '@tanstack/react-query';
import {
  getCounselorConsultationPage,
  queryKeys,
  type CounselorConsultationListParams,
} from '@/shared/api';
/**
 * 담당 역의 상담 목록을 상태·페이지 조건별 공유 캐시로 조회한다.
 *
 * 조건이 키에 들어가므로 요청 목록과 상담 이력, 각 페이지의 응답이 서로를 덮지 않는다.
 * 폴링은 이 훅을 마운트한 화면이 있을 때만 동작한다.
 */
export function useCounselorConsultations(params: CounselorConsultationListParams) {
  return useQuery({
    queryKey: queryKeys.counselorConsultations(params),
    queryFn: () => getCounselorConsultationPage(params),
    staleTime: 3_000,
    refetchInterval: 5_000,
  });
}

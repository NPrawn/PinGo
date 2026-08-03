import { useQuery } from '@tanstack/react-query';
import { getCounselorConsultations, queryKeys, type CounselorConsultation } from '@/shared/api';
/**
 * 담당 역의 전체 상담 목록(대기~종료 전 상태)을 공유 캐시로 조회한다.
 *
 * RequestsPage와 HistoryPage가 같은 원본 데이터를 서로 다른 캐시 키로 각자 불러오던 것을
 * 하나로 합쳤다. select로 화면별 파생 데이터만 다르게 뽑아 쓰므로, 두 화면을 오가도
 * 네트워크 요청은 한 번만 나간다. 폴링은 이 훅을 마운트한 화면이 하나라도 있을 때만
 * 동작한다(React Query가 옵저버 없는 쿼리의 refetchInterval을 자동으로 멈춘다).
 */
export function useCounselorConsultations<T = CounselorConsultation[]>(
  select?: (data: CounselorConsultation[]) => T,
) {
  return useQuery({
    queryKey: queryKeys.counselorConsultations(),
    queryFn: () => getCounselorConsultations(),
    staleTime: 3_000,
    refetchInterval: 5_000,
    select,
  });
}

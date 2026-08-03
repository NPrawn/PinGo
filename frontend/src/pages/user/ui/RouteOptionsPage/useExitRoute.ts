import { useQuery } from '@tanstack/react-query';
// 경로 조회는 `entities/route`를 쓴다. `shared/api`의 생성 타입과 달리 응답 필드가 모두 있다.
import { getIndoorRouteOptions, type RouteOption, type RouteOrigin } from '@/entities/route';
import { ApiError, findNearestExit, getFacility } from '@/shared/api';
import { useApiLanguage } from '@/shared/i18n';
import type { RouteType } from '@/shared/types';

/** 조건에 맞는 출구가 없을 때 서버가 주는 코드. 통신 실패가 아니라 정상 결과다. */
const NO_EXIT_CODE = 'EXIT_LOCATION_NOT_FOUND';

/** 경로 유형 하나가 안내할 출구와 그 출구까지의 경로. */
export interface ExitRoute {
  /** 도착 출구의 경로 노드. 안내를 시작할 때 이 값을 스토어에 남긴다. */
  targetNodeId: number;
  /** 화면에 쓰는 출구 이름. `7번 출입구`처럼 다듬은 값이다. */
  exitLabel: string;
  /** 서버가 계산한 이 유형의 경로. 도달할 수 없으면 `available`이 false다. */
  option: RouteOption | null;
}

interface UseExitRouteParams {
  stationId: number | null;
  /** 위치 인식이 확정한 출발 노드. */
  startNodeId: number | null;
  destinationLatitude: number | null;
  destinationLongitude: number | null;
  /**
   * 사용자의 실제 좌표. 서버가 진입 노드를 다시 고르는 데 쓴다. (`routeOriginOf`)
   *
   * **안내 화면의 경로 생성과 같은 값을 보내야 한다.** 한쪽만 보내면 진입 노드가 달라져,
   * 이 화면의 카드에 적힌 거리와 실제 안내되는 경로의 길이가 어긋난다.
   *
   * 없어도 조회는 된다 — 선택 필드이므로 `ready` 조건에 넣지 않는다.
   */
  origin?: RouteOrigin | null;
}

/**
 * 출구 번호를 화면 문구로 바꾼다.
 *
 * `exitNumber`는 `7`처럼 번호만 오거나 `GFC몰`처럼 이름이 올 수 있다.
 */
function formatExitLabel(exitNumber: string | undefined, fallbackName: string | undefined): string {
  const trimmed = exitNumber?.trim();
  if (!trimmed) return fallbackName?.trim() || '출입구';
  return /^\d+$/.test(trimmed) ? `${trimmed}번 출입구` : trimmed;
}

/**
 * 경로 유형 하나가 안내할 출구와 경로를 함께 구한다.
 *
 * **유형마다 도착 출구가 다르다.** 최단 경로는 목적지에서 가장 가까운 출구로 나가고,
 * 엘리베이터 우선 경로는 계단 없이 닿는 출구 중 가장 가까운 곳으로 나간다. 그래서 유형별로
 * 따로 조회한다 — 경로 옵션 API 는 도착 노드를 하나만 받으므로 한 번의 호출로는 둘을 함께
 * 얻을 수 없다.
 *
 * 필터 없이 가장 가까운 출구 하나만 써서 두 유형을 모두 조회하면, 그 출구가 계단으로만 닿는
 * 곳일 때 엘리베이터 경로가 늘 `NO_ACCESSIBLE_ROUTE` 로 나온다. 실제로는 계단 없이 나갈 수
 * 있는 다른 출구가 있는데도 없다고 안내하게 된다.
 *
 * 세 호출을 하나의 쿼리로 묶는 이유는 중간 결과(출구 id·노드 id)가 화면에 필요 없고, 셋이
 * 모두 성공해야 카드 한 장이 완성되기 때문이다. 부분 성공 상태를 화면이 따로 다룰 것이 없다.
 */
export function useExitRoute(routeType: RouteType, params: UseExitRouteParams) {
  const { stationId, startNodeId, destinationLatitude, destinationLongitude, origin } = params;
  const accessibleOnly = routeType === 'elevator_only';
  /** 카드에 적히는 이용 불가 사유 문구를 서버가 이 언어로 쓴다. (`useApiLanguage`) */
  const language = useApiLanguage();
  const ready =
    stationId != null &&
    startNodeId != null &&
    destinationLatitude != null &&
    destinationLongitude != null;

  return useQuery({
    queryKey: [
      'exit-route',
      routeType,
      stationId,
      startNodeId,
      destinationLatitude,
      destinationLongitude,
      /* 좌표도 결과를 바꾼다 — 서버가 그 값으로 진입 노드를 다시 골라 총 거리가 달라진다.
         키에 없으면 재인식으로 좌표만 바뀐 경우 옛 거리가 카드에 남는다. */
      origin?.currentMapX ?? null,
      origin?.currentMapY ?? null,
      /* 언어도 응답을 바꾼다 — 서버가 이용 불가 사유 문구를 이 언어로 쓴다. 키에 없으면
         언어를 바꿨는데 카드에 이전 언어 문구가 그대로 남는다. */
      language,
    ],
    queryFn: async (): Promise<ExitRoute | null> => {
      /**
       * 조건에 맞는 출구가 없는 것은 실패가 아니다.
       *
       * 엘리베이터로 나갈 수 있는 출구가 없는 역에서 서버는 `EXIT_LOCATION_NOT_FOUND` 로
       * 답한다. 그것을 오류로 두면 화면이 "불러오지 못했다"고 말하는데, 실제로는 답을 받았고
       * 그 답이 "없다"이다. 사용자가 다시 시도해도 달라질 것이 없다.
       */
      const exit = await findNearestExit({
        stationId: stationId!,
        destinationLatitude: destinationLatitude!,
        destinationLongitude: destinationLongitude!,
        accessibleOnly,
      }).catch((error: unknown) => {
        if (error instanceof ApiError && error.code === NO_EXIT_CODE) return null;
        throw error;
      });
      if (exit?.exitFacilityId == null) return null;

      const facility = await getFacility(exit.exitFacilityId);
      if (facility.linkedNodeId == null) return null;

      const options = await getIndoorRouteOptions({
        stationId: stationId!,
        startNodeId: startNodeId!,
        targetNodeId: facility.linkedNodeId,
        language,
        ...(origin ?? {}),
      });

      return {
        targetNodeId: facility.linkedNodeId,
        exitLabel: formatExitLabel(exit.exitNumber, facility.nameKo),
        option: options.find((item) => item.routeType === routeType) ?? null,
      };
    },
    enabled: ready,
    /**
     * 되풀이하지 않는다.
     *
     * 계단 없이 나갈 수 있는 출구가 없는 역에서는 서버가 `EXIT_LOCATION_NOT_FOUND` 로 답한다.
     * 다시 물어도 같은 답이고, 그 사이 엘리베이터 카드가 로딩으로 남아 있게 된다.
     */
    retry: false,
  });
}

import { useNavigationStore } from '@/entities/navigation';
import { usePermissionStore } from '@/entities/permission';
import { useStationStore } from '@/entities/station';

/**
 * 개발 빌드에서만 콘솔에 스토어를 꺼내 둔다. (`window.pingo`)
 *
 * 안내 화면은 걸어야 확인되는 것이 많다 — 진행도, 현재 구간, 층 전환. 그런데 위치는 XR이 정하고
 * 스토어는 모듈 안에 있어, 콘솔에서 손댈 방법이 `sessionStorage`를 직접 고쳐 쓰고 새로고침하는
 * 것뿐이었다. 새로고침하면 진행도가 다시 계산되므로 "걸어가는 중"을 이어서 볼 수도 없다.
 *
 * `import.meta.env.DEV` 안에만 둔다. 배포 번들에는 이 파일의 내용이 들어가지 않는다.
 */
export function exposeDevtools() {
  if (!import.meta.env.DEV) return;

  Object.assign(window, {
    pingo: {
      navigation: useNavigationStore,
      station: useStationStore,
      permission: usePermissionStore,

      /** 내 위치를 옮긴다. 층을 생략하면 그대로 둔다. */
      moveTo(mapX: number, mapY: number, floorId?: number) {
        useNavigationStore.setState({
          currentMapX: mapX,
          currentMapY: mapY,
          ...(floorId === undefined ? {} : { currentFloorId: floorId }),
        });
      },

      /** 진행도를 0으로 되돌린다. 진행도는 뒤로 가지 않으므로 되감으려면 이걸 부른다. */
      rewind() {
        useNavigationStore.setState({ progressKey: null, travelledM: 0 });
      },

      /** 지금 경로가 지나는 노드와 구간을 표로 찍는다. 어디로 옮길지 정하는 데 쓴다. */
      route() {
        const { routeResult, travelledM } = useNavigationStore.getState();
        if (!routeResult) return '경로가 없다. 안내 화면에서 조회가 끝날 때까지 기다린다.';

        console.table(routeResult.pathNodes ?? []);
        console.table(
          (routeResult.steps ?? []).map((step, index) => ({
            index,
            instruction: step.instruction,
            distanceM: step.distanceM,
          })),
        );

        return `진행 ${travelledM.toFixed(1)}m / 전체 ${routeResult.totalDistanceM ?? 0}m`;
      },
    },
  });
}

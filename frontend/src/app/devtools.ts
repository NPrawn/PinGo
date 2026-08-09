import { useNavigationStore } from '@/entities/navigation';
import { usePermissionStore } from '@/entities/permission';
import { useStationStore } from '@/entities/station';

/**
 * 안내 화면을 세워 두는 초기 상태. 역삼역 V8 시드값이다.
 *
 * B3 승강장 복도(노드 209)에서 2번 출구(노드 341, B1)로 간다. 층을 두 번 올라가는 경로라
 * 층 전환·진행도·상세 경로를 한 번에 볼 수 있다.
 */
const PRESET = {
  destination: '강남파이낸스센터',
  destinationId: null,
  destinationType: 'place',
  destinationLatitude: 37.5007,
  destinationLongitude: 127.0365,
  destinationAddress: null,
  currentNodeId: 209,
  currentFloorId: 2,
  currentLocationLabel: 'B3 승강장',
  currentMapX: 49.121,
  currentMapY: 24.331,
  targetNodeId: 341,
  targetExitLabel: '2번 출입구',
  route: 'fastest' as const,
  routeResult: null,
  stepsOpen: true,
  waypoints: [],
  progressKey: null,
  travelledM: 0,
  relocalizing: false,
};

/**
 * 개발 빌드에서만 콘솔에 안내 상태를 조작하는 도구를 둔다. (`window.pingo`)
 *
 * 안내 화면은 걸어야 확인되는 것이 많다 — 진행도, 현재 구간, 층 전환, 지도 명도. 그런데 위치는
 * XR이 정하고 데스크톱에는 XR이 없다.
 *
 * **새로고침이 필요하지 않다.** 스토어를 바꾸면 화면이 그 자리에서 따라온다. 처음에는 안내 화면이
 * 확정 위치를 첫 렌더 값에 얼려 둬서 새로고침해야 했고, 그러면 매번 XR 안내를 다시 지나야 해서
 * 걸어가는 흐름을 볼 수 없었다. 얼려 둘 이유가 없다는 것을 확인해 `useMemo`로 바꿨다
 * (`NavigationPage`의 `confirmedLocation`).
 *
 * **좌표를 손으로 넣지 않는다.** 시드에서 노드 좌표를 찾아 옮기는 방식은 표를 띄워 놓고 숫자를
 * 옮겨 적어야 해서, 무엇을 확인하려던 것인지 잊게 된다. `walk()`가 경로의 다음 노드로 옮긴다.
 *
 * `import.meta.env.DEV` 안에만 둔다. 배포 번들에는 이 파일의 내용이 들어가지 않는다.
 */
export function exposeDevtools() {
  if (!import.meta.env.DEV) return;

  Object.assign(window, { pingo: devtools() });
  // 콘솔은 새로고침하면 지워진다. 매번 다시 알려 주는 편이 외워 두게 하는 것보다 낫다.
  console.log(`%c${banner()}`, 'color:#d94e6a');
}

function devtools() {
  const store = useNavigationStore;

  return {
    navigation: store,
    station: useStationStore,
    permission: usePermissionStore,

    /**
     * 안내 화면을 세운다. B3 승강장 → 2번 출입구.
     *
     * 다른 화면에서 불러도 되도록 안내 화면으로 옮긴다. 이때만 화면이 새로 뜨고, 그 뒤 `walk()`는
     * 새로고침하지 않는다.
     */
    setup() {
      store.setState(PRESET);
      location.href = '/user/navigation';
    },

    /**
     * 경로의 다음 노드로 옮긴다. `walk(3)`이면 세 개 건너뛴다.
     *
     * 지금 위치에 가장 가까운 노드를 찾아 그 다음으로 간다. 층이 다른 노드는 후보에서 빼는데,
     * 역삼역 B2와 B3는 x·y가 겹쳐서 층을 보지 않으면 위층 노드에 붙는다.
     */
    walk(steps = 1) {
      const nodes = pathNodes();
      if (nodes.length === 0) return '경로가 없다. 안내 화면에서 조회가 끝날 때까지 기다린다.';

      const at = nearestIndex(nodes);
      const next = at + steps;
      if (next < 0) return '경로 시작이다.';
      if (next > nodes.length - 1) return '경로 끝이다.';

      const node = nodes[next];
      store.setState({
        currentMapX: node.mapX,
        currentMapY: node.mapY,
        currentFloorId: node.floorId,
      });

      return this.where();
    },

    /** 경로의 이전 노드로 돌아간다. 진행도는 뒤로 가지 않으니 되감으려면 `rewind()`. */
    back(steps = 1) {
      return this.walk(-steps);
    },

    /** 임의 좌표로 옮긴다. 경로에서 벗어난 상태를 만들 때 쓴다. 층을 생략하면 그대로 둔다. */
    moveTo(mapX: number, mapY: number, floorId?: number) {
      store.setState({
        currentMapX: mapX,
        currentMapY: mapY,
        ...(floorId === undefined ? {} : { currentFloorId: floorId }),
      });

      return this.where();
    },

    /** 진행도를 0으로 되돌린다. 진행도는 뒤로 가지 않으므로 되감으려면 이걸 부른다. */
    rewind() {
      store.setState({ progressKey: null, travelledM: 0 });

      return this.where();
    },

    /** 지금 어디인지, 얼마나 왔는지. */
    where() {
      const { currentMapX, currentMapY, currentFloorId, travelledM, routeResult } =
        store.getState();
      const nodes = pathNodes();
      const at = nodes.length === 0 ? -1 : nearestIndex(nodes);

      return [
        `위치 (${currentMapX ?? '?'}, ${currentMapY ?? '?'}) floorId ${currentFloorId ?? '?'}`,
        at < 0 ? '경로 없음' : `노드 ${at + 1}/${nodes.length} (nodeId ${nodes[at].nodeId})`,
        `진행 ${travelledM.toFixed(1)}m / 전체 ${routeResult?.totalDistanceM ?? 0}m`,
      ].join('  |  ');
    },

    /** 경로가 지나는 노드와 구간을 표로 찍는다. */
    route() {
      const { routeResult, travelledM } = store.getState();
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

    /** 명령 목록을 다시 찍는다. */
    help() {
      return banner();
    },
  };
}

/** 좌표가 온전한 경로 노드만. 하나라도 비면 옮길 자리로 쓸 수 없다. */
function pathNodes(): { nodeId: number; floorId: number; mapX: number; mapY: number }[] {
  const nodes = useNavigationStore.getState().routeResult?.pathNodes ?? [];

  return nodes.flatMap((node) =>
    node.nodeId != null && node.floorId != null && node.mapX != null && node.mapY != null
      ? [{ nodeId: node.nodeId, floorId: node.floorId, mapX: node.mapX, mapY: node.mapY }]
      : [],
  );
}

/**
 * 지금 위치에 가장 가까운 노드의 인덱스.
 *
 * 같은 층 노드만 후보로 둔다. 그 층에 노드가 없으면(층 전환 지점에서 시작하는 경로) 층을 무시하고
 * 다시 찾는다 — 그때도 다음으로 갈 곳은 있다.
 */
function nearestIndex(nodes: readonly { floorId: number; mapX: number; mapY: number }[]): number {
  const { currentMapX, currentMapY, currentFloorId } = useNavigationStore.getState();
  const x = currentMapX ?? 0;
  const y = currentMapY ?? 0;

  const pick = (sameFloorOnly: boolean) => {
    let index = -1;
    let best = Number.POSITIVE_INFINITY;

    nodes.forEach((node, at) => {
      if (sameFloorOnly && node.floorId !== currentFloorId) return;
      const distance = Math.hypot(node.mapX - x, node.mapY - y);
      if (distance < best) {
        best = distance;
        index = at;
      }
    });

    return index;
  };

  const onFloor = pick(true);
  return onFloor >= 0 ? onFloor : Math.max(0, pick(false));
}

function banner(): string {
  return [
    'PinGo 개발 도구 — 안내 화면 테스트',
    '',
    '  1. pingo.setup()      안내 화면을 세운다 (B3 승강장 → 2번 출입구)',
    '  2. 화면의 "지도만 보고 이동하기"를 한 번 누른다',
    '  3. pingo.walk()       경로의 다음 노드로 걸어간다. 눌러 둔 채 반복하면 된다',
    '',
    '  pingo.back()       이전 노드로 (walk(3)·back(3)처럼 칸 수를 줄 수 있다)',
    '  pingo.moveTo(x,y)  임의 좌표로. 경로 이탈을 만들 때 쓴다 (세 번째 인자가 floorId)',
    '  pingo.rewind()     진행도 0으로. 진행도는 뒤로 가지 않으므로 되감으려면 이걸 부른다',
    '  pingo.where()      지금 어디인지 한 줄',
    '  pingo.route()      경로 노드·구간 표',
    '  pingo.help()       이 목록',
    '',
    '  walk() 뒤에 새로고침은 필요 없다. 화면이 바로 따라온다.',
  ].join('\n');
}

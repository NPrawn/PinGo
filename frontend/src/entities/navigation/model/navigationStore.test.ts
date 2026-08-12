import { useNavigationStore } from './navigationStore';

/**
 * 위치 인식이 준 방향(`forwardMap`)은 앵커의 기준이다. 방향이 없으면 앵커를 만들지 않으므로
 * (`343` — 임의 방향을 쓰면 지도 경로를 가로지르는 오차가 생긴다) 이 값이 사라지면 위치와
 * 방향 추적이 통째로 죽는다.
 */
describe('useNavigationStore.setCurrentLocation', () => {
  beforeEach(() => {
    useNavigationStore.setState({ currentForwardMap: { x: 0.6, y: 0.8 } });
  });

  /**
   * **위치를 옮기는 것은 방향을 지우는 일이 아니다.**
   *
   * 상담자가 사용자의 자리를 바로잡을 때(`CURRENT_LOCATION_CORRECTED`) 넘어오는 것은 좌표뿐이다.
   * 예전에는 그때 방향이 함께 null 이 되어, 위치를 고쳐 준 것이 추적을 끄는 결과가 됐다.
   * 사용자가 서 있는 자리가 달라졌다고 몸을 돌린 것은 아니므로 그 방향은 그대로 유효하다.
   */
  it('방향을 넘기지 않으면 이미 알고 있는 방향을 지우지 않는다', () => {
    useNavigationStore.getState().setCurrentLocation({
      nodeId: 12,
      floorId: 3,
      label: '3번 개찰구',
      labelEn: 'Fare Gate 3',
      mapX: 10,
      mapY: 20,
    });

    expect(useNavigationStore.getState().currentForwardMap).toEqual({ x: 0.6, y: 0.8 });
    expect(useNavigationStore.getState().currentNodeId).toBe(12);
    expect(useNavigationStore.getState().currentLocationLabel).toBe('3번 개찰구');
    expect(useNavigationStore.getState().currentLocationLabelEn).toBe('Fare Gate 3');
  });

  /** 다시 인식해 방향이 실제로 달라졌으면 그 값으로 바꾼다. */
  it('새 방향을 넘기면 그 값으로 바꾼다', () => {
    useNavigationStore
      .getState()
      .setCurrentLocation({ nodeId: 12, floorId: 3, forwardMap: { x: 1, y: 0 } });

    expect(useNavigationStore.getState().currentForwardMap).toEqual({ x: 1, y: 0 });
  });

  /** 방향을 잃었다는 것을 알릴 길도 남긴다. `null` 을 명시하면 지운다. */
  it('null 을 명시하면 방향을 지운다', () => {
    useNavigationStore.getState().setCurrentLocation({ nodeId: 12, floorId: 3, forwardMap: null });

    expect(useNavigationStore.getState().currentForwardMap).toBeNull();
  });
});

/**
 * 걸어온 자리는 확정 위치와 따로 산다. (S15P11A206-382)
 *
 * 확정 좌표(`currentMapX/Y`)는 안내 화면 경로 조회의 쿼리 키라서 걸음마다 갱신할 수 없다.
 * 그래서 별도 칸을 두는데, 두 값의 선후 관계가 뒤집히면 옛 자리가 살아난다.
 */
describe('useNavigationStore.setTrackedPosition', () => {
  beforeEach(() => {
    useNavigationStore.setState({
      currentNodeId: 353,
      currentFloorId: 1,
      currentMapX: -4.986,
      currentMapY: 27.654,
      routeResult: { pathNodes: [] } as unknown as never,
      trackedFloorId: null,
      trackedMapX: null,
      trackedMapY: null,
      trackedForwardMap: null,
    });
  });

  /** 확정이 아니므로 노드와 경로를 건드리면 안 된다. 건드리면 걸음마다 경로를 다시 받는다. */
  it('노드와 이미 받아 둔 경로를 건드리지 않는다', () => {
    useNavigationStore.getState().setTrackedPosition({ floorId: 1, mapX: 3, mapY: -4 });

    expect(useNavigationStore.getState().trackedMapX).toBe(3);
    expect(useNavigationStore.getState().trackedMapY).toBe(-4);
    expect(useNavigationStore.getState().currentNodeId).toBe(353);
    expect(useNavigationStore.getState().currentMapX).toBe(-4.986);
    expect(useNavigationStore.getState().routeResult).not.toBeNull();
  });

  /** 방향 규칙은 `setCurrentLocation` 과 같다. 넘기지 않으면 그대로 둔다. */
  it('방향을 넘기지 않으면 이미 알고 있는 방향을 지우지 않는다', () => {
    useNavigationStore.setState({ trackedForwardMap: { x: 1, y: 0 } });
    useNavigationStore.getState().setTrackedPosition({ floorId: 1, mapX: 3, mapY: -4 });

    expect(useNavigationStore.getState().trackedForwardMap).toEqual({ x: 1, y: 0 });
  });

  /**
   * **새 확정이 옛 추적보다 나중이다.**
   *
   * 층 이동 모달과 재인식이 자리를 옮기는데, 그 전에 걸어온 좌표가 남아 있으면 읽는 쪽이 옛
   * 자리를 그대로 쓴다. 비워야 확정 좌표로 떨어진다.
   */
  it('위치를 확정하면 걸어온 기록을 비운다', () => {
    useNavigationStore.getState().setTrackedPosition({ floorId: 1, mapX: 3, mapY: -4 });
    useNavigationStore
      .getState()
      .setCurrentLocation({ nodeId: 353, floorId: 1, mapX: -4.986, mapY: 27.654 });

    expect(useNavigationStore.getState().trackedFloorId).toBeNull();
    expect(useNavigationStore.getState().trackedMapX).toBeNull();
    expect(useNavigationStore.getState().trackedMapY).toBeNull();
    expect(useNavigationStore.getState().trackedForwardMap).toBeNull();
  });
});

describe('useNavigationStore.setDestination', () => {
  it('keeps bilingual facility data for refresh restoration', () => {
    useNavigationStore.getState().setDestination('교통카드 충전기 A', {
      destinationId: 50,
      destinationType: 'facility',
      targetNodeId: 121,
      destinationNameKo: '교통카드 충전기 A',
      destinationNameEn: 'Transit Card Reload Machine A',
    });

    expect(useNavigationStore.getState()).toMatchObject({
      destination: '교통카드 충전기 A',
      destinationId: 50,
      destinationType: 'facility',
      targetNodeId: 121,
      destinationNameKo: '교통카드 충전기 A',
      destinationNameEn: 'Transit Card Reload Machine A',
    });
    const persisted = JSON.parse(sessionStorage.getItem('pingo.navigation') ?? '{}') as {
      state?: Record<string, unknown>;
    };
    expect(persisted.state).toMatchObject({
      destinationId: 50,
      destinationType: 'facility',
      targetNodeId: 121,
      destinationNameKo: '교통카드 충전기 A',
      destinationNameEn: 'Transit Card Reload Machine A',
    });
  });
});

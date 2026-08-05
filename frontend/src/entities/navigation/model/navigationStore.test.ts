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
      mapX: 10,
      mapY: 20,
    });

    expect(useNavigationStore.getState().currentForwardMap).toEqual({ x: 0.6, y: 0.8 });
    expect(useNavigationStore.getState().currentNodeId).toBe(12);
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

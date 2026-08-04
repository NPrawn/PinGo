import type { ConsultDataEvent, ConsultEventBody } from '@/shared/types';
import { applyMapStrokeEvent, type MapStroke } from './mapStroke';

/**
 * 지도 위에 그린 선을 쌓는 규칙. (S15P11A206-89)
 *
 * 조각으로 나뉘어 오는 것을 하나의 선으로 되붙이는 일이라, 조각이 빠지거나 순서가 어긋나는
 * 경우까지 여기서 정해 둔다. 잘못 붙어도 오류가 나지 않고 엉뚱한 선만 남으므로 눈으로는
 * 알아채기 어렵다.
 */

function event(body: ConsultEventBody): ConsultDataEvent {
  return {
    ...body,
    sessionId: 'room_1',
    eventId: 'evt_1',
    senderType: 'COUNSELOR',
    timestamp: '2026-08-04T00:00:00.000Z',
    version: 1,
  };
}

const start = (strokeId: string, floorId: number, mapX: number, mapY: number) =>
  event({
    eventType: 'DRAW_STROKE_START',
    payload: { strokeId, floorId, color: '#ffd23f', width: 3.5, map: { mapX, mapY } },
  });

const move = (strokeId: string, points: [number, number][]) =>
  event({
    eventType: 'DRAW_STROKE_MOVE',
    payload: { strokeId, mapPoints: points.map(([mapX, mapY]) => ({ mapX, mapY })) },
  });

describe('applyMapStrokeEvent', () => {
  it('시작 이벤트가 첫 점을 가진 선을 만든다', () => {
    const strokes = applyMapStrokeEvent([], start('s1', 2, 1, -2));

    expect(strokes).toEqual([
      { strokeId: 's1', floorId: 2, color: '#ffd23f', points: [{ x: 1, y: -2 }] },
    ]);
  });

  it('이동 이벤트가 같은 선에 점을 이어 붙인다', () => {
    let strokes = applyMapStrokeEvent([], start('s1', 2, 0, 0));
    strokes = applyMapStrokeEvent(strokes, move('s1', [[1, 1]]));
    strokes = applyMapStrokeEvent(strokes, move('s1', [[2, 2]]));

    expect(strokes[0].points).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
    ]);
  });

  /**
   * 층과 색은 시작 이벤트에만 있다. 그것을 놓친 선은 어느 층에 무슨 색으로 그릴지 알 수 없다.
   * 짐작해서 그리면 엉뚱한 층에 남고, 그 선만 골라 지울 방법이 없다.
   */
  it('시작을 놓친 선의 이동은 버린다', () => {
    const strokes = applyMapStrokeEvent([], move('s1', [[1, 1]]));

    expect(strokes).toEqual([]);
  });

  it('지우기는 모든 선을 없앤다', () => {
    const strokes = applyMapStrokeEvent(
      [{ strokeId: 's1', floorId: 2, color: '#fff', points: [{ x: 0, y: 0 }] }],
      event({ eventType: 'DRAW_CLEAR', payload: {} }),
    );

    expect(strokes).toEqual([]);
  });

  /**
   * 카메라 영상 위에 그린 선은 좌표계가 다르다(0~1 정규화). 이 목록에 섞으면 미터로 읽혀
   * 도면 원점 근처에 뭉친다.
   */
  it('카메라 영상 위에 그린 선은 지도 선으로 받지 않는다', () => {
    const screenStart = event({
      eventType: 'DRAW_STROKE_START',
      payload: { strokeId: 's1', x: 0.5, y: 0.5, color: '#ffd23f', width: 3.5 },
    });

    expect(applyMapStrokeEvent([], screenStart)).toEqual([]);
    expect(
      applyMapStrokeEvent(
        [],
        event({
          eventType: 'DRAW_STROKE_MOVE',
          payload: { strokeId: 's1', points: [{ x: 0.6, y: 0.6 }] },
        }),
      ),
    ).toEqual([]);
  });

  /**
   * 반영할 것이 없으면 같은 배열을 돌려준다. 새 배열을 만들면 그리기와 무관한 이벤트마다
   * 화면이 다시 그려진다 — 지도 동기화는 초당 여러 번 온다.
   */
  it('반영할 것이 없으면 같은 배열을 그대로 돌려준다', () => {
    const strokes: readonly MapStroke[] = [
      { strokeId: 's1', floorId: 2, color: '#fff', points: [{ x: 0, y: 0 }] },
    ];
    const mapSync = event({
      eventType: 'MAP_SYNC',
      payload: {
        stationId: 1,
        floorId: 2,
        current: null,
        headingDeg: null,
        destination: null,
        destinationLabel: null,
        pathNodes: [],
      },
    });

    expect(applyMapStrokeEvent(strokes, mapSync)).toBe(strokes);
    expect(applyMapStrokeEvent([], event({ eventType: 'DRAW_CLEAR', payload: {} }))).toEqual([]);
  });

  /** 같은 선 id 로 다시 시작하면 앞의 것을 잇지 않고 새로 시작한다. */
  it('같은 id 로 다시 시작하면 앞의 선을 대체한다', () => {
    let strokes = applyMapStrokeEvent([], start('s1', 2, 0, 0));
    strokes = applyMapStrokeEvent(strokes, move('s1', [[9, 9]]));
    strokes = applyMapStrokeEvent(strokes, start('s1', 2, 5, 5));

    expect(strokes).toHaveLength(1);
    expect(strokes[0].points).toEqual([{ x: 5, y: 5 }]);
  });
});

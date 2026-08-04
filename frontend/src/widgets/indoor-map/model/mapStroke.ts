import type { MeterPoint } from '@/entities/floor-map';
import type { ConsultDataEvent } from '@/shared/types';

/**
 * 지도 위에 그린 선 하나. (S15P11A206-89)
 *
 * 좌표는 **캐노니컬 미터**다. 두 화면의 확대·이동·회전·표시 층이 달라도 같은 자리에 그려야
 * 하므로, 화면 기준 값으로 들고 있을 수 없다. 근거는 `MapDrawPoint` 에 적어 두었다.
 *
 * `floorId` 를 선마다 들고 있는다. 상담자는 사용자와 다른 층을 볼 수 있고(자유 탐색), 그때 그린
 * 선은 그 층의 것이다. 사용자가 그 층을 볼 때만 보인다.
 */
export interface MapStroke {
  strokeId: string;
  floorId: number;
  color: string;
  points: readonly MeterPoint[];
}

/**
 * 받은 그리기 이벤트를 선 목록에 반영한다. 지도 선이 아닌 이벤트는 목록을 그대로 돌려준다.
 *
 * **순수 함수로 둔다.** 두 화면이 같은 규칙으로 쌓아야 하고(상담자는 자기 선을, 사용자는 받은
 * 선을 같은 모양으로 들고 있다), 조각이 순서대로 오지 않는 경우까지 여기서 한 번에 다룬다.
 *
 * 반영할 것이 없으면 **같은 배열을 그대로 돌려준다.** 새 배열을 만들면 React 가 매 이벤트마다
 * 다시 그린다 — 그리기와 무관한 이벤트(지도 동기화는 초당 여러 번 온다)까지 리렌더를 부른다.
 */
export function applyMapStrokeEvent(
  strokes: readonly MapStroke[],
  event: ConsultDataEvent,
): readonly MapStroke[] {
  if (event.eventType === 'DRAW_CLEAR') {
    return strokes.length === 0 ? strokes : [];
  }

  if (event.eventType === 'DRAW_STROKE_START') {
    // 카메라 영상 위에 그린 선은 이 목록의 것이 아니다. 좌표계가 다르다.
    if (!('map' in event.payload)) return strokes;

    const { strokeId, floorId, color, map } = event.payload;

    return [
      ...strokes.filter((stroke) => stroke.strokeId !== strokeId),
      { strokeId, floorId, color, points: [{ x: map.mapX, y: map.mapY }] },
    ];
  }

  if (event.eventType === 'DRAW_STROKE_MOVE') {
    if (!('mapPoints' in event.payload)) return strokes;

    const { strokeId, mapPoints } = event.payload;
    const next = mapPoints.map((point) => ({ x: point.mapX, y: point.mapY }));

    /**
     * 시작을 놓친 선은 버린다.
     *
     * 층과 색이 시작 이벤트에만 있어서 그것 없이는 어느 층에 무슨 색으로 그릴지 알 수 없다.
     * 짐작해서 그리면 엉뚱한 층에 남는데, 그 선은 지울 방법도 없다(`DRAW_CLEAR` 는 전체를
     * 지우므로 상담자가 의도하지 않은 것까지 사라진다).
     */
    if (!strokes.some((stroke) => stroke.strokeId === strokeId)) return strokes;

    return strokes.map((stroke) =>
      stroke.strokeId === strokeId ? { ...stroke, points: [...stroke.points, ...next] } : stroke,
    );
  }

  // 선을 끝내는 것은 목록에 남길 일이 없다. 이어 그릴 점이 더 오지 않는다는 뜻일 뿐이다.
  return strokes;
}

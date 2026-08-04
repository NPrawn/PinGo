import { useCallback, useEffect, useRef } from 'react';
import { PLAN_REFERENCE, pixelToMeter, type MeterPoint } from '@/entities/floor-map';

/**
 * 지도 위에 그린 선을 알리는 콜백.
 *
 * 좌표는 **캐노니컬 미터**다. 받는 쪽이 자기 화면의 변환으로 투영하므로 두 사람의 확대·이동·
 * 회전·표시 층이 달라도 같은 자리에 그려진다.
 */
export interface MapDrawEmitter {
  onStrokeStart: (stroke: { strokeId: string; floorId: number; point: MeterPoint }) => void;
  onStrokeMove: (stroke: { strokeId: string; points: MeterPoint[] }) => void;
  onStrokeEnd: (stroke: { strokeId: string }) => void;
}

let strokeSequence = 0;

function nextStrokeId() {
  strokeSequence += 1;
  return `stroke_${Date.now().toString(36)}_${strokeSequence.toString(36)}`;
}

/**
 * 화면 좌표를 오버레이 SVG 의 사용자 좌표로 옮긴다.
 *
 * **`getScreenCTM()` 에 맡긴다.** 지도에는 확대·이동에 **회전**까지 걸려 있고, 그 변환은 SVG
 * 바깥의 CSS transform 이다. 직접 역산하면 회전 부호나 원점에서 어긋나기 쉬운데, 어긋나도 오류가
 * 나지 않고 선만 엉뚱한 자리에 그려진다. SVG 는 자기 조상까지의 변환 사슬을 알고 있으므로 그것을
 * 그대로 되짚는 편이 안전하다.
 *
 * 브라우저가 이 API 를 주지 않거나(테스트 환경) 행렬을 되짚을 수 없으면 null 이다.
 */
function svgPointOf(svg: SVGSVGElement, clientX: number, clientY: number) {
  const matrix = svg.getScreenCTM?.();

  if (!matrix) return null;

  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;

  try {
    return point.matrixTransform(matrix.inverse());
  } catch {
    // 특이 행렬(배율 0 등)은 되짚을 수 없다. 그 프레임만 건너뛴다.
    return null;
  }
}

/**
 * 지도 위에 손으로 선을 그린다. (S15P11A206-89)
 *
 * 캔버스를 따로 두지 않고 **오버레이 SVG 위에서 입력만 받는다.** 그린 결과는 호출부가 상태로
 * 들고 있다가 `IndoorMapView` 의 `strokes` 로 다시 넘긴다 — 그러면 상담자와 사용자가 같은 배열을
 * 같은 방식으로 그리므로 두 화면의 그림이 어긋날 여지가 없다. 캔버스에 직접 칠하면 그리는 쪽만
 * 다른 경로로 그리게 되고, 확대·회전이 걸린 지도에서는 그 둘이 곧 갈라진다.
 *
 * 그리는 동안 팬·줌은 멈춰야 한다. 이 훅은 포인터 이벤트를 잡아 두므로(`stopPropagation`) 지도
 * 제스처가 함께 반응하지 않는다 — 그리면서 지도가 밀리면 선이 손을 따라오지 못한다.
 */
export function useMapDraw({
  enabled,
  floorId,
  emitter,
}: {
  enabled: boolean;
  /** 지금 그리는 선이 놓일 층. 그리는 순간의 표시 층이다. */
  floorId: number | undefined;
  emitter?: MapDrawEmitter;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const strokeIdRef = useRef<string | null>(null);
  const emitterRef = useRef(emitter);

  // 렌더 중에 ref 를 건드리지 않는다. 매 렌더 뒤에 최신 콜백으로 갈아 끼운다.
  useEffect(() => {
    emitterRef.current = emitter;
  }, [emitter]);

  const meterOf = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null;

    const point = svgPointOf(svg, clientX, clientY);
    if (!point) return null;

    return pixelToMeter(point.x, point.y, PLAN_REFERENCE.frame);
  }, []);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (!enabled || floorId === undefined) return;

      const point = meterOf(event.clientX, event.clientY);
      if (!point) return;

      /**
       * 지도 제스처에 같은 포인터가 전달되지 않게 막는다. 그리는 동안 지도가 밀리거나 확대되면
       * 선이 손을 따라오지 못한다.
       */
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);

      strokeIdRef.current = nextStrokeId();
      emitterRef.current?.onStrokeStart({ strokeId: strokeIdRef.current, floorId, point });
    },
    [enabled, floorId, meterOf],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      const strokeId = strokeIdRef.current;
      if (!strokeId) return;

      const point = meterOf(event.clientX, event.clientY);
      if (!point) return;

      event.stopPropagation();
      emitterRef.current?.onStrokeMove({ strokeId, points: [point] });
    },
    [meterOf],
  );

  const onPointerUp = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    const strokeId = strokeIdRef.current;
    if (!strokeId) return;

    strokeIdRef.current = null;
    event.stopPropagation();
    emitterRef.current?.onStrokeEnd({ strokeId });
  }, []);

  /** 그리기를 끄는 순간 손을 떼지 않은 선이 남아 있으면 끝난 것으로 알린다. */
  useEffect(() => {
    if (enabled) return;

    const strokeId = strokeIdRef.current;
    if (!strokeId) return;

    strokeIdRef.current = null;
    emitterRef.current?.onStrokeEnd({ strokeId });
  }, [enabled]);

  return {
    svgRef,
    /** 오버레이 SVG 에 그대로 펼친다. 그리기가 꺼져 있으면 아무 일도 하지 않는다. */
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
  };
}

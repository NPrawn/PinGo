import { useCallback, useEffect, useRef } from 'react';
import type { ConsultDataEvent } from '@/shared/types';

/**
 * 상담자가 공유 화면 위에 그린 선을 사용자 화면에 그대로 옮긴다.
 *
 * 좌표는 0~1 정규화 값으로 온다(명세 6장). 사용자 화면 전체가 공유 대상이므로 이 캔버스도
 * 화면을 덮는 크기여야 같은 자리에 찍힌다.
 */
export function useRemoteScreenDraw() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  /** 선마다 마지막 점을 들고 있어야 다음 점과 이어 그릴 수 있다. */
  const lastPoints = useRef(new Map<string, { x: number; y: number }>());

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const width = Math.round(rect.width);
    const height = Math.round(rect.height);
    if (canvas.width === width && canvas.height === height) return;
    canvas.width = width;
    canvas.height = height;
  }, []);

  useEffect(() => {
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [resize]);

  const apply = useCallback(
    (event: ConsultDataEvent) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;
      resize();

      if (event.eventType === 'DRAW_CLEAR') {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        lastPoints.current.clear();
        return;
      }

      if (event.eventType === 'DRAW_STROKE_START') {
        const { strokeId, x, y, color, width } = event.payload;
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        lastPoints.current.set(strokeId, { x: x * canvas.width, y: y * canvas.height });
        return;
      }

      if (event.eventType === 'DRAW_STROKE_END') {
        lastPoints.current.delete(event.payload.strokeId);
        return;
      }

      // 그리기 외의 상담 이벤트(지도 동기화 등)는 이 캔버스가 다룰 것이 아니다.
      if (event.eventType !== 'DRAW_STROKE_MOVE') return;

      const { strokeId, points } = event.payload;
      // 시작 이벤트를 놓쳤다면 이을 곳이 없다. 첫 점을 시작점으로 삼는다.
      let previous = lastPoints.current.get(strokeId);
      for (const point of points ?? []) {
        const next = { x: point.x * canvas.width, y: point.y * canvas.height };
        if (previous) {
          ctx.beginPath();
          ctx.moveTo(previous.x, previous.y);
          ctx.lineTo(next.x, next.y);
          ctx.stroke();
        }
        previous = next;
      }
      if (previous) lastPoints.current.set(strokeId, previous);
    },
    [resize],
  );

  return { canvasRef, apply };
}

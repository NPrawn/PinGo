import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { DrawPoint } from '@/shared/types';

const STROKE = '#ffd23f';
const LINE_WIDTH = 3.5;

export interface ScreenDrawEmitter {
  onStrokeStart: (stroke: {
    strokeId: string;
    x: number;
    y: number;
    color: string;
    width: number;
  }) => void;
  onStrokeMove: (stroke: { strokeId: string; points: DrawPoint[] }) => void;
  onStrokeEnd: (stroke: { strokeId: string }) => void;
  onClear: () => void;
}

let strokeSequence = 0;

/**
 * 그린 좌표를 공유 화면 기준 0~1 값으로 바꾼다.
 *
 * 영상은 `object-fit: contain` 이라 요소 안에서 위아래(또는 좌우)에 여백이 생긴다.
 * 요소 크기로 나누면 그 여백만큼 어긋나므로, 실제로 그림이 그려진 영역을 기준으로 삼는다.
 */
function normalize(
  canvas: HTMLCanvasElement,
  media: HTMLVideoElement | null,
  x: number,
  y: number,
): DrawPoint {
  const rect = canvas.getBoundingClientRect();
  let left = 0;
  let top = 0;
  let width = rect.width;
  let height = rect.height;

  if (media?.videoWidth && media.videoHeight) {
    const scale = Math.min(rect.width / media.videoWidth, rect.height / media.videoHeight);
    width = media.videoWidth * scale;
    height = media.videoHeight * scale;
    left = (rect.width - width) / 2;
    top = (rect.height - height) / 2;
  }

  if (!width || !height) return { x: 0, y: 0 };
  return { x: (x - left) / width, y: (y - top) / height };
}

/**
 * Freehand annotation over the shared screen.
 *
 * The prototype attached pointer listeners to `document` and looked the canvas
 * up by id on every event. This scopes them to the canvas element and cleans up
 * on unmount.
 *
 * `emitter` 를 넘기면 그린 선을 상대 화면에도 보낸다. 넘기지 않으면 예전처럼 이 화면에만
 * 그린다.
 */
export function useScreenDraw(
  emitter?: Partial<ScreenDrawEmitter>,
  mediaRef?: RefObject<HTMLVideoElement | null>,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [enabled, setEnabled] = useState(false);
  const drawing = useRef(false);
  const strokeIdRef = useRef<string | null>(null);
  const emitterRef = useRef(emitter);

  // 렌더 중에 ref 를 건드리면 안 된다. 매 렌더 뒤에 최신 콜백으로 갈아 끼운다.
  useEffect(() => {
    emitterRef.current = emitter;
  }, [emitter]);

  /** Keeps the backing store in step with the element's rendered size. */
  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    const width = Math.round(rect.width);
    const height = Math.round(rect.height);
    if (canvas.width === width && canvas.height === height) return;

    const ctx = canvas.getContext('2d');
    const snapshot =
      canvas.width && ctx ? ctx.getImageData(0, 0, canvas.width, canvas.height) : null;
    canvas.width = width;
    canvas.height = height;
    if (snapshot && ctx) {
      try {
        ctx.putImageData(snapshot, 0, 0);
      } catch {
        // A larger snapshot cannot be restored into a smaller canvas; drop it.
      }
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !enabled) return;

    resize();

    const point = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    const onDown = (event: PointerEvent) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      resize();
      const { x, y } = point(event);
      ctx.strokeStyle = STROKE;
      ctx.lineWidth = LINE_WIDTH;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(x, y);
      drawing.current = true;
      canvas.setPointerCapture(event.pointerId);
      event.preventDefault();

      strokeSequence += 1;
      strokeIdRef.current = `stroke_${Date.now().toString(36)}_${strokeSequence.toString(36)}`;
      const normalized = normalize(canvas, mediaRef?.current ?? null, x, y);
      emitterRef.current?.onStrokeStart?.({
        strokeId: strokeIdRef.current,
        x: normalized.x,
        y: normalized.y,
        color: STROKE,
        width: LINE_WIDTH,
      });
    };

    const onMove = (event: PointerEvent) => {
      if (!drawing.current) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const { x, y } = point(event);
      ctx.lineTo(x, y);
      ctx.stroke();

      const strokeId = strokeIdRef.current;
      if (!strokeId) return;
      emitterRef.current?.onStrokeMove?.({
        strokeId,
        points: [normalize(canvas, mediaRef?.current ?? null, x, y)],
      });
    };

    const onUp = () => {
      drawing.current = false;
      const strokeId = strokeIdRef.current;
      strokeIdRef.current = null;
      if (strokeId) emitterRef.current?.onStrokeEnd?.({ strokeId });
    };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    window.addEventListener('resize', resize);

    return () => {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      window.removeEventListener('resize', resize);
      drawing.current = false;
    };
  }, [enabled, mediaRef, resize]);

  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    emitterRef.current?.onClear?.();
  }, []);

  return {
    canvasRef,
    enabled,
    toggle: () => setEnabled((current) => !current),
    clear,
  };
}

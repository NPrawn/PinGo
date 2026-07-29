import { useCallback, useEffect, useRef, useState } from 'react';

const STROKE = '#ffd23f';
const LINE_WIDTH = 3.5;

/**
 * Freehand annotation over the shared screen.
 *
 * The prototype attached pointer listeners to `document` and looked the canvas
 * up by id on every event. This scopes them to the canvas element and cleans up
 * on unmount.
 *
 * TODO: Strokes are local only. Send them over the WebRTC data channel once the
 * annotation event payload is agreed.
 */
export function useScreenDraw() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [enabled, setEnabled] = useState(false);
  const drawing = useRef(false);

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
    };

    const onMove = (event: PointerEvent) => {
      if (!drawing.current) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const { x, y } = point(event);
      ctx.lineTo(x, y);
      ctx.stroke();
    };

    const onUp = () => {
      drawing.current = false;
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
  }, [enabled, resize]);

  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  return {
    canvasRef,
    enabled,
    toggle: () => setEnabled((current) => !current),
    clear,
  };
}

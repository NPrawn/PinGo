import { createConsultEventFallback } from './consultEventFallback';
import type { ConsultDataEvent } from '@/shared/types';

const publish = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('@/shared/api', () => ({ publishConsultationDataChannelEvent: publish }));

let eventSequence = 0;

function drawEvent(body: Pick<ConsultDataEvent, 'eventType' | 'payload'>): ConsultDataEvent {
  eventSequence += 1;
  return {
    ...body,
    sessionId: 'room_1',
    eventId: `evt_${eventSequence}`,
    senderType: 'COUNSELOR',
    timestamp: '2026-08-03T00:00:00.000Z',
    version: 1,
  } as ConsultDataEvent;
}

function move(strokeId: string, x: number) {
  return drawEvent({ eventType: 'DRAW_STROKE_MOVE', payload: { strokeId, points: [{ x, y: x }] } });
}

/** 보낸 순서대로의 요청 본문. */
function publishedPayloads() {
  return publish.mock.calls.map(
    ([, request]) => request as { type: string; payload: ConsultDataEvent },
  );
}

describe('createConsultEventFallback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    publish.mockClear();
    eventSequence = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * 손이 움직이는 대로 나오는 이동 이벤트는 초당 수십 개다. DataChannel 과 달리 요청 하나에
   * 이벤트 하나라, 그대로 올리면 회선도 서버도 감당하지 못한다.
   */
  it('같은 선의 이동은 한 요청으로 모아 보낸다', async () => {
    const fallback = createConsultEventFallback('consultation-1', 100);

    fallback.send(move('stroke_1', 0.1));
    fallback.send(move('stroke_1', 0.2));
    fallback.send(move('stroke_1', 0.3));
    expect(publish).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(100);

    expect(publish).toHaveBeenCalledTimes(1);
    const [request] = publishedPayloads();
    expect(request.type).toBe('DRAW_STROKE_MOVE');
    // 점은 하나도 빠지지 않아야 같은 선이 그려진다.
    expect(request.payload.payload).toEqual({
      strokeId: 'stroke_1',
      points: [
        { x: 0.1, y: 0.1 },
        { x: 0.2, y: 0.2 },
        { x: 0.3, y: 0.3 },
      ],
    });
  });

  /** 다른 선의 점을 한 덩어리로 합치면 두 선이 이어진 엉뚱한 획이 된다. */
  it('선이 바뀌면 합치지 않는다', async () => {
    const fallback = createConsultEventFallback('consultation-1', 100);

    fallback.send(move('stroke_1', 0.1));
    fallback.send(move('stroke_2', 0.9));

    await vi.advanceTimersByTimeAsync(100);

    expect(publishedPayloads().map((request) => request.payload.payload)).toEqual([
      { strokeId: 'stroke_1', points: [{ x: 0.1, y: 0.1 }] },
      { strokeId: 'stroke_2', points: [{ x: 0.9, y: 0.9 }] },
    ]);
  });

  /** 선을 시작하고 끝내고 지우는 일은 눈에 바로 보여야 한다. */
  it('이동이 아닌 이벤트는 모아 두지 않고 바로 보낸다', async () => {
    const fallback = createConsultEventFallback('consultation-1', 100);

    fallback.send(drawEvent({ eventType: 'DRAW_CLEAR', payload: {} }));
    await vi.advanceTimersByTimeAsync(0);

    expect(publish).toHaveBeenCalledTimes(1);
    expect(publishedPayloads()[0]?.type).toBe('DRAW_CLEAR');
  });

  /**
   * 서버는 도착한 순서대로 SSE 에 흘려보낸다. 여러 요청을 한꺼번에 띄우면 그 순서가
   * 뒤바뀌어 사용자 화면에 그린 적 없는 방향의 선이 남는다.
   */
  it('앞 요청이 끝난 뒤에 다음 요청을 보낸다', async () => {
    let resolveFirst: (() => void) | undefined;
    publish.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveFirst = resolve;
        }),
    );

    const fallback = createConsultEventFallback('consultation-1', 100);
    fallback.send(
      drawEvent({
        eventType: 'DRAW_STROKE_START',
        payload: { strokeId: 's', x: 0, y: 0, color: '#fff', width: 3 },
      }),
    );
    fallback.send(move('s', 0.4));

    await vi.advanceTimersByTimeAsync(100);
    // 첫 요청이 아직 끝나지 않았으니 두 번째는 나가지 않았다.
    expect(publish).toHaveBeenCalledTimes(1);

    resolveFirst?.();
    await vi.advanceTimersByTimeAsync(0);

    expect(publish).toHaveBeenCalledTimes(2);
    expect(publishedPayloads().map((request) => request.type)).toEqual([
      'DRAW_STROKE_START',
      'DRAW_STROKE_MOVE',
    ]);
  });

  /** 그리던 도중에 화면을 벗어나도 여기까지 그린 것은 상대에게 닿아야 한다. */
  it('멈출 때 모아 둔 이동을 마저 보내고 그 뒤로는 받지 않는다', async () => {
    const fallback = createConsultEventFallback('consultation-1', 100);

    fallback.send(move('stroke_1', 0.5));
    fallback.stop();
    await vi.advanceTimersByTimeAsync(0);

    expect(publish).toHaveBeenCalledTimes(1);

    fallback.send(move('stroke_1', 0.6));
    await vi.advanceTimersByTimeAsync(100);

    expect(publish).toHaveBeenCalledTimes(1);
  });

  /** 한 번의 실패가 그 뒤의 이벤트까지 막으면 선이 중간에서 끊긴다. */
  it('요청이 실패해도 다음 이벤트는 계속 보낸다', async () => {
    publish.mockRejectedValueOnce(new Error('network'));

    const fallback = createConsultEventFallback('consultation-1', 100);
    fallback.send(drawEvent({ eventType: 'DRAW_CLEAR', payload: {} }));
    await vi.advanceTimersByTimeAsync(0);

    fallback.send(drawEvent({ eventType: 'DRAW_STROKE_END', payload: { strokeId: 's' } }));
    await vi.advanceTimersByTimeAsync(0);

    expect(publish).toHaveBeenCalledTimes(2);
  });
});

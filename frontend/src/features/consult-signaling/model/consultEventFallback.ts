import { publishConsultationDataChannelEvent } from '@/shared/api';
import type { ConsultDataEvent } from '@/shared/types';

/**
 * DataChannel 이 열리지 않았을 때 상담 이벤트가 지나는 우회로.
 *
 * 서버는 받은 이벤트를 상담 SSE 스트림으로 되뿌린다. DataChannel 과 달리 요청 하나에
 * 이벤트 하나라, 손이 움직이는 대로 나오는 초당 수십 개의 이동 이벤트를 그대로 올리면
 * 회선도 서버도 감당하지 못한다. 같은 선의 이동은 잠깐 모아 한 번에 보낸다.
 */

/** 이동 이벤트를 모아 두는 시간. 길수록 요청은 줄지만 선이 늦게 따라 그려진다. */
const DEFAULT_FLUSH_MS = 100;

export interface ConsultEventFallback {
  send: (event: ConsultDataEvent) => void;
  /** 남은 이벤트를 마저 보내고 더 받지 않는다. */
  stop: () => void;
}

export function createConsultEventFallback(
  consultationId: string,
  flushMs: number = DEFAULT_FLUSH_MS,
): ConsultEventFallback {
  const queue: ConsultDataEvent[] = [];
  let timer: number | undefined;
  let stopped = false;
  /**
   * 보내는 순서를 지키려고 앞 요청에 이어 붙인다.
   *
   * 한꺼번에 띄우면 서버에 닿는 순서가 뒤바뀌어, 사용자 화면에는 그린 적 없는 방향의
   * 선이 남는다.
   */
  let sending: Promise<void> = Promise.resolve();

  const flush = () => {
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timer = undefined;
    }
    if (queue.length === 0) return;

    const pending = queue.splice(0, queue.length);
    sending = pending.reduce(
      (chain, event) =>
        chain.then(() =>
          publishConsultationDataChannelEvent(consultationId, {
            type: event.eventType,
            payload: event,
          }).catch(() => undefined),
        ),
      sending,
    );
  };

  const scheduleFlush = () => {
    if (timer !== undefined) return;
    timer = window.setTimeout(flush, flushMs);
  };

  const send = (event: ConsultDataEvent) => {
    if (stopped) return;

    const last = queue.at(-1);
    if (
      event.eventType === 'DRAW_STROKE_MOVE' &&
      last?.eventType === 'DRAW_STROKE_MOVE' &&
      last.payload.strokeId === event.payload.strokeId
    ) {
      // 같은 선을 잇는 점들이다. 하나로 합쳐도 그려지는 모양은 같다.
      queue[queue.length - 1] = {
        ...last,
        payload: { ...last.payload, points: [...last.payload.points, ...event.payload.points] },
      };
    } else if (event.eventType === 'MAP_SYNC') {
      /**
       * 지도 상태는 쌓이는 것이 아니라 덮어쓰는 스냅숏이다.
       *
       * 사용자가 걸으면 위치가 계속 갱신되는데, 지나간 위치를 하나하나 올려 봐야 상담자
       * 화면에는 마지막 것만 남는다. 아직 못 보낸 것이 있으면 그 자리를 새것으로 바꾼다.
       */
      const pendingIndex = queue.findIndex((queued) => queued.eventType === 'MAP_SYNC');
      if (pendingIndex >= 0) queue[pendingIndex] = event;
      else queue.push(event);
    } else {
      queue.push(event);
    }

    // 선을 시작하고 끝내고 지우는 일은 바로 보여야 한다. 모아 두는 것은 이동과 지도 상태뿐이다.
    if (event.eventType === 'DRAW_STROKE_MOVE' || event.eventType === 'MAP_SYNC') scheduleFlush();
    else flush();
  };

  return {
    send,
    stop: () => {
      // 그리던 도중에 끊겼어도 여기까지 그린 것은 상대에게 닿아야 한다.
      flush();
      stopped = true;
    },
  };
}

import { createConsultEvent, parseConsultEvent } from './consultEvents';

/**
 * 상담자가 지도에서 짚어 준 지점과, 사용자가 보내는 지도 스냅숏은 그리기와 같은 길로 오간다.
 * 이 목록에서 빠지면 받는 쪽이 조용히 버려서, 화면에는 아무 일도 일어나지 않는다.
 */
describe('지도 관련 이벤트', () => {
  it.each(['MAP_SYNC', 'DESTINATION_CHANGE_REQUESTED', 'CURRENT_LOCATION_CORRECTED'])(
    '%s 도 그리기와 같은 길로 오간다',
    (eventType) => {
      const raw = JSON.stringify({ eventId: 'evt_1', eventType, payload: {} });

      expect(parseConsultEvent(raw)?.eventType).toBe(eventType);
    },
  );

  it('모르는 종류는 화면에 옮기지 않는다', () => {
    const raw = JSON.stringify({ eventId: 'evt_1', eventType: 'SOMETHING_ELSE', payload: {} });

    expect(parseConsultEvent(raw)).toBeNull();
  });
});

describe('createConsultEvent', () => {
  it('명세 4장의 envelope 를 채운다', () => {
    const event = createConsultEvent('room_cs_1', 'COUNSELOR', {
      eventType: 'DRAW_CLEAR',
      payload: {},
    });

    expect(event).toMatchObject({
      sessionId: 'room_cs_1',
      senderType: 'COUNSELOR',
      eventType: 'DRAW_CLEAR',
      version: 1,
    });
    expect(event.eventId).toMatch(/^evt_/);
    expect(Date.parse(event.timestamp)).not.toBeNaN();
  });

  /** 수신 측이 중복을 걸러 내려면 eventId 가 겹치면 안 된다. */
  it('이벤트마다 다른 eventId 를 준다', () => {
    const first = createConsultEvent('room_cs_1', 'COUNSELOR', {
      eventType: 'DRAW_CLEAR',
      payload: {},
    });
    const second = createConsultEvent('room_cs_1', 'COUNSELOR', {
      eventType: 'DRAW_CLEAR',
      payload: {},
    });

    expect(first.eventId).not.toBe(second.eventId);
  });
});

describe('parseConsultEvent', () => {
  it('그리기 이벤트를 읽는다', () => {
    const raw = JSON.stringify(
      createConsultEvent('room_cs_1', 'COUNSELOR', {
        eventType: 'DRAW_STROKE_START',
        payload: { strokeId: 'stroke_1', x: 0.42, y: 0.31, color: '#ffd23f', width: 3.5 },
      }),
    );

    expect(parseConsultEvent(raw)).toMatchObject({
      eventType: 'DRAW_STROKE_START',
      payload: { strokeId: 'stroke_1', x: 0.42 },
    });
  });

  /** 상대가 보낸 것을 그대로 그리면 잘못된 값 하나로 화면이 깨진다. */
  it('모르는 이벤트와 망가진 JSON 은 버린다', () => {
    expect(parseConsultEvent('{')).toBeNull();
    expect(
      parseConsultEvent(JSON.stringify({ eventId: 'evt_1', eventType: 'DROP_TABLE' })),
    ).toBeNull();
    expect(parseConsultEvent(JSON.stringify({ eventType: 'DRAW_CLEAR' }))).toBeNull();
  });
});

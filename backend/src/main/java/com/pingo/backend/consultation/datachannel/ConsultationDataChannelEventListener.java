package com.pingo.backend.consultation.datachannel;

import com.pingo.backend.consultation.datachannel.dto.ConsultationDataChannelEventResponse;
import com.pingo.backend.consultation.realtime.ConsultationWaitingEmitterRegistry;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * DataChannel 우회 이벤트를 상담 SSE 스트림으로 흘려보낸다.
 *
 * 다른 상담 이벤트와 달리 비동기로 넘기지 않는다. 이 이벤트는 손으로 그린 선을 잇는
 * 조각들이라 도착 순서가 곧 그림이다. `consultationEventTaskExecutor` 는 스레드가 여럿이라
 * 잇달아 들어온 조각이 뒤바뀔 수 있고, 그러면 사용자 화면에는 엉뚱한 방향의 선이 남는다.
 * 하는 일은 emitter 버퍼에 쓰는 것뿐이라 요청 스레드에서 처리해도 무겁지 않다.
 */
@Component
@RequiredArgsConstructor
public class ConsultationDataChannelEventListener {

    private static final String DATA_CHANNEL_EVENT_NAME = "DATA_CHANNEL";

    private final ConsultationWaitingEmitterRegistry emitterRegistry;

    @EventListener
    public void handleDataChannelEvent(ConsultationDataChannelEventResponse event) {
        emitterRegistry.publish(
                event.consultationRequestId(),
                DATA_CHANNEL_EVENT_NAME,
                event
        );
    }
}

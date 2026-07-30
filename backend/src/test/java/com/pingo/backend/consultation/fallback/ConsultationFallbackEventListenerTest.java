package com.pingo.backend.consultation.fallback;

import com.pingo.backend.consultation.realtime.ConsultationWaitingEmitterRegistry;
import com.pingo.backend.consultation.realtime.ConsultationWaitingEventResponse;
import com.pingo.backend.consultation.realtime.ConsultationWaitingEventType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class ConsultationFallbackEventListenerTest {

    private ConsultationWaitingEmitterRegistry emitterRegistry;
    private ConsultationFallbackEventListener listener;

    @BeforeEach
    void setUp() {
        emitterRegistry = mock(ConsultationWaitingEmitterRegistry.class);
        listener = new ConsultationFallbackEventListener(emitterRegistry);
    }

    @Test
    void handleFallbackEventPublishesWaitingEvent() {
        ConsultationFallbackEventResponse event = new ConsultationFallbackEventResponse(
                "consultation-1",
                ConsultationFallbackEventType.VIDEO_FAILED,
                "camera permission denied",
                Instant.parse("2026-07-30T00:00:00Z")
        );

        listener.handleFallbackEvent(event);

        ArgumentCaptor<ConsultationWaitingEventResponse> captor =
                ArgumentCaptor.forClass(ConsultationWaitingEventResponse.class);
        verify(emitterRegistry).publish(captor.capture());

        ConsultationWaitingEventResponse waitingEvent = captor.getValue();
        assertThat(waitingEvent.consultationRequestId()).isEqualTo("consultation-1");
        assertThat(waitingEvent.type()).isEqualTo(ConsultationWaitingEventType.WAITING);
        assertThat(waitingEvent.signalingRoomId()).isNull();
        assertThat(waitingEvent.message()).isEqualTo("영상 연결에 실패했습니다. 음성 상담으로 전환을 시도합니다.");
        assertThat(waitingEvent.timestamp()).isEqualTo(Instant.parse("2026-07-30T00:00:00Z"));
    }
}
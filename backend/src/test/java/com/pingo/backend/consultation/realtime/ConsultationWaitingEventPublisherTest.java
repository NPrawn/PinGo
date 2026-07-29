package com.pingo.backend.consultation.realtime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

public class ConsultationWaitingEventPublisherTest {

    private ConsultationWaitingEmitterRegistry emitterRegistry;
    private ConsultationWaitingEventPublisher publisher;

    @BeforeEach
    void setUp() {
        emitterRegistry = mock(ConsultationWaitingEmitterRegistry.class);
        Clock clock = Clock.fixed(Instant.parse("2026-07-29T00:00:00Z"), ZoneOffset.UTC);
        publisher = new ConsultationWaitingEventPublisher(emitterRegistry, clock);
    }

    @Test
    void publishAcceptedSendsAcceptedEventWithSignalingRoomId() {
        publisher.publishAccepted("consultation-1", "room-1");

        ArgumentCaptor<ConsultationWaitingEventResponse> captor =
                ArgumentCaptor.forClass(ConsultationWaitingEventResponse.class);
        verify(emitterRegistry).publish(captor.capture());

        ConsultationWaitingEventResponse event = captor.getValue();
        assertThat(event.consultationRequestId()).isEqualTo("consultation-1");
        assertThat(event.type()).isEqualTo(ConsultationWaitingEventType.ACCEPTED);
        assertThat(event.signalingRoomId()).isEqualTo("room-1");
        assertThat(event.timestamp()).isEqualTo(Instant.parse("2026-07-29T00:00:00Z"));
    }

    @Test
    void publishWaitingSendsWaitingEventWithoutSignalingRoomId() {
        publisher.publishWaiting("consultation-1");

        ArgumentCaptor<ConsultationWaitingEventResponse> captor =
                ArgumentCaptor.forClass(ConsultationWaitingEventResponse.class);
        verify(emitterRegistry).publish(captor.capture());

        ConsultationWaitingEventResponse event = captor.getValue();
        assertThat(event.consultationRequestId()).isEqualTo("consultation-1");
        assertThat(event.type()).isEqualTo(ConsultationWaitingEventType.WAITING);
        assertThat(event.signalingRoomId()).isNull();
        assertThat(event.timestamp()).isEqualTo(Instant.parse("2026-07-29T00:00:00Z"));
    }

    @Test
    void publishNoCounselorSendsNoCounselorEvent() {
        publisher.publishNoCounselor("consultation-1");

        ArgumentCaptor<ConsultationWaitingEventResponse> captor =
                ArgumentCaptor.forClass(ConsultationWaitingEventResponse.class);
        verify(emitterRegistry).publish(captor.capture());

        ConsultationWaitingEventResponse event = captor.getValue();
        assertThat(event.consultationRequestId()).isEqualTo("consultation-1");
        assertThat(event.type()).isEqualTo(ConsultationWaitingEventType.NO_COUNSELOR);
        assertThat(event.signalingRoomId()).isNull();
        assertThat(event.message()).isEqualTo("상담 가능한 상담자가 없습니다.");
        assertThat(event.timestamp()).isEqualTo(Instant.parse("2026-07-29T00:00:00Z"));
    }
}

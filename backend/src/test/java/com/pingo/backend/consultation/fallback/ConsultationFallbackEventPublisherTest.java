package com.pingo.backend.consultation.fallback;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.context.ApplicationEventPublisher;

class ConsultationFallbackEventPublisherTest {

    private ApplicationEventPublisher applicationEventPublisher;
    private ConsultationFallbackEventPublisher publisher;

    @BeforeEach
    void setUp() {
        applicationEventPublisher = mock(ApplicationEventPublisher.class);
        Clock clock = Clock.fixed(Instant.parse("2026-07-30T00:00:00Z"), ZoneOffset.UTC);
        publisher = new ConsultationFallbackEventPublisher(applicationEventPublisher, clock);
    }

    @Test
    void publishVideoFailedPublishesVideoFailedEvent() {
        publisher.publishVideoFailed("consultation-1", "camera permission denied");

        ArgumentCaptor<ConsultationFallbackEventResponse> captor =
                ArgumentCaptor.forClass(ConsultationFallbackEventResponse.class);
        verify(applicationEventPublisher).publishEvent(captor.capture());

        ConsultationFallbackEventResponse event = captor.getValue();
        assertThat(event.consultationRequestId()).isEqualTo("consultation-1");
        assertThat(event.type()).isEqualTo(ConsultationFallbackEventType.VIDEO_FAILED);
        assertThat(event.reason()).isEqualTo("camera permission denied");
        assertThat(event.timestamp()).isEqualTo(Instant.parse("2026-07-30T00:00:00Z"));
    }

    @Test
    void publishFallbackConfirmedPublishesFallbackConfirmedEvent() {
        publisher.publishFallbackConfirmed("consultation-1", "chat fallback accepted");

        ArgumentCaptor<ConsultationFallbackEventResponse> captor =
                ArgumentCaptor.forClass(ConsultationFallbackEventResponse.class);
        verify(applicationEventPublisher).publishEvent(captor.capture());

        ConsultationFallbackEventResponse event = captor.getValue();
        assertThat(event.consultationRequestId()).isEqualTo("consultation-1");
        assertThat(event.type()).isEqualTo(ConsultationFallbackEventType.FALLBACK_CONFIRMED);
        assertThat(event.reason()).isEqualTo("chat fallback accepted");
    }
}
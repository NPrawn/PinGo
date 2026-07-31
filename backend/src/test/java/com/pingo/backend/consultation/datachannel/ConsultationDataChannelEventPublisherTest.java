package com.pingo.backend.consultation.datachannel;

import com.pingo.backend.consultation.datachannel.dto.ConsultationDataChannelEventResponse;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.context.ApplicationEventPublisher;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

public class ConsultationDataChannelEventPublisherTest {

    private ApplicationEventPublisher applicationEventPublisher;
    private ConsultationDataChannelEventPublisher publisher;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        applicationEventPublisher = mock(ApplicationEventPublisher.class);
        Clock clock = Clock.fixed(Instant.parse("2026-07-30T00:00:00Z"), ZoneOffset.UTC);
        publisher = new ConsultationDataChannelEventPublisher(applicationEventPublisher, clock);
        objectMapper = new ObjectMapper();
    }

    @Test
    void publishPublishesDataChannelEvent() throws Exception {
        JsonNode payload = objectMapper.readTree("""
                {
                  "x": 0.42,
                  "y": 0.31
                }
                """);

        publisher.publish("consultation-1", ConsultationDataChannelEventType.ARROW_POINTED, payload);

        ArgumentCaptor<ConsultationDataChannelEventResponse> captor =
                ArgumentCaptor.forClass(ConsultationDataChannelEventResponse.class);
        verify(applicationEventPublisher).publishEvent(captor.capture());

        ConsultationDataChannelEventResponse event = captor.getValue();
        assertThat(event.consultationRequestId()).isEqualTo("consultation-1");
        assertThat(event.type()).isEqualTo(ConsultationDataChannelEventType.ARROW_POINTED);
        assertThat(event.payload()).isEqualTo(payload);
        assertThat(event.timestamp()).isEqualTo(Instant.parse("2026-07-30T00:00:00Z"));
    }
}

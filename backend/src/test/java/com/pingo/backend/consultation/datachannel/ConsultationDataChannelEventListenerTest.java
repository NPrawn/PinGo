package com.pingo.backend.consultation.datachannel;

import com.pingo.backend.consultation.datachannel.dto.ConsultationDataChannelEventResponse;
import com.pingo.backend.consultation.realtime.ConsultationWaitingEmitterRegistry;
import java.time.Instant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class ConsultationDataChannelEventListenerTest {

    private ConsultationWaitingEmitterRegistry emitterRegistry;
    private ConsultationDataChannelEventListener listener;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        emitterRegistry = mock(ConsultationWaitingEmitterRegistry.class);
        listener = new ConsultationDataChannelEventListener(emitterRegistry);
        objectMapper = new ObjectMapper();
    }

    @Test
    void handleDataChannelEventPublishesDataChannelSseEvent() throws Exception {
        JsonNode payload = objectMapper.readTree("""
                {
                  "message": "왼쪽으로 이동하세요."
                }
                """);
        ConsultationDataChannelEventResponse event = new ConsultationDataChannelEventResponse(
                "consultation-1",
                ConsultationDataChannelEventType.GUIDE_MESSAGE_SENT,
                payload,
                Instant.parse("2026-07-30T00:00:00Z")
        );

        listener.handleDataChannelEvent(event);

        verify(emitterRegistry).publish("consultation-1", "DATA_CHANNEL", event);
    }
}

package com.pingo.backend.consultation.datachannel;

import com.pingo.backend.consultation.datachannel.dto.ConsultationDataChannelEventResponse;
import java.time.Clock;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;

@Service
@RequiredArgsConstructor
public class ConsultationDataChannelEventPublisher {

    private final ApplicationEventPublisher applicationEventPublisher;
    private final Clock clock;

    public void publish(
            String consultationRequestId,
            ConsultationDataChannelEventType type,
            JsonNode payload
    ) {
        applicationEventPublisher.publishEvent(new ConsultationDataChannelEventResponse(
                consultationRequestId,
                type,
                payload,
                Instant.now(clock)
        ));
    }
}

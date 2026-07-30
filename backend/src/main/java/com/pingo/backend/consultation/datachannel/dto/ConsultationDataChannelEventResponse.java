package com.pingo.backend.consultation.datachannel.dto;

import com.pingo.backend.consultation.datachannel.ConsultationDataChannelEventType;
import java.time.Instant;
import tools.jackson.databind.JsonNode;

public record ConsultationDataChannelEventResponse(
        String consultationRequestId,
        ConsultationDataChannelEventType type,
        JsonNode payload,
        Instant timestamp
) {

}

package com.pingo.backend.consultation.datachannel.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.pingo.backend.consultation.datachannel.ConsultationDataChannelEventType;
import java.time.Instant;

public record ConsultationDataChannelEventResponse(
        String consultationRequestId,
        ConsultationDataChannelEventType type,
        JsonNode payload,
        Instant timestamp
) {

}

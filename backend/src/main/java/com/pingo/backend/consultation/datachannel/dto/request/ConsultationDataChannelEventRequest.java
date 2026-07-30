package com.pingo.backend.consultation.datachannel.dto.request;

import com.pingo.backend.consultation.datachannel.ConsultationDataChannelEventType;
import jakarta.validation.constraints.NotNull;
import com.fasterxml.jackson.databind.JsonNode;

public record ConsultationDataChannelEventRequest(
        @NotNull
        ConsultationDataChannelEventType type,
        JsonNode payload
) {

}

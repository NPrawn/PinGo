package com.pingo.backend.consultation.fallback.dto.request;

import com.pingo.backend.consultation.fallback.ConsultationFallbackEventType;
import jakarta.validation.constraints.NotNull;

public record ConsultationFallbackEventRequest(
        @NotNull
        ConsultationFallbackEventType type,
        String reason
) {
}

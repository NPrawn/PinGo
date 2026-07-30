package com.pingo.backend.consultation.fallback;

import java.time.Instant;

public record ConsultationFallbackEventResponse(
        String consultationRequestId,
        ConsultationFallbackEventType type,
        String reason,
        Instant timestamp
) {
}

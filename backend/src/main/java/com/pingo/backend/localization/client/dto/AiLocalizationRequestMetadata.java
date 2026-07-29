package com.pingo.backend.localization.client.dto;

import java.time.Instant;

public record AiLocalizationRequestMetadata(
        Long stationId,
        AiCameraMetadata camera,
        Instant capturedAt
) {

}

package com.pingo.backend.localization.client.dto;

public record AiMapResultResponse(
        String mapVersion,
        String floor,
        AiLocalizationStatus status,
        AiQualityResponse quality
) {

}

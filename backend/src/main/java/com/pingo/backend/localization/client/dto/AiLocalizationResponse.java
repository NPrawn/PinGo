package com.pingo.backend.localization.client.dto;

import java.util.List;

public record AiLocalizationResponse(
        String requestId,
        AiLocalizationStatus status,
        String mapVersion,
        String selectedMapVersion,
        String floor,
        AiPoseResponse pose,
        AiQualityResponse quality,
        List<AiMapResultResponse> mapResults,
        AiTimingResponse timingMs,
        String failureReason
) {

}

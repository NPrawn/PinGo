package com.pingo.backend.place.dto.response;

import java.math.BigDecimal;

public record RecommendedExitResponse(
        Long recommendationId,
        Long placeId,
        Long exitFacilityId,
        String exitNameKo,
        String exitNameEn,
        int priority,
        boolean isPrimary,
        String reasonKo,
        String reasonEn,
        Integer walkingTimeMin,
        ExitLocation exitLocation
) {

    public record ExitLocation(
            BigDecimal latitude,
            BigDecimal longitude
    ) {
    }
}

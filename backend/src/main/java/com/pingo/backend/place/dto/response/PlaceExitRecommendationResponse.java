package com.pingo.backend.place.dto.response;

import com.pingo.backend.place.domain.PlaceExitRecommendation;

public record PlaceExitRecommendationResponse(
        Long recommendationId,
        Long placeId,
        Long exitFacilityId,
        int priority,
        String reasonKo,
        String reasonEn,
        Integer walkingTimeMin,
        boolean isPrimary
) {

    public static PlaceExitRecommendationResponse from(PlaceExitRecommendation recommendation) {
        return new PlaceExitRecommendationResponse(
                recommendation.getId(),
                recommendation.getPlaceId(),
                recommendation.getExitFacilityId(),
                recommendation.getPriority(),
                recommendation.getReasonKo(),
                recommendation.getReasonEn(),
                recommendation.getWalkingTimeMin(),
                recommendation.isPrimary()
        );
    }
}

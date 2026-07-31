package com.pingo.backend.destination.dto.response;

public record NearestExitResponse(
        Long exitFacilityId,
        String exitNumber
) {
}

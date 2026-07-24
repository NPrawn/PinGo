package com.pingo.backend.place.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

/**
 * 장소-출구 추천 등록 요청. 주변 장소(placeId)와 추천 출구 시설(exitFacilityId)을 연결한다.
 * exitFacilityId 는 활성 상태의 출구(facilityType=exit) 시설이어야 한다.
 */
public record PlaceExitRecommendationCreateRequest(
        @NotNull
        Long placeId,

        @NotNull
        Long exitFacilityId,

        @NotNull
        @PositiveOrZero
        Integer priority,

        @Size(max = 255)
        String reasonKo,

        @Size(max = 255)
        String reasonEn,

        @PositiveOrZero
        Integer walkingTimeMin,

        Boolean isPrimary
) {
}

package com.pingo.backend.place.dto.response;

import com.pingo.backend.place.domain.NearbyPlace;

import java.math.BigDecimal;

public record NearbyPlaceResponse(
        Long placeId,
        Long stationId,
        String nameKo,
        String nameEn,
        String category,
        String address,
        BigDecimal latitude,
        BigDecimal longitude,
        String externalMapUrl,
        boolean active
) {

    public static NearbyPlaceResponse from(NearbyPlace place) {
        return new NearbyPlaceResponse(
                place.getId(),
                place.getStationId(),
                place.getNameKo(),
                place.getNameEn(),
                place.getCategory(),
                place.getAddress(),
                place.getLatitude(),
                place.getLongitude(),
                place.getExternalMapUrl(),
                place.isActive()
        );
    }
}

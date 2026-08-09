package com.pingo.backend.externalmap.client;

import java.math.BigDecimal;

public record KakaoPlaceSearchResult(
        String placeId,
        String name,
        String category,
        String address,
        BigDecimal latitude,
        BigDecimal longitude,
        Long distanceMeters
) {
}

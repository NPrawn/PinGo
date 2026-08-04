package com.pingo.backend.externalmap.client;

public record KakaoWalkingRouteResult(
        long distanceMeters,
        long estimatedTimeSeconds,
        String landingUrl
) {
}

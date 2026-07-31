package com.pingo.backend.global.geo;

import java.math.BigDecimal;

public final class GeoDistanceCalculator {

    private static final double EARTH_RADIUS_METERS = 6_371_000.0;

    private GeoDistanceCalculator() {
    }

    public static long distanceMeters(
            BigDecimal originLatitude,
            BigDecimal originLongitude,
            BigDecimal destinationLatitude,
            BigDecimal destinationLongitude
    ) {
        double originLat = originLatitude.doubleValue();
        double originLon = originLongitude.doubleValue();
        double destinationLat = destinationLatitude.doubleValue();
        double destinationLon = destinationLongitude.doubleValue();

        double latitudeDelta = Math.toRadians(destinationLat - originLat);
        double longitudeDelta = Math.toRadians(destinationLon - originLon);
        double a = Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2)
                + Math.cos(Math.toRadians(originLat)) * Math.cos(Math.toRadians(destinationLat))
                * Math.sin(longitudeDelta / 2) * Math.sin(longitudeDelta / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return Math.round(EARTH_RADIUS_METERS * c);
    }
}

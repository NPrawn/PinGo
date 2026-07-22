package com.pingo.backend.floormap.dto.response;

import com.pingo.backend.floormap.domain.FloorMap;

import java.math.BigDecimal;

public record FloorMapResponse(
        Long mapId,
        Long floorId,
        String floorCode,
        String mapType,
        String mapUrl,
        Integer width,
        Integer height,
        BigDecimal scaleMPerPx,
        String version
) {

    public static FloorMapResponse of(FloorMap floorMap, String floorCode) {
        return new FloorMapResponse(
                floorMap.getId(),
                floorMap.getFloorId(),
                floorCode,
                floorMap.getMapType(),
                floorMap.getMapUrl(),
                floorMap.getWidth(),
                floorMap.getHeight(),
                floorMap.getScaleMPerPx(),
                floorMap.getVersion()
        );
    }
}

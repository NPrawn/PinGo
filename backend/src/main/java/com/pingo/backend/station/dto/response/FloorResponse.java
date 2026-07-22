package com.pingo.backend.station.dto.response;

import com.pingo.backend.station.domain.StationFloor;

public record FloorResponse(
        Long floorId,
        String floorCode,
        String floorName,
        int floorOrder
) {

    public static FloorResponse from(StationFloor floor) {
        return new FloorResponse(
                floor.getId(),
                floor.getFloorCode(),
                floor.getFloorName(),
                floor.getFloorOrder()
        );
    }
}

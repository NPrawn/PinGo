package com.pingo.backend.route.dto.response;

import com.pingo.backend.route.domain.RouteNode;

import java.math.BigDecimal;

public record RouteNodeResponse(
        Long nodeId,
        Long stationId,
        Long floorId,
        String nodeType,
        String name,
        BigDecimal mapX,
        BigDecimal mapY,
        boolean isLandmark
) {

    public static RouteNodeResponse from(RouteNode node) {
        return new RouteNodeResponse(
                node.getId(),
                node.getStationId(),
                node.getFloorId(),
                node.getNodeType(),
                node.getName(),
                node.getMapX(),
                node.getMapY(),
                node.isLandmark()
        );
    }
}

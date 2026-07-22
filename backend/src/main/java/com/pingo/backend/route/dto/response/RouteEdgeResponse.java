package com.pingo.backend.route.dto.response;

import com.pingo.backend.route.domain.RouteEdge;

import java.math.BigDecimal;

public record RouteEdgeResponse(
        Long edgeId,
        Long stationId,
        Long fromNodeId,
        Long toNodeId,
        BigDecimal distanceM,
        Integer estimatedTimeSec,
        String moveType,
        boolean isAccessible,
        boolean isBidirectional
) {

    public static RouteEdgeResponse from(RouteEdge edge) {
        return new RouteEdgeResponse(
                edge.getId(),
                edge.getStationId(),
                edge.getFromNodeId(),
                edge.getToNodeId(),
                edge.getDistanceM(),
                edge.getEstimatedTimeSec(),
                edge.getMoveType(),
                edge.isAccessible(),
                edge.isBidirectional()
        );
    }
}

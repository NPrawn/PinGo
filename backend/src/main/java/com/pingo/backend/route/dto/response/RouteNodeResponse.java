package com.pingo.backend.route.dto.response;

import com.pingo.backend.route.domain.RouteNode;

import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;

public record RouteNodeResponse(
        Long nodeId,
        Long stationId,
        Long floorId,
        String nodeType,
        String name,
        BigDecimal mapX,
        BigDecimal mapY,
        @Schema(
                description = "캐노니컬 높이(m). 층 바닥 기준이며 역삼역은 B1=5 · B2=0 · B3=-5",
                example = "0.0",
                nullable = true
        )
        BigDecimal mapZ,
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
                node.getMapZ(),
                node.isLandmark()
        );
    }
}

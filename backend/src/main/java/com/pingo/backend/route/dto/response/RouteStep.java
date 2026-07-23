package com.pingo.backend.route.dto.response;

import java.math.BigDecimal;

/**
 * 경로의 한 단계(간선 하나). 출발 노드에서 도착 노드까지의 이동을 나타낸다.
 */
public record RouteStep(
        int order,
        Long fromNodeId,
        Long toNodeId,
        BigDecimal distanceM,
        Integer estimatedTimeSec,
        String moveType,
        String instruction
) {
}

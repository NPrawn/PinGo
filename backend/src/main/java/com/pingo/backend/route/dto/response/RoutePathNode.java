package com.pingo.backend.route.dto.response;

import com.pingo.backend.route.domain.RouteNode;

import java.math.BigDecimal;

/**
 * 경로가 지나는 노드의 지도 도면 좌표. 프론트가 실내 도면에 경로 선을 그릴 때 사용한다.
 * mapX·mapY 는 실내 도면 좌표이며 경로 탐색 가중치에는 사용하지 않는다.
 */
public record RoutePathNode(
        Long nodeId,
        Long floorId,
        BigDecimal mapX,
        BigDecimal mapY
) {

    public static RoutePathNode from(RouteNode node) {
        return new RoutePathNode(
                node.getId(),
                node.getFloorId(),
                node.getMapX(),
                node.getMapY()
        );
    }
}

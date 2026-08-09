package com.pingo.backend.route.dto.response;

import com.pingo.backend.route.domain.RouteNode;

import java.math.BigDecimal;

/**
 * 경로가 지나는 노드의 지도 도면 좌표. 프론트가 실내 도면에 경로 선을 그릴 때 사용한다.
 * mapX·mapY 는 실내 도면 좌표이며 경로 탐색 가중치에는 사용하지 않는다.
 *
 * <p>{@code mapZ} 는 그 노드의 캐노니컬 높이(m)다. <b>같은 층 안에서 높이가 갈리는 구간</b>을
 * 구분하는 데 쓴다 — 역삼역 B0.5 중간층은 별도 층이 아니라 {@code floorId} 가 B1 이면서
 * {@code map_z=7.5} 인 노드 6개로 돼 있어, 이 값이 없으면 바닥 구간과 중간층 구간이 도면 위
 * 같은 평면에 겹쳐 그려진다.
 *
 * <p><b>{@code null} 일 수 있다.</b> 관리자가 높이를 넣지 않은 노드다. 역삼역 노드 142개는
 * 전부 값이 있지만, 이후 등록된 노드는 비어 있을 수 있다.
 */
public record RoutePathNode(
        Long nodeId,
        Long floorId,
        BigDecimal mapX,
        BigDecimal mapY,
        BigDecimal mapZ
) {

    public static RoutePathNode from(RouteNode node) {
        return new RoutePathNode(
                node.getId(),
                node.getFloorId(),
                node.getMapX(),
                node.getMapY(),
                node.getMapZ()
        );
    }
}

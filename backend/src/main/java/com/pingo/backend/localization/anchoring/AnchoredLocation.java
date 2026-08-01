package com.pingo.backend.localization.anchoring;

import java.math.BigDecimal;

/**
 * 앵커링 결과. 지도에 찍을 <b>좌표</b>와 경로 탐색을 시작할 <b>노드</b>를 함께 담는다.
 *
 * <p>둘은 쓰임이 다르다. 좌표는 사용자에게 보여주는 값이라 노드에 붙이면 안 되고,
 * 노드는 {@code POST /api/routes/indoor} 가 {@code startNodeId} 를 요구해서 필요하다.
 * 가장 가까운 노드가 몇 미터 떨어져 있어도 경로 결과는 거의 달라지지 않는다.
 */
public record AnchoredLocation(
        Long floorId,
        String floorCode,
        BigDecimal mapX,
        BigDecimal mapY,
        BigDecimal mapZ,
        BigDecimal accuracyM,
        Long startNodeId,
        String startNodeLabel,
        BigDecimal startNodeDistanceM
) {
}

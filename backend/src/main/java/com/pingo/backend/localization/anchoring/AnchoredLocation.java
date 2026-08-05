package com.pingo.backend.localization.anchoring;

import java.math.BigDecimal;

/**
 * 앵커링 결과. 지도에 찍을 <b>좌표</b>, 단말이 향한 <b>방향</b>, 경로 탐색을 시작할 <b>노드</b>를 담는다.
 *
 * <p>셋은 쓰임이 다르다. 좌표는 사용자에게 보여주는 값이라 노드에 붙이면 안 되고,
 * 노드는 {@code POST /api/routes/indoor} 가 {@code startNodeId} 를 요구해서 필요하다.
 * 가장 가까운 노드가 몇 미터 떨어져 있어도 경로 결과는 거의 달라지지 않는다.
 *
 * <p>방향은 FE 가 WebXR 좌표를 지도 좌표에 정렬할 때 쓴다(FE 스펙 8.2·8.5). 좌표와 함께
 * <b>한 쌍</b>이어야 의미가 있어서 여기 같이 담는다. 좌표는 나왔는데 방향을 산출하지 못하는
 * 경우가 있어({@link ColmapToCanonicalMapper#toCanonicalDirection}) 방향만 {@code null} 일 수 있다.
 */
public record AnchoredLocation(
        Long floorId,
        String floorCode,
        BigDecimal mapX,
        BigDecimal mapY,
        BigDecimal mapZ,

        /** 앵커 시점 전방의 캐노니컬 수평면 단위벡터 X. 산출하지 못하면 {@code forwardMapY} 와 함께 {@code null}. */
        BigDecimal forwardMapX,

        /** 앵커 시점 전방의 캐노니컬 수평면 단위벡터 Y. 산출하지 못하면 {@code forwardMapX} 와 함께 {@code null}. */
        BigDecimal forwardMapY,

        BigDecimal accuracyM,
        Long startNodeId,
        String startNodeLabel,
        String startNodeLabelEn,
        BigDecimal startNodeDistanceM
) {
}

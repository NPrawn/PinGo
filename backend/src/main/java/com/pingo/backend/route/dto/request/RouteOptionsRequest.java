package com.pingo.backend.route.dto.request;

import jakarta.validation.constraints.NotNull;

/**
 * 경로 옵션 조회 요청. 출발 노드에서 도착 노드까지의 경로 옵션(빠른 경로·엘리베이터 이용 경로)을 조회한다.
 * 도착 노드는 외부 목적지·출구 추천이 아니라 실내 노드 ID로 직접 지정한다.
 */
public record RouteOptionsRequest(
        @NotNull
        Long stationId,

        @NotNull
        Long startNodeId,

        @NotNull
        Long targetNodeId
) {
}

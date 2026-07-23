package com.pingo.backend.route.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * 선택한 경로 옵션으로 실내 경로 상세를 생성하는 요청.
 * routeType 은 fastest · elevator_only 중 하나이며, 값 검증은 서비스에서 RouteType.fromCode 로 수행한다.
 */
public record RouteCreateRequest(
        @NotNull
        Long stationId,

        @NotNull
        Long startNodeId,

        @NotNull
        Long targetNodeId,

        @NotBlank
        @Size(max = 50)
        String routeType
) {
}

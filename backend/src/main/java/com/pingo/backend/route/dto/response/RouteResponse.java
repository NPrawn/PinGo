package com.pingo.backend.route.dto.response;

import com.pingo.backend.route.domain.RouteType;
import com.pingo.backend.route.domain.RouteUnavailableReason;

import java.math.BigDecimal;
import java.util.List;

/**
 * 선택한 경로 옵션의 상세 결과. 옵션 요약에 더해 단계별 안내(steps)와 지도 렌더링용 노드(pathNodes)를 담는다.
 * 이용 불가한 경우 available=false 와 unavailableReason 만 채우고 steps·pathNodes 는 빈 목록으로 반환한다.
 */
public record RouteResponse(
        String routeType,
        String displayName,
        boolean available,
        String unavailableReason,
        Long startNodeId,
        Long targetNodeId,
        BigDecimal totalDistanceM,
        Integer estimatedTimeSec,
        List<RouteStep> steps,
        List<RoutePathNode> pathNodes
) {

    public static RouteResponse available(
            RouteType routeType,
            Long startNodeId,
            Long targetNodeId,
            BigDecimal totalDistanceM,
            Integer estimatedTimeSec,
            List<RouteStep> steps,
            List<RoutePathNode> pathNodes
    ) {
        return new RouteResponse(
                routeType.getCode(),
                routeType.getDisplayName(),
                true,
                null,
                startNodeId,
                targetNodeId,
                totalDistanceM,
                estimatedTimeSec,
                steps,
                pathNodes
        );
    }

    public static RouteResponse unavailable(
            RouteType routeType,
            Long startNodeId,
            Long targetNodeId,
            RouteUnavailableReason reason
    ) {
        return new RouteResponse(
                routeType.getCode(),
                routeType.getDisplayName(),
                false,
                reason.name(),
                startNodeId,
                targetNodeId,
                null,
                null,
                List.of(),
                List.of()
        );
    }
}

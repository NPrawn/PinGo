package com.pingo.backend.route.dto.response;

import com.pingo.backend.route.domain.RouteType;
import com.pingo.backend.route.domain.RouteUnavailableReason;

import java.math.BigDecimal;

/**
 * 경로 옵션 조회 요약. 옵션별(빠른 경로·엘리베이터 이용 경로) 결과를 steps·pathNodes 없이 요약만 담는다.
 * 이용 불가한 옵션은 available=false 와 unavailableReason 으로 표현하며 목록에서 제외하지 않는다.
 */
public record RouteOptionResponse(
        String routeType,
        String displayName,
        boolean available,
        String unavailableReason,
        BigDecimal totalDistanceM,
        Integer estimatedTimeSec
) {

    public static RouteOptionResponse available(RouteType routeType, BigDecimal totalDistanceM, Integer estimatedTimeSec) {
        return new RouteOptionResponse(
                routeType.getCode(),
                routeType.getDisplayName(),
                true,
                null,
                totalDistanceM,
                estimatedTimeSec
        );
    }

    public static RouteOptionResponse unavailable(RouteType routeType, RouteUnavailableReason reason) {
        return new RouteOptionResponse(
                routeType.getCode(),
                routeType.getDisplayName(),
                false,
                reason.name(),
                null,
                null
        );
    }
}

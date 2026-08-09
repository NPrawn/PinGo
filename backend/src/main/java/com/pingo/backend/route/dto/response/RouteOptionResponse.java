package com.pingo.backend.route.dto.response;

import com.pingo.backend.route.domain.RouteType;
import com.pingo.backend.route.domain.RouteUnavailableReason;
import com.pingo.backend.usersession.domain.Language;

import java.math.BigDecimal;

/**
 * 경로 옵션 조회 요약. 옵션별(빠른 경로·엘리베이터 이용 경로) 결과를 steps·pathNodes 없이 요약만 담는다.
 * 이용 불가한 옵션은 available=false 와 unavailableReason 으로 표현하며 목록에서 제외하지 않는다.
 *
 * <p>{@code hasStairsOrEscalator} 는 이 경로가 계단이나 에스컬레이터를 지나는지다(FR-U-009).
 * 상세 조회와 달리 옵션 조회에는 {@code steps} 가 없어 클라이언트가 스스로 판단할 수 없으므로 함께 내려준다.
 * {@code elevator_only} 는 정의상 항상 false 이고, 두 옵션의 거리·시간 차이가 왜 생기는지를 설명하는 값이다.
 */
public record RouteOptionResponse(
        String routeType,
        String displayName,
        boolean available,
        String unavailableReason,

        /** 이용 불가 사유를 요청 언어로 쓴 문구. 이용 가능하면 {@code null}. */
        String unavailableMessage,

        BigDecimal totalDistanceM,
        Integer estimatedTimeSec,
        boolean hasStairsOrEscalator
) {

    public static RouteOptionResponse available(
            RouteType routeType,
            BigDecimal totalDistanceM,
            Integer estimatedTimeSec,
            boolean hasStairsOrEscalator
    ) {
        return new RouteOptionResponse(
                routeType.getCode(),
                routeType.getDisplayName(),
                true,
                null,
                null,
                totalDistanceM,
                estimatedTimeSec,
                hasStairsOrEscalator
        );
    }

    public static RouteOptionResponse unavailable(
            RouteType routeType,
            RouteUnavailableReason reason,
            Language language
    ) {
        return new RouteOptionResponse(
                routeType.getCode(),
                routeType.getDisplayName(),
                false,
                reason.name(),
                reason.messageFor(language),
                null,
                null,
                false
        );
    }
}

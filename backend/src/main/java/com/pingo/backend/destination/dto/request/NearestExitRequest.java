package com.pingo.backend.destination.dto.request;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;

public record NearestExitRequest(
        @NotNull
        @Positive
        Long stationId,

        @NotNull
        @DecimalMin("-90.0")
        @DecimalMax("90.0")
        BigDecimal destinationLatitude,

        @NotNull
        @DecimalMin("-180.0")
        @DecimalMax("180.0")
        BigDecimal destinationLongitude,

        /**
         * 엘리베이터로 갈 수 있는 출구만 후보로 둘지. 비우면 전체 출구에서 고른다.
         *
         * <p>경로 유형이 {@code elevator_only} 인 안내의 도착 출구를 고를 때 쓴다. 계단·에스컬레이터를
         * 빼고는 닿지 않는 출구를 도착점으로 잡으면, 경로 조회가 그제서야
         * {@code NO_ACCESSIBLE_ROUTE} 를 돌려주어 사용자는 갈 수 있는 출구가 있는데도 없다고
         * 안내받는다. 실제로 역삼역은 B1↔B2 에 엘리베이터가 없어 출구 9개 중 2개(3·4번)만
         * 해당한다.
         *
         * <p>판정은 {@code facility.is_accessible} 을 그대로 믿는다. 그래프에서 파생된 값이며
         * {@code V10} 이 그 근거와 함께 채워 두었다.
         */
        Boolean accessibleOnly
) {
}

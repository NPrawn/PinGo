package com.pingo.backend.route.domain;

import java.util.Arrays;
import java.util.Locale;
import java.util.Optional;

/**
 * 경로 간선 이동 유형. ERD_초안.md 의 move_type 정의를 기준으로 한다.
 * 경로 옵션(계단 없는 경로, 엘리베이터 중심 경로) 필터가 이 값을 기준으로 동작한다.
 */
public enum RouteMoveType {

    WALKWAY("walkway"),
    STAIR("stair"),
    ESCALATOR("escalator"),
    ELEVATOR("elevator"),
    GATE("gate");

    private final String code;

    RouteMoveType(String code) {
        this.code = code;
    }

    public String getCode() {
        return code;
    }

    public static Optional<RouteMoveType> fromCode(String rawValue) {
        if (rawValue == null) {
            return Optional.empty();
        }
        String normalized = rawValue.trim().toLowerCase(Locale.ROOT);
        return Arrays.stream(values())
                .filter(type -> type.code.equals(normalized))
                .findFirst();
    }
}

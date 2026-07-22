package com.pingo.backend.route.domain;

import java.util.Arrays;
import java.util.Locale;
import java.util.Optional;

/**
 * 경로 노드 유형. ERD_초안.md 의 node_type 정의를 기준으로 한다.
 */
public enum RouteNodeType {

    NORMAL("normal"),
    JUNCTION("junction"),
    FACILITY("facility"),
    FLOOR_TRANSITION("floor_transition"),
    EXIT("exit");

    private final String code;

    RouteNodeType(String code) {
        this.code = code;
    }

    public String getCode() {
        return code;
    }

    public static Optional<RouteNodeType> fromCode(String rawValue) {
        if (rawValue == null) {
            return Optional.empty();
        }
        String normalized = rawValue.trim().toLowerCase(Locale.ROOT);
        return Arrays.stream(values())
                .filter(type -> type.code.equals(normalized))
                .findFirst();
    }
}

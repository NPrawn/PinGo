package com.pingo.backend.route.domain;

import java.util.Arrays;
import java.util.Locale;
import java.util.Optional;

/**
 * 경로 노드 유형. erd_최종.md 의 node_type 정의를 기준으로 한다.
 *
 * <p>{@code GATE} 는 개찰구 노드다. 시설 노드는 {@code EXIT}·{@code FLOOR_TRANSITION} 처럼
 * 역할별로 유형을 나누고 있어 개찰구도 같은 방식으로 둔다.
 *
 * <p>{@code RouteMoveType} 에도 {@code gate} 가 있으나 그쪽은 간선의 이동 수단이고
 * <b>현재 데이터에서는 쓰이지 않는다</b>. 개찰구에 연결된 간선은 전부 {@code walkway} 다.
 * 경로 응답에서 개찰구 통과를 구분해야 할 일이 생기면 그때 해당 간선의 이동 수단을 바꾼다.
 */
public enum RouteNodeType {

    NORMAL("normal"),
    JUNCTION("junction"),
    FACILITY("facility"),
    FLOOR_TRANSITION("floor_transition"),
    EXIT("exit"),
    GATE("gate");

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

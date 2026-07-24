package com.pingo.backend.route.domain;

import java.util.Arrays;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;

/**
 * 실내 경로 옵션 유형. 각 유형은 경로 탐색에서 제외할 이동 수단(moveType)을 스스로 정의한다.
 *
 * <ul>
 *     <li>{@code fastest} : 모든 활성 간선을 허용한다. (가중치는 distance_m 기준)</li>
 *     <li>{@code elevator_only} : 계단·에스컬레이터를 제외하고, 일반 통로·엘리베이터·개찰구만 허용한다.
 *         (엘리베이터 간선만 쓰는 경로가 아니라, 계단·에스컬레이터 없이 도달 가능한 경로를 의미한다.)</li>
 * </ul>
 */
public enum RouteType {

    FASTEST("fastest", "빠른 경로", Set.of()),
    ELEVATOR_ONLY("elevator_only", "엘리베이터 이용 경로", Set.of(RouteMoveType.STAIR, RouteMoveType.ESCALATOR));

    private final String code;
    private final String displayName;
    private final Set<RouteMoveType> excludedMoveTypes;

    RouteType(String code, String displayName, Set<RouteMoveType> excludedMoveTypes) {
        this.code = code;
        this.displayName = displayName;
        this.excludedMoveTypes = excludedMoveTypes;
    }

    public String getCode() {
        return code;
    }

    public String getDisplayName() {
        return displayName;
    }

    public Set<RouteMoveType> getExcludedMoveTypes() {
        return excludedMoveTypes;
    }

    /**
     * 해당 이동 수단이 이 경로 유형에서 사용 가능한지 여부.
     */
    public boolean allows(RouteMoveType moveType) {
        return !excludedMoveTypes.contains(moveType);
    }

    public static Optional<RouteType> fromCode(String rawValue) {
        if (rawValue == null) {
            return Optional.empty();
        }
        String normalized = rawValue.trim().toLowerCase(Locale.ROOT);
        return Arrays.stream(values())
                .filter(type -> type.code.equals(normalized))
                .findFirst();
    }
}

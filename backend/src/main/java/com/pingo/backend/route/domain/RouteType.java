package com.pingo.backend.route.domain;

import java.util.Arrays;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;

/**
 * 실내 경로 옵션 유형. 각 유형은 경로 탐색에서 제외할 이동 수단(moveType)을 스스로 정의한다.
 *
 * <ul>
 *     <li>{@code fastest} : 엘리베이터를 제외한다. 일반 통로·계단·에스컬레이터·개찰구를 쓴다.</li>
 *     <li>{@code elevator_only} : 계단·에스컬레이터를 제외하고, 일반 통로·엘리베이터·개찰구만 허용한다.
 *         (엘리베이터 간선만 쓰는 경로가 아니라, 계단·에스컬레이터 없이 도달 가능한 경로를 의미한다.)</li>
 * </ul>
 *
 * <p><b>두 유형은 층을 오르는 수단이 겹치지 않는다.</b> 예전에는 {@code fastest} 가 모든 간선을
 * 허용해서 엘리베이터가 최단이면 그것을 골랐고, 그러면 두 옵션이 같은 엘리베이터를 타서 카드
 * 두 장이 사실상 같아졌다 — 역삼역 B3 엘리베이터 앞에서 출발하면 실제로 그랬다. 무엇을 고르는
 * 것인지 알 수 없어 유형을 나눈 뜻이 사라진다.
 *
 * <p>대가가 있다. {@code fastest} 가 엘리베이터를 못 쓰므로 <b>이름과 달리 최단이 아닐 수 있고</b>,
 * 층 사이가 엘리베이터로만 이어진 구간에서는 도달 불가로 답한다. 역삼역은 B2↔B3 에 계단 8 개,
 * B1↔B2 에 계단·에스컬레이터가 있어 지금 데이터에서는 그런 구간이 없다. 그 대가를 알고 고른
 * 것이며(S15P11A206-345), 되돌리려면 이 집합을 {@code Set.of()} 로 두면 된다.
 */
public enum RouteType {

    FASTEST("fastest", "빠른 경로", Set.of(RouteMoveType.ELEVATOR)),
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

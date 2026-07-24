package com.pingo.backend.route.domain;

/**
 * 경로 옵션이 이용 불가할 때(available=false)의 사유. HTTP 오류가 아니라 정상 응답(200) 안에 담긴다.
 *
 * <ul>
 *     <li>{@code NO_ROUTE} : 출발지에서 도착지까지 연결된 경로가 없다. (그래프 단절 등)</li>
 *     <li>{@code NO_ACCESSIBLE_ROUTE} : 계단·에스컬레이터를 제외한 elevator_only 조건으로는 도착지에 도달할 수 없다.</li>
 * </ul>
 */
public enum RouteUnavailableReason {

    NO_ROUTE("출발지에서 도착지까지 연결된 경로가 없습니다."),
    NO_ACCESSIBLE_ROUTE("계단·에스컬레이터를 제외한 경로로는 도착지까지 이동할 수 없습니다.");

    private final String message;

    RouteUnavailableReason(String message) {
        this.message = message;
    }

    public String getMessage() {
        return message;
    }
}

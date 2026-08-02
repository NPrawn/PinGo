package com.pingo.backend.route.domain;

import com.pingo.backend.usersession.domain.Language;

/**
 * 경로 옵션이 이용 불가할 때(available=false)의 사유. HTTP 오류가 아니라 정상 응답(200) 안에 담긴다.
 *
 * <ul>
 *     <li>{@code NO_ROUTE} : 출발지에서 도착지까지 연결된 경로가 없다. (그래프 단절 등)</li>
 *     <li>{@code NO_ACCESSIBLE_ROUTE} : 계단·에스컬레이터를 제외한 elevator_only 조건으로는 도착지에 도달할 수 없다.</li>
 * </ul>
 *
 * <p>문구는 <b>응답에 실려 사용자에게 그대로 보인다.</b> 이전에는 한국어 문구만 갖고 있으면서
 * 아무데서도 읽지 않아, 클라이언트가 같은 문구를 따로 들고 있어야 했다.
 */
public enum RouteUnavailableReason {

    NO_ROUTE(
            "출발지에서 도착지까지 연결된 경로가 없습니다.",
            "There is no connected route to the destination."),
    NO_ACCESSIBLE_ROUTE(
            "계단·에스컬레이터를 제외한 경로로는 도착지까지 이동할 수 없습니다.",
            "The destination cannot be reached without using stairs or escalators.");

    private final String messageKo;
    private final String messageEn;

    RouteUnavailableReason(String messageKo, String messageEn) {
        this.messageKo = messageKo;
        this.messageEn = messageEn;
    }

    /**
     * 해당 언어의 문구.
     *
     * <p>FR-U-001 이 요구하는 것은 한국어와 영어 둘이다. {@code JA}·{@code ZH} 는 문구가 없어
     * 영어로 떨어지며, 이는 {@link Language#DEFAULT} 와 같은 선택이다.
     */
    public String messageFor(Language language) {
        return language == Language.KO ? messageKo : messageEn;
    }
}

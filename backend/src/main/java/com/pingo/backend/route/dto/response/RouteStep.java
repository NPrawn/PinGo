package com.pingo.backend.route.dto.response;

import java.math.BigDecimal;

/**
 * 경로의 한 단계(간선 하나). 출발 노드에서 도착 노드까지의 이동을 나타낸다.
 *
 * <p><b>{@code instruction} 과 {@code turn}·{@code floorDelta} 는 같은 것을 두 가지로 준다.</b>
 * 문장을 그대로 써도 되고, 구조를 보고 자기 문구와 아이콘을 만들어도 된다. 문장만 주면 언어가
 * 서버에 묶여 일본어·중국어를 넣을 수 없고, 구조만 주면 지금 문장을 쓰고 있는 클라이언트가
 * 깨진다. 둘 다 주면 클라이언트가 고를 수 있다.
 *
 * @param instructionTemplate {@code instruction} 과 같은 문장인데 거리 자리가
 *                   {@code {distance}} 로 비어 있다. <b>걷는 동안 남은 거리를 보여줄 때 쓴다</b>
 *                   — {@code instruction} 에는 구간 전체 길이가 박혀 있어 197m 구간을 절반
 *                   걸어도 "197m 직진하세요" 라고 말한다. 거리를 클라이언트가 앞에 붙이는 방법은
 *                   숫자 위치가 언어마다 달라 쓸 수 없다(한국어는 앞, 영어는 중간). 거리가 들어
 *                   가지 않는 문장(층 이동·개찰구)은 {@code instruction} 과 같은 값이다
 * @param turn       {@code straight} · {@code left} · {@code right} · {@code around}.
 *                   첫 단계이거나 구간이 너무 짧아 판단할 수 없으면 {@code null}
 * @param floorDelta 오르내리는 층수. 위로 가면 양수다. 층 이동이 아니거나 층을 알 수 없으면
 *                   {@code null}. 같은 층 안의 계단이면 0 이다 — 역삼역 B1 개찰구 위 중간층으로
 *                   오르내리는 계단이 여기 해당한다
 */
public record RouteStep(
        int order,
        Long fromNodeId,
        Long toNodeId,
        BigDecimal distanceM,
        Integer estimatedTimeSec,
        String moveType,
        String instruction,
        String instructionTemplate,
        String turn,
        Integer floorDelta
) {
}

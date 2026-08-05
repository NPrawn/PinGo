package com.pingo.backend.route.dto.response;

import com.pingo.backend.route.domain.RouteType;

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
 * @param type       {@code walk} 또는 {@code floor_change}. <b>클라이언트가 층 이동 화면을 띄울
 *                   신호다</b> — 표시 층을 바꾸고 "다 올라왔어요" 를 받을 자리가 여기다.
 *                   {@code fromFloorCode} 와 {@code toFloorCode} 가 다를 때만
 *                   {@code floor_change} 다 (S15P11A206-351)
 * @param edgeClass  {@code walk} 또는 {@code vertical_transition}. 간선이 수직 이동 수단인지다.
 *                   <b>{@code type} 과 다르다.</b> 같은 층 코드 안에서 오르내리는 구간이 있어서다
 *                   — 역삼역 B1 의 B0.5 중간층은 {@code floorCode} 가 B1 이라, 그 에스컬레이터는
 *                   {@code edgeClass} 가 {@code vertical_transition} 이면서 {@code type} 은
 *                   {@code walk} 다. 층 이동 화면을 띄우면 안 되는 자리다
 * @param fromFloorCode 출발 노드가 있는 층 코드({@code B1}·{@code B2}·{@code B3}). 층을 모르면 {@code null}
 * @param toFloorCode   도착 노드가 있는 층 코드. 층 이동 뒤 안내를 재개할 층이다
 * @param accessible 계단·에스컬레이터를 쓸 수 없는 사용자가 지날 수 있는 구간인지.
 *                   <b>{@code route_edge.is_accessible} 이 아니라 {@link RouteType#ELEVATOR_ONLY}
 *                   의 허용 여부로 정한다.</b> 그래야 이 값이 실제 탐색 결과와 어긋날 수 없다 —
 *                   {@code false} 인 구간은 엘리베이터 경로에 애초에 담기지 않는다
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
        Integer floorDelta,
        String type,
        String edgeClass,
        String fromFloorCode,
        String toFloorCode,
        boolean accessible
) {

    /** {@code type} 값. 클라이언트가 층 이동 화면을 띄울지 가른다. */
    public static final String TYPE_WALK = "walk";
    public static final String TYPE_FLOOR_CHANGE = "floor_change";

    /** {@code edgeClass} 값. 간선이 수직 이동 수단인지 가른다. */
    public static final String EDGE_CLASS_WALK = "walk";
    public static final String EDGE_CLASS_VERTICAL = "vertical_transition";
}

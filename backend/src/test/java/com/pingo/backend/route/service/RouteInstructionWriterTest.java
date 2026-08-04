package com.pingo.backend.route.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.pingo.backend.route.domain.RouteMoveType;
import com.pingo.backend.route.domain.RouteNode;
import com.pingo.backend.route.service.RouteFinder.Segment;
import com.pingo.backend.usersession.domain.Language;
import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * 단계별 안내 문장(FR-U-010).
 *
 * <p>좌표는 캐노니컬 프레임이다. <b>+x 가 대략 동쪽, +y 가 대략 남쪽</b>이라 이미지 좌표처럼
 * 뒤집혀 있다. 역삼역 출구의 실측 GPS 로 확인했다 — 출구 6(캐노 y −39.9)이 출구 2(캐노 y +48.5)
 * 보다 북쪽에 있다. 그래서 동쪽으로 가다 남쪽으로 꺾는 것이 우회전이다.
 */
class RouteInstructionWriterTest {

    private final RouteInstructionWriter writer = new RouteInstructionWriter();

    private final Map<Long, RouteNode> nodes = new HashMap<>();
    private final Map<Long, Integer> floorOrders = new HashMap<>();

    @Test
    @DisplayName("첫 단계는 이전 구간이 없어 회전을 붙이지 않는다")
    void firstStepHasNoTurn() {
        node(1L, 1L, 0, 0);
        node(2L, 1L, 10, 0);

        String instruction = write(null, walkway(1L, 2L, 10));

        assertThat(instruction).isEqualTo("10m 직진하세요.");
    }

    @Test
    @DisplayName("동쪽으로 가다 남쪽으로 꺾으면 오른쪽이다")
    void turnsRight() {
        node(1L, 1L, 0, 0);
        node(2L, 1L, 10, 0);      // 동쪽으로
        node(3L, 1L, 10, 12);     // 남쪽으로

        String instruction = write(walkway(1L, 2L, 10), walkway(2L, 3L, 12));

        assertThat(instruction).isEqualTo("오른쪽으로 돌아 12m 이동하세요.");
    }

    @Test
    @DisplayName("동쪽으로 가다 북쪽으로 꺾으면 왼쪽이다")
    void turnsLeft() {
        node(1L, 1L, 0, 0);
        node(2L, 1L, 10, 0);      // 동쪽으로
        node(3L, 1L, 10, -12);    // 북쪽으로

        String instruction = write(walkway(1L, 2L, 10), walkway(2L, 3L, 12));

        assertThat(instruction).isEqualTo("왼쪽으로 돌아 12m 이동하세요.");
    }

    @Test
    @DisplayName("완만하게 꺾이는 곳은 직진으로 본다")
    void treatsGentleBendAsStraight() {
        node(1L, 1L, 0, 0);
        node(2L, 1L, 10, 0);
        node(3L, 1L, 20, 4);      // 약 22도

        String instruction = write(walkway(1L, 2L, 10), walkway(2L, 3L, 11));

        assertThat(instruction).isEqualTo("11m 직진하세요.");
    }

    /**
     * 경계는 45도다. 역삼역 B3 에서 3번 출구까지 실제 경로를 재어 정했다 — 42.7도짜리 굽이는
     * 걷는 사람이 꺾었다고 느끼지 않았고 46.9도는 느꼈다. 그 사이가 경계다.
     */
    @Test
    @DisplayName("45도 경계를 사이에 두고 직진과 회전이 갈린다")
    void splitsStraightAndTurnAtFortyFiveDegrees() {
        node(1L, 1L, 0, 0);
        node(2L, 1L, 10, 0);
        node(3L, 1L, 10 + 10 * Math.cos(Math.toRadians(43)), 10 * Math.sin(Math.toRadians(43)));
        node(4L, 1L, 10 + 10 * Math.cos(Math.toRadians(47)), 10 * Math.sin(Math.toRadians(47)));

        assertThat(write(walkway(1L, 2L, 10), walkway(2L, 3L, 10)))
                .isEqualTo("10m 직진하세요.");
        assertThat(write(walkway(1L, 2L, 10), walkway(2L, 4L, 10)))
                .isEqualTo("오른쪽으로 돌아 10m 이동하세요.");
    }

    @Test
    @DisplayName("되돌아가는 구간은 뒤로 돌라고 안내한다")
    void turnsAround() {
        node(1L, 1L, 0, 0);
        node(2L, 1L, 10, 0);
        node(3L, 1L, 2, 0);       // 왔던 쪽으로

        String instruction = write(walkway(1L, 2L, 10), walkway(2L, 3L, 8));

        assertThat(instruction).isEqualTo("뒤로 돌아 8m 이동하세요.");
    }

    @Test
    @DisplayName("층이 내려가면 계단으로 내려가라고 안내한다")
    void goesDownStairs() {
        node(1L, 1L, 0, 0);       // floor_order 1
        node(2L, 2L, 0, 5);       // floor_order 2 = 아래층
        floorOrders.put(1L, 1);
        floorOrders.put(2L, 2);

        String instruction = write(null, segment(1L, 2L, 5, RouteMoveType.STAIR));

        assertThat(instruction).isEqualTo("계단으로 한 층 내려가세요.");
    }

    @Test
    @DisplayName("층이 올라가면 엘리베이터로 올라가라고 안내한다")
    void goesUpElevator() {
        node(1L, 3L, 0, 0);       // floor_order 3
        node(2L, 1L, 0, 5);       // floor_order 1 = 두 층 위
        floorOrders.put(3L, 3);
        floorOrders.put(1L, 1);

        String instruction = write(null, segment(1L, 2L, 5, RouteMoveType.ELEVATOR));

        assertThat(instruction).isEqualTo("엘리베이터로 2개 층 올라가세요.");
    }

    /**
     * 역삼역 B1 개찰구 위 중간층으로 오르내리는 계단이 여기 해당한다. 별도 층이 아니라
     * {@code floor_code=B1} 안의 {@code map_z=7.5} 로 모델링돼 있어 층 순서가 같다.
     */
    @Test
    @DisplayName("같은 층 안의 계단은 방향 없이 수단만 말한다")
    void keepsMeansOnlyWithinSameFloor() {
        node(1L, 1L, 0, 0);
        node(2L, 1L, 0, 5);
        floorOrders.put(1L, 1);

        String instruction = write(null, segment(1L, 2L, 5, RouteMoveType.STAIR));

        assertThat(instruction).isEqualTo("계단을 이용해 이동하세요.");
    }

    @Test
    @DisplayName("층 정보를 못 찾으면 방향 없이 수단만 말한다")
    void keepsMeansOnlyWithoutFloorOrder() {
        node(1L, 1L, 0, 0);
        node(2L, 2L, 0, 5);

        String instruction = write(null, segment(1L, 2L, 5, RouteMoveType.ESCALATOR));

        assertThat(instruction).isEqualTo("에스컬레이터를 이용해 이동하세요.");
    }

    @Test
    @DisplayName("한국어가 아니면 영어로 쓴다")
    void writesEnglishForNonKorean() {
        node(1L, 1L, 0, 0);
        node(2L, 1L, 10, 0);
        node(3L, 1L, 10, 12);

        assertThat(write(null, walkway(1L, 2L, 10), Language.EN))
                .isEqualTo("Go straight for 10m.");
        assertThat(write(walkway(1L, 2L, 10), walkway(2L, 3L, 12), Language.EN))
                .isEqualTo("Turn right and go 12m.");
        assertThat(write(null, segment(1L, 2L, 5, RouteMoveType.GATE), Language.EN))
                .isEqualTo("Go through the fare gate.");
    }

    /** {@code Language.DEFAULT} 가 EN 이라 일본어·중국어는 영어로 떨어진다. */
    @Test
    @DisplayName("일본어와 중국어는 영어로 떨어진다")
    void fallsBackToEnglish() {
        node(1L, 1L, 0, 0);
        node(2L, 1L, 10, 0);

        assertThat(write(null, walkway(1L, 2L, 10), Language.JA)).isEqualTo("Go straight for 10m.");
        assertThat(write(null, walkway(1L, 2L, 10), Language.ZH)).isEqualTo("Go straight for 10m.");
    }

    /**
     * 노드가 겹쳐 있으면 방향을 정할 수 없다. 그 경우 회전을 붙이지 않는다 — 좌표 오차가
     * 각도를 지배해서 아무 방향이나 나올 수 있다.
     */
    @Test
    @DisplayName("길이가 없는 구간은 회전을 판단하지 않는다")
    void skipsTurnForZeroLengthSegment() {
        node(1L, 1L, 0, 0);
        node(2L, 1L, 0, 0);
        node(3L, 1L, 0, 12);

        String instruction = write(walkway(1L, 2L, 0), walkway(2L, 3L, 12));

        assertThat(instruction).isEqualTo("12m 직진하세요.");
    }

    /**
     * 문장과 구조를 함께 준다. 클라이언트가 문장을 그대로 써도 되고 구조를 보고 자기 문구를
     * 만들어도 된다.
     */
    @Test
    @DisplayName("문장과 함께 회전과 층수를 구조로도 준다")
    void exposesTurnAndFloorDeltaAsData() {
        node(1L, 1L, 0, 0);
        node(2L, 1L, 10, 0);
        node(3L, 1L, 10, 12);
        node(4L, 2L, 10, 12);
        floorOrders.put(1L, 1);
        floorOrders.put(2L, 2);

        assertThat(guidance(null, walkway(1L, 2L, 10), Language.KO))
                .extracting("turn", "floorDelta")
                .containsExactly(null, null);
        assertThat(guidance(walkway(1L, 2L, 10), walkway(2L, 3L, 12), Language.KO))
                .extracting("turn", "floorDelta")
                .containsExactly("right", null);
        assertThat(guidance(null, segment(3L, 4L, 5, RouteMoveType.STAIR), Language.KO))
                .extracting("floorDelta")
                .isEqualTo(-1);
    }

    /**
     * 판단할 수 없는 것과 재어 보니 곧게 가는 것은 다르다. 클라이언트가 화살표를 그릴 때
     * "모름"과 "직진"을 달리 다룰 수 있어야 한다.
     */
    @Test
    @DisplayName("판단할 수 없는 회전은 straight 가 아니라 비어 있다")
    void distinguishesUnknownTurnFromStraight() {
        node(1L, 1L, 0, 0);
        node(2L, 1L, 10, 0);
        node(3L, 1L, 20, 0);

        assertThat(guidance(null, walkway(1L, 2L, 10), Language.KO).turn()).isNull();
        assertThat(guidance(walkway(1L, 2L, 10), walkway(2L, 3L, 10), Language.KO).turn())
                .isEqualTo("straight");
    }

    /**
     * 안내를 합치는 판정(S15P11A206-339).
     *
     * <p>간선 하나가 안내 하나면 긴 통로에서 "직진하세요" 가 되풀이된다. 역삼역 B3 서쪽 끝에서
     * 8번 출구까지 11번 연달아 나왔다.
     */
    @Test
    @DisplayName("곧게 이어지는 통로는 한 안내로 합친다")
    void mergesStraightWalkway() {
        node(1L, 1L, 0, 0);
        node(2L, 1L, 20, 0);
        node(3L, 1L, 45, 0);

        boolean merges = writer.continuesStraightRun(
                walkway(1L, 2L, 20), walkway(1L, 2L, 20), walkway(2L, 3L, 25), nodes);

        assertThat(merges).isTrue();
    }

    @Test
    @DisplayName("꺾이는 곳에서는 합치지 않는다")
    void doesNotMergeAcrossTurn() {
        node(1L, 1L, 0, 0);
        node(2L, 1L, 20, 0);      // 동쪽으로
        node(3L, 1L, 20, 25);     // 남쪽으로 90도

        boolean merges = writer.continuesStraightRun(
                walkway(1L, 2L, 20), walkway(1L, 2L, 20), walkway(2L, 3L, 25), nodes);

        assertThat(merges).isFalse();
    }

    /**
     * 인접한 두 구간만 보면 조금씩 꺾이는 길이 끝없이 합쳐진다.
     *
     * <p>40도씩 두 번 꺾으면 매번 직진으로 판정되지만(45도 미만) 합쳐 놓으면 80도를 돈 길이
     * "직진하세요" 한 문장이 된다. 구간의 첫 방향과도 견주어 끊는다.
     */
    @Test
    @DisplayName("조금씩 꺾여 누적으로 크게 휘면 합치지 않는다")
    void doesNotMergeWhenDriftAccumulates() {
        node(1L, 1L, 0, 0);
        node(2L, 1L, 20, 0);                                  // 0도
        node(3L, 1L, 20 + 15.3, 12.9);                        // 첫 구간 대비 40도
        node(4L, 1L, 20 + 15.3 + 3.5, 12.9 + 19.7);           // 첫 구간 대비 80도

        Segment runStart = walkway(1L, 2L, 20);
        Segment second = walkway(2L, 3L, 20);
        // 40도씩이라 인접 판정만으로는 둘 다 직진이다
        assertThat(writer.continuesStraightRun(runStart, runStart, second, nodes)).isTrue();

        boolean merges = writer.continuesStraightRun(runStart, second, walkway(3L, 4L, 20), nodes);

        assertThat(merges).isFalse();
    }

    @Test
    @DisplayName("이동 수단이 다르면 합치지 않는다")
    void doesNotMergeAcrossMoveType() {
        node(1L, 1L, 0, 0);
        node(2L, 1L, 20, 0);
        node(3L, 1L, 45, 0);

        Segment runStart = walkway(1L, 2L, 20);

        assertThat(writer.continuesStraightRun(
                runStart, runStart, segment(2L, 3L, 25, RouteMoveType.STAIR), nodes)).isFalse();
        assertThat(writer.continuesStraightRun(
                runStart, runStart, segment(2L, 3L, 25, RouteMoveType.GATE), nodes)).isFalse();
    }

    /**
     * 역삼역 B1 은 개찰구 위 중간층이 별도 층이 아니다. 같은 {@code floorId} 안에
     * {@code map_z=7.5} 인 노드로 들어 있어, 층만 보면 바닥과 중간층을 한 구간으로 합친다.
     */
    @Test
    @DisplayName("높이가 다르면 같은 층이어도 합치지 않는다")
    void doesNotMergeAcrossHeight() {
        nodeAtHeight(1L, 1L, 0, 0, 0.0);
        nodeAtHeight(2L, 1L, 20, 0, 0.0);
        nodeAtHeight(3L, 1L, 45, 0, 7.5);     // 중간층

        Segment runStart = walkway(1L, 2L, 20);

        boolean merges = writer.continuesStraightRun(runStart, runStart, walkway(2L, 3L, 25), nodes);

        assertThat(merges).isFalse();
    }

    /** 모르는 것을 직진으로 취급하면 실제로 꺾이는 구간이 조용히 흡수된다. */
    @Test
    @DisplayName("방향을 판단할 수 없으면 합치지 않는다")
    void doesNotMergeWhenDirectionUnknown() {
        node(1L, 1L, 0, 0);
        node(2L, 1L, 20, 0);
        node(3L, 1L, 20.1, 0);    // 0.1m — 방향을 재기에 너무 짧다

        Segment runStart = walkway(1L, 2L, 20);

        boolean merges = writer.continuesStraightRun(runStart, runStart, walkway(2L, 3L, 1), nodes);

        assertThat(merges).isFalse();
    }

    /**
     * 거리 자리를 비운 문장을 함께 준다.
     *
     * <p>화면은 걷는 동안 남은 거리를 보여야 하는데 완성 문장에는 구간 전체 길이가 박혀 있다.
     * 한 안내가 여러 간선을 담게 되면서 그 차이가 커졌다 — 197m 구간을 절반 걸으면 실제로
     * 남은 것은 98m 다. 그래서 거리 자리만 비운 같은 문장을 함께 준다.
     *
     * <p><b>거리를 클라이언트가 앞에 붙일 수 없다.</b> 숫자 위치가 언어마다 다르다 — 한국어는
     * 앞이고 영어는 중간이다. 그 사실을 이 테스트가 붙잡는다. (S15P11A206-339)
     */
    @Test
    @DisplayName("완성 문장과 거리 자리를 비운 문장을 함께 준다")
    void writesTemplateAlongsideInstruction() {
        node(1L, 1L, 0, 0);
        node(2L, 1L, 10, 0);
        node(3L, 1L, 10, 12);

        RouteInstructionWriter.Guidance straight = guidance(null, walkway(1L, 2L, 10), Language.KO);
        assertThat(straight.instruction()).isEqualTo("10m 직진하세요.");
        assertThat(straight.instructionTemplate()).isEqualTo("{distance} 직진하세요.");

        RouteInstructionWriter.Guidance turn =
                guidance(walkway(1L, 2L, 10), walkway(2L, 3L, 12), Language.KO);
        assertThat(turn.instruction()).isEqualTo("오른쪽으로 돌아 12m 이동하세요.");
        assertThat(turn.instructionTemplate()).isEqualTo("오른쪽으로 돌아 {distance} 이동하세요.");

        // 영어는 거리가 문장 중간에 온다. 그래서 클라이언트가 숫자를 앞에 붙이는 방법을 쓸 수 없다.
        RouteInstructionWriter.Guidance english = guidance(null, walkway(1L, 2L, 10), Language.EN);
        assertThat(english.instruction()).isEqualTo("Go straight for 10m.");
        assertThat(english.instructionTemplate()).isEqualTo("Go straight for {distance}.");
    }

    /** 거리가 들어가지 않는 문장은 비울 자리가 없어 완성 문장과 같다. */
    @Test
    @DisplayName("거리가 없는 문장은 템플릿이 완성 문장과 같다")
    void templateEqualsInstructionWhenNoDistance() {
        node(1L, 1L, 0, 0);
        node(2L, 2L, 0, 0);
        floorOrders.put(1L, 2);
        floorOrders.put(2L, 1);

        RouteInstructionWriter.Guidance stair =
                guidance(null, segment(1L, 2L, 5, RouteMoveType.STAIR), Language.KO);
        assertThat(stair.instruction()).isEqualTo("계단으로 한 층 올라가세요.");
        assertThat(stair.instructionTemplate()).isEqualTo(stair.instruction());
        assertThat(stair.instructionTemplate()).doesNotContain("{distance}");

        RouteInstructionWriter.Guidance gate =
                guidance(null, segment(1L, 2L, 5, RouteMoveType.GATE), Language.KO);
        assertThat(gate.instructionTemplate()).isEqualTo(gate.instruction());
    }

    private String write(Segment previous, Segment current) {
        return write(previous, current, Language.KO);
    }

    private String write(Segment previous, Segment current, Language language) {
        return guidance(previous, current, language).instruction();
    }

    private RouteInstructionWriter.Guidance guidance(Segment previous, Segment current, Language language) {
        return writer.write(previous, current, nodes, floorOrders, language);
    }

    private Segment walkway(long fromNodeId, long toNodeId, long distanceM) {
        return segment(fromNodeId, toNodeId, distanceM, RouteMoveType.WALKWAY);
    }

    private Segment segment(long fromNodeId, long toNodeId, long distanceM, RouteMoveType moveType) {
        return new Segment(fromNodeId, toNodeId, BigDecimal.valueOf(distanceM), null, moveType);
    }

    private void node(long id, long floorId, double x, double y) {
        RouteNode node = RouteNode.create(1L, floorId, "normal", "노드" + id,
                BigDecimal.valueOf(x), BigDecimal.valueOf(y), null, false);
        ReflectionTestUtils.setField(node, "id", id);
        nodes.put(id, node);
    }

    /** 같은 층 안에서 높이가 갈리는 구간(역삼역 B1 중간층)을 세울 때 쓴다. */
    private void nodeAtHeight(long id, long floorId, double x, double y, double z) {
        RouteNode node = RouteNode.create(1L, floorId, "normal", "노드" + id,
                BigDecimal.valueOf(x), BigDecimal.valueOf(y), BigDecimal.valueOf(z), false);
        ReflectionTestUtils.setField(node, "id", id);
        nodes.put(id, node);
    }
}

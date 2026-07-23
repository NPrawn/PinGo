package com.pingo.backend.route.service;

import com.pingo.backend.route.domain.RouteMoveType;
import com.pingo.backend.route.domain.RouteType;
import com.pingo.backend.route.service.RouteFinder.GraphEdge;
import com.pingo.backend.route.service.RouteFinder.RoutePath;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

class RouteFinderTest {

    private final RouteFinder routeFinder = new RouteFinder();

    @Test
    @DisplayName("여러 경로 중 거리가 가장 짧은 경로를 선택한다")
    void selectsShortestDistancePath() {
        List<GraphEdge> edges = List.of(
                edge(1, 2, 30, RouteMoveType.WALKWAY, true),
                edge(1, 3, 10, RouteMoveType.WALKWAY, true),
                edge(3, 2, 10, RouteMoveType.WALKWAY, true)
        );

        RoutePath path = routeFinder.find(edges, 1, 2, RouteType.FASTEST);

        assertThat(path.isReachable()).isTrue();
        assertThat(path.nodeIds()).containsExactly(1L, 3L, 2L);
        assertThat(path.totalDistanceM()).isEqualByComparingTo(BigDecimal.valueOf(20));
    }

    @Test
    @DisplayName("경로의 구간을 출발부터 도착 순서로 복원한다")
    void reconstructsSegmentsInOrder() {
        List<GraphEdge> edges = List.of(
                edge(1, 2, 10, RouteMoveType.WALKWAY, true),
                edge(2, 3, 10, RouteMoveType.WALKWAY, true)
        );

        RoutePath path = routeFinder.find(edges, 1, 3, RouteType.FASTEST);

        assertThat(path.segments())
                .extracting(RouteFinder.Segment::fromNodeId, RouteFinder.Segment::toNodeId)
                .containsExactly(
                        tuple(1L, 2L),
                        tuple(2L, 3L)
                );
    }

    @Test
    @DisplayName("양방향 간선은 역방향으로도 이동할 수 있다")
    void bidirectionalEdgeAllowsReverse() {
        List<GraphEdge> edges = List.of(edge(1, 2, 10, RouteMoveType.WALKWAY, true));

        RoutePath path = routeFinder.find(edges, 2, 1, RouteType.FASTEST);

        assertThat(path.isReachable()).isTrue();
        assertThat(path.nodeIds()).containsExactly(2L, 1L);
    }

    @Test
    @DisplayName("단방향 간선은 역방향으로 이동할 수 없다")
    void unidirectionalEdgeBlocksReverse() {
        List<GraphEdge> edges = List.of(edge(1, 2, 10, RouteMoveType.WALKWAY, false));

        RoutePath path = routeFinder.find(edges, 2, 1, RouteType.FASTEST);

        assertThat(path.isReachable()).isFalse();
    }

    @Test
    @DisplayName("도착 노드에 도달할 수 없으면 빈 경로를 반환한다")
    void returnsEmptyPathWhenUnreachable() {
        List<GraphEdge> edges = List.of(edge(1, 2, 10, RouteMoveType.WALKWAY, true));

        RoutePath path = routeFinder.find(edges, 1, 99, RouteType.FASTEST);

        assertThat(path.isReachable()).isFalse();
        assertThat(path.nodeIds()).isEmpty();
        assertThat(path.totalDistanceM()).isNull();
        assertThat(path.totalTimeSec()).isNull();
    }

    @Test
    @DisplayName("fastest는 계단 경로를, elevator_only는 계단을 제외한 우회 경로를 선택한다")
    void fastestUsesStairsElevatorOnlyDetours() {
        List<GraphEdge> edges = List.of(
                edge(1, 2, 10, RouteMoveType.WALKWAY, true),
                edge(2, 4, 5, RouteMoveType.STAIR, true),        // 짧지만 계단
                edge(2, 3, 10, RouteMoveType.WALKWAY, true),
                edge(3, 4, 10, RouteMoveType.ELEVATOR, true)     // 길지만 엘리베이터
        );

        RoutePath fastest = routeFinder.find(edges, 1, 4, RouteType.FASTEST);
        RoutePath elevatorOnly = routeFinder.find(edges, 1, 4, RouteType.ELEVATOR_ONLY);

        assertThat(fastest.nodeIds()).containsExactly(1L, 2L, 4L);
        assertThat(fastest.totalDistanceM()).isEqualByComparingTo(BigDecimal.valueOf(15));

        assertThat(elevatorOnly.nodeIds()).containsExactly(1L, 2L, 3L, 4L);
        assertThat(elevatorOnly.totalDistanceM()).isEqualByComparingTo(BigDecimal.valueOf(30));
    }

    @Test
    @DisplayName("elevator_only는 계단만 있는 경로에서는 도달할 수 없다")
    void elevatorOnlyUnreachableWhenOnlyStairs() {
        List<GraphEdge> edges = List.of(edge(1, 2, 10, RouteMoveType.STAIR, true));

        assertThat(routeFinder.find(edges, 1, 2, RouteType.FASTEST).isReachable()).isTrue();
        assertThat(routeFinder.find(edges, 1, 2, RouteType.ELEVATOR_ONLY).isReachable()).isFalse();
    }

    @Test
    @DisplayName("경로상 모든 간선에 예상 시간이 있으면 총 시간을 누적한다")
    void accumulatesTotalTimeWhenAllEdgesHaveTime() {
        List<GraphEdge> edges = List.of(
                timedEdge(1, 2, 10, 30, RouteMoveType.WALKWAY, true),
                timedEdge(2, 3, 10, 40, RouteMoveType.WALKWAY, true)
        );

        RoutePath path = routeFinder.find(edges, 1, 3, RouteType.FASTEST);

        assertThat(path.totalTimeSec()).isEqualTo(70);
    }

    @Test
    @DisplayName("경로상 간선 중 하나라도 예상 시간이 없으면 총 시간은 null이다")
    void totalTimeIsNullWhenAnyEdgeMissesTime() {
        List<GraphEdge> edges = List.of(
                timedEdge(1, 2, 10, 30, RouteMoveType.WALKWAY, true),
                edge(2, 3, 10, RouteMoveType.WALKWAY, true) // 시간 없음
        );

        RoutePath path = routeFinder.find(edges, 1, 3, RouteType.FASTEST);

        assertThat(path.isReachable()).isTrue();
        assertThat(path.totalTimeSec()).isNull();
    }

    @Test
    @DisplayName("출발지와 도착지가 같으면 거리 0인 단일 노드 경로를 반환한다")
    void sameStartAndTargetReturnsZeroDistancePath() {
        List<GraphEdge> edges = List.of(edge(1, 2, 10, RouteMoveType.WALKWAY, true));

        RoutePath path = routeFinder.find(edges, 1, 1, RouteType.FASTEST);

        assertThat(path.isReachable()).isTrue();
        assertThat(path.nodeIds()).containsExactly(1L);
        assertThat(path.segments()).isEmpty();
        assertThat(path.totalDistanceM()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(path.totalTimeSec()).isEqualTo(0);
    }

    private GraphEdge edge(long from, long to, long distanceM, RouteMoveType moveType, boolean bidirectional) {
        return new GraphEdge(from, to, BigDecimal.valueOf(distanceM), null, moveType, bidirectional);
    }

    private GraphEdge timedEdge(long from, long to, long distanceM, Integer timeSec, RouteMoveType moveType, boolean bidirectional) {
        return new GraphEdge(from, to, BigDecimal.valueOf(distanceM), timeSec, moveType, bidirectional);
    }
}

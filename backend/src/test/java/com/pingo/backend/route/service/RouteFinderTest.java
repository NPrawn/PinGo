package com.pingo.backend.route.service;

import com.pingo.backend.route.domain.RouteMoveType;
import com.pingo.backend.route.domain.RouteType;
import com.pingo.backend.route.service.RouteFinder.GraphEdge;
import com.pingo.backend.route.service.RouteFinder.InboundSearch;
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

    @Test
    @DisplayName("역방향 탐색은 모든 노드에서 목적지까지의 거리를 한 번에 구한다")
    void searchInboundCollectsDistancesToDestination() {
        List<GraphEdge> edges = List.of(
                edge(1, 2, 10, RouteMoveType.WALKWAY, true),
                edge(2, 3, 20, RouteMoveType.WALKWAY, true)
        );

        InboundSearch search = routeFinder.searchInbound(edges, 3, RouteType.FASTEST);

        assertThat(search.distanceFrom(1L)).isEqualByComparingTo(BigDecimal.valueOf(30));
        assertThat(search.distanceFrom(2L)).isEqualByComparingTo(BigDecimal.valueOf(20));
        assertThat(search.distanceFrom(3L)).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    @DisplayName("역방향 탐색이 돌려준 경로는 진행 방향이 그대로다")
    void searchInboundPathRunsForward() {
        List<GraphEdge> edges = List.of(
                timedEdge(1, 2, 10, 15, RouteMoveType.WALKWAY, true),
                timedEdge(2, 3, 20, 30, RouteMoveType.WALKWAY, true)
        );

        RoutePath path = routeFinder.searchInbound(edges, 3, RouteType.FASTEST).pathFrom(1L);

        assertThat(path.nodeIds()).containsExactly(1L, 2L, 3L);
        assertThat(path.segments())
                .extracting(RouteFinder.Segment::fromNodeId, RouteFinder.Segment::toNodeId)
                .containsExactly(tuple(1L, 2L), tuple(2L, 3L));
        assertThat(path.totalDistanceM()).isEqualByComparingTo(BigDecimal.valueOf(30));
        assertThat(path.totalTimeSec()).isEqualTo(45);
    }

    /**
     * 정방향으로 돌고 경로를 뒤집으면 단방향 간선을 거꾸로 걷는 경로가 나온다. 역방향
     * 그래프에서 돌아야 그런 경로가 애초에 만들어지지 않는다.
     */
    @Test
    @DisplayName("단방향 간선을 거꾸로 걷는 경로를 만들지 않는다")
    void searchInboundRespectsOneWayEdges() {
        List<GraphEdge> edges = List.of(
                // 1 -> 2 로만 갈 수 있다. 2 에서 1 로는 못 간다.
                edge(1, 2, 10, RouteMoveType.WALKWAY, false),
                edge(3, 2, 5, RouteMoveType.WALKWAY, true)
        );

        InboundSearch toOne = routeFinder.searchInbound(edges, 1, RouteType.FASTEST);
        InboundSearch toTwo = routeFinder.searchInbound(edges, 2, RouteType.FASTEST);

        // 2 에서 1 로 가는 길은 없다
        assertThat(toOne.reaches(2L)).isFalse();
        assertThat(toOne.pathFrom(2L).isReachable()).isFalse();
        // 1 에서 2 로는 갈 수 있다
        assertThat(toTwo.reaches(1L)).isTrue();
        assertThat(toTwo.pathFrom(1L).segments())
                .extracting(RouteFinder.Segment::fromNodeId, RouteFinder.Segment::toNodeId)
                .containsExactly(tuple(1L, 2L));
    }

    @Test
    @DisplayName("경로 유형이 막은 간선으로만 닿는 노드는 결과에 없다")
    void searchInboundExcludesFilteredEdges() {
        List<GraphEdge> edges = List.of(
                edge(1, 2, 10, RouteMoveType.STAIR, true),
                edge(3, 2, 10, RouteMoveType.WALKWAY, true)
        );

        InboundSearch search = routeFinder.searchInbound(edges, 2, RouteType.ELEVATOR_ONLY);

        assertThat(search.reaches(1L)).isFalse();
        assertThat(search.reaches(3L)).isTrue();
    }

    private GraphEdge edge(long from, long to, long distanceM, RouteMoveType moveType, boolean bidirectional) {
        return new GraphEdge(from, to, BigDecimal.valueOf(distanceM), null, moveType, bidirectional);
    }

    private GraphEdge timedEdge(long from, long to, long distanceM, Integer timeSec, RouteMoveType moveType, boolean bidirectional) {
        return new GraphEdge(from, to, BigDecimal.valueOf(distanceM), timeSec, moveType, bidirectional);
    }
}

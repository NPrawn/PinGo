package com.pingo.backend.route.service;

import com.pingo.backend.route.domain.RouteMoveType;
import com.pingo.backend.route.domain.RouteType;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Deque;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.PriorityQueue;
import java.util.Set;

/**
 * 실내 경로 탐색 엔진. DB·Spring 컨텍스트와 무관한 순수 로직으로, 더미 그래프만으로 단위 테스트할 수 있다.
 *
 * <p>가중치는 간선 거리(distance_m)를 사용한다. "fastest"는 시간이 아니라 <b>최단 거리</b> 기준이다.
 * 경로 옵션은 {@link RouteType#allows(RouteMoveType)} 로 간선을 필터링하여 표현하며,
 * elevator_only 처럼 특정 이동 수단이 제외된 조건에서 도착지에 도달할 수 없으면 빈 경로를 반환한다.
 */
@Component
public class RouteFinder {

    /**
     * 그래프 간선 입력. 서비스가 RouteEdge 엔티티에서 변환하여 넘긴다.
     * bidirectional 이면 역방향 이동도 가능한 것으로 전개한다.
     */
    public record GraphEdge(
            long fromNodeId,
            long toNodeId,
            BigDecimal distanceM,
            Integer estimatedTimeSec,
            RouteMoveType moveType,
            boolean bidirectional
    ) {
    }

    /**
     * 경로가 지나는 한 구간(방향이 적용된 간선).
     */
    public record Segment(
            long fromNodeId,
            long toNodeId,
            BigDecimal distanceM,
            Integer estimatedTimeSec,
            RouteMoveType moveType
    ) {
    }

    /** 간선 목록으로 그래프를 만든다. <b>요청마다 새로 만든다.</b> {@link RouteGraph} 참고. */
    public static RouteGraph graphOf(List<GraphEdge> edges) {
        return new RouteGraph(edges);
    }

    /**
     * 한 요청 동안 재사용하는 탐색용 그래프.
     *
     * <p><b>왜 있는가.</b> 인접 목록은 간선 목록에서만 나오는데, 예전에는 탐색 메서드마다 그것을
     * 새로 만들었다. 옵션 조회는 경로 유형 2개를 돌면서 유형마다 역방향 탐색·후보 탐색·구간
     * 탐색을 하므로 같은 간선으로 같은 인접 목록을 요청당 네 번 만들었다. 역삼역 간선 205개가
     * 전부 양방향이라 한 번 만들 때 {@link Segment} 가 410개 생긴다.
     *
     * <p>그래서 <b>처음 쓸 때 만들고 그 뒤로는 재사용</b>한다. 경로 유형별로 간선 필터가 다르고
     * 정방향·역방향이 다르므로 (유형 × 방향) 으로 따로 담는다. 미리 다 만들지 않는 이유는 한
     * 요청이 넷을 다 쓰지 않기 때문이다 — 좌표가 없는 옵션 조회는 유형마다 정방향 하나만 쓴다.
     *
     * <p><b>요청 범위를 넘겨 쓰면 안 된다.</b> 관리자 API 로 노드·간선이 런타임에 바뀐다
     * ({@code AdminRouteNodeController}·{@code AdminRouteEdgeController}). {@code stationId} 로
     * 캐시를 잡아 두면 간선을 고친 뒤에도 낡은 인접 목록으로 경로가 나간다. 이 객체는 요청마다
     * {@code loadGraph} 가 새로 만들므로 무효화할 것이 없다. 같은 이유로 <b>스레드 안전하지
     * 않다</b> — 한 요청 안에서만 쓴다. (S15P11A206-338)
     */
    public static final class RouteGraph {

        private final List<GraphEdge> edges;
        private final Map<RouteType, Map<Long, List<Segment>>> forward = new EnumMap<>(RouteType.class);
        private final Map<RouteType, Map<Long, List<Segment>>> inbound = new EnumMap<>(RouteType.class);

        private RouteGraph(List<GraphEdge> edges) {
            this.edges = edges;
        }

        /** 노드에서 나가는 구간. */
        private Map<Long, List<Segment>> forward(RouteType routeType) {
            return forward.computeIfAbsent(routeType, this::buildForward);
        }

        /**
         * 노드로 들어오는 구간.
         *
         * <p>담기는 구간 자체는 뒤집지 않는다. {@code from -> to} 를 키 {@code to} 아래 그대로
         * 둔다. 그래야 경로를 되짚을 때 나오는 구간이 곧 진행 방향이다.
         */
        private Map<Long, List<Segment>> inbound(RouteType routeType) {
            return inbound.computeIfAbsent(routeType, type -> {
                Map<Long, List<Segment>> reversed = new HashMap<>();
                for (List<Segment> segments : forward(type).values()) {
                    for (Segment segment : segments) {
                        reversed.computeIfAbsent(segment.toNodeId(), key -> new ArrayList<>()).add(segment);
                    }
                }
                return reversed;
            });
        }

        private Map<Long, List<Segment>> buildForward(RouteType routeType) {
            Map<Long, List<Segment>> adjacency = new HashMap<>();
            for (GraphEdge edge : edges) {
                if (!allows(routeType, edge.moveType())) {
                    continue;
                }
                adjacency.computeIfAbsent(edge.fromNodeId(), key -> new ArrayList<>())
                        .add(new Segment(edge.fromNodeId(), edge.toNodeId(), edge.distanceM(),
                                edge.estimatedTimeSec(), edge.moveType()));
                if (edge.bidirectional()) {
                    adjacency.computeIfAbsent(edge.toNodeId(), key -> new ArrayList<>())
                            .add(new Segment(edge.toNodeId(), edge.fromNodeId(), edge.distanceM(),
                                    edge.estimatedTimeSec(), edge.moveType()));
                }
            }
            return adjacency;
        }

        private boolean allows(RouteType routeType, RouteMoveType moveType) {
            return moveType == null || routeType.allows(moveType);
        }
    }

    /**
     * 탐색 결과. 도달 불가 시 nodeIds·segments 는 빈 목록이고 총거리·총시간은 null 이다.
     * 총시간은 경로상 간선 중 하나라도 estimatedTimeSec 이 비어 있으면 null 이다.
     */
    public record RoutePath(
            List<Long> nodeIds,
            List<Segment> segments,
            BigDecimal totalDistanceM,
            Integer totalTimeSec
    ) {
        public boolean isReachable() {
            return !nodeIds.isEmpty();
        }

        static RoutePath unreachable() {
            return new RoutePath(List.of(), List.of(), null, null);
        }
    }

    /**
     * 출발 노드에서 도착 노드까지 주어진 경로 옵션 조건으로 최단(거리) 경로를 찾는다.
     *
     * @param graph        요청 범위 그래프({@link #graphOf})
     * @param startNodeId  출발 노드
     * @param targetNodeId 도착 노드
     * @param routeType    경로 옵션(간선 필터 기준)
     * @return 탐색 결과. 도달 불가 시 {@link RoutePath#isReachable()} 가 false.
     */
    public RoutePath find(RouteGraph graph, long startNodeId, long targetNodeId, RouteType routeType) {
        Map<Long, List<Segment>> adjacency = graph.forward(routeType);

        Map<Long, BigDecimal> distance = new HashMap<>();
        Map<Long, Segment> arrivedBy = new HashMap<>();
        Set<Long> settled = new HashSet<>();
        PriorityQueue<QueueEntry> queue = new PriorityQueue<>(Comparator.comparing(QueueEntry::distance));

        distance.put(startNodeId, BigDecimal.ZERO);
        queue.add(new QueueEntry(startNodeId, BigDecimal.ZERO));

        while (!queue.isEmpty()) {
            QueueEntry current = queue.poll();
            long node = current.nodeId();
            if (!settled.add(node)) {
                continue;
            }
            if (node == targetNodeId) {
                break;
            }
            BigDecimal currentDistance = distance.get(node);
            for (Segment segment : adjacency.getOrDefault(node, List.of())) {
                long next = segment.toNodeId();
                if (settled.contains(next)) {
                    continue;
                }
                BigDecimal candidate = currentDistance.add(segment.distanceM());
                BigDecimal known = distance.get(next);
                if (known == null || candidate.compareTo(known) < 0) {
                    distance.put(next, candidate);
                    arrivedBy.put(next, segment);
                    queue.add(new QueueEntry(next, candidate));
                }
            }
        }

        if (!distance.containsKey(targetNodeId)) {
            return RoutePath.unreachable();
        }
        return reconstruct(startNodeId, targetNodeId, distance, arrivedBy);
    }

    /**
     * 모든 노드에서 한 노드까지의 최단 경로를 한 번에 구한 결과.
     *
     * <p>진입 노드를 고르려면 후보마다 목적지까지의 거리가 필요하다. 후보마다 탐색하면 노드
     * 수만큼 돌아야 하므로, 목적지에서 <b>역방향 그래프</b>로 한 번 돌아 전부 얻는다.
     *
     * <p><b>경로까지 담는다.</b> 고른 진입 노드에서 목적지까지의 경로가 이 안에 이미 들어 있어
     * 다시 탐색할 필요가 없다. 그러지 않으면 경로 유형마다 다익스트라를 두 번 돌게 된다.
     */
    public record InboundSearch(
            long destinationNodeId,
            Map<Long, BigDecimal> distance,
            /** 노드에서 목적지 쪽으로 나가는 첫 구간. 방향이 이미 진행 방향이다. */
            Map<Long, Segment> departsBy
    ) {

        public boolean reaches(long nodeId) {
            return distance.containsKey(nodeId);
        }

        /** 목적지까지의 거리. 닿지 못하면 {@code null}. */
        public BigDecimal distanceFrom(long nodeId) {
            return distance.get(nodeId);
        }

        /** 그 노드에서 목적지까지의 경로. 닿지 못하면 도달 불가. */
        public RoutePath pathFrom(long nodeId) {
            if (!reaches(nodeId)) {
                return RoutePath.unreachable();
            }

            List<Long> nodeIds = new ArrayList<>();
            List<Segment> segments = new ArrayList<>();
            long cursor = nodeId;
            nodeIds.add(cursor);
            while (cursor != destinationNodeId) {
                Segment segment = departsBy.get(cursor);
                segments.add(segment);
                cursor = segment.toNodeId();
                nodeIds.add(cursor);
            }

            Integer totalTimeSec = 0;
            for (Segment segment : segments) {
                if (segment.estimatedTimeSec() == null) {
                    totalTimeSec = null;
                    break;
                }
                totalTimeSec += segment.estimatedTimeSec();
            }

            return new RoutePath(nodeIds, segments, distance.get(nodeId), totalTimeSec);
        }
    }

    /**
     * 목적지에서 역방향으로 훑어 모든 노드의 최단 경로와 거리를 구한다.
     *
     * <p><b>역방향 그래프에서 돈다.</b> 정방향으로 돌고 경로를 뒤집으면 단방향 간선을 거꾸로
     * 걷는 경로가 나온다. 역삼역 간선 205개는 모두 양방향이라 지금은 드러나지 않지만 모델은
     * 단방향을 허용한다. 역방향 그래프에서 얻은 구간은 그대로 진행 방향이라 뒤집을 일이 없다.
     *
     * <p>{@link #find} 와 달리 도착에서 멈추지 않고 큐가 빌 때까지 돈다. 닿지 못하는 노드는
     * 결과에 없다. 그래서 {@code elevator_only} 로 못 가는 노드는 자연히 후보에서 빠진다.
     */
    public InboundSearch searchInbound(RouteGraph graph, long destinationNodeId, RouteType routeType) {
        Map<Long, List<Segment>> inbound = graph.inbound(routeType);

        Map<Long, BigDecimal> distance = new HashMap<>();
        Map<Long, Segment> departsBy = new HashMap<>();
        Set<Long> settled = new HashSet<>();
        PriorityQueue<QueueEntry> queue = new PriorityQueue<>(Comparator.comparing(QueueEntry::distance));

        distance.put(destinationNodeId, BigDecimal.ZERO);
        queue.add(new QueueEntry(destinationNodeId, BigDecimal.ZERO));

        while (!queue.isEmpty()) {
            QueueEntry current = queue.poll();
            long node = current.nodeId();
            if (!settled.add(node)) {
                continue;
            }

            BigDecimal currentDistance = distance.get(node);
            for (Segment segment : inbound.getOrDefault(node, List.of())) {
                // 이 구간은 previous -> node 로 흐른다. 목적지 쪽으로 한 칸 더 먼 노드가 previous 다.
                long previous = segment.fromNodeId();
                if (settled.contains(previous)) {
                    continue;
                }

                BigDecimal candidate = currentDistance.add(segment.distanceM());
                BigDecimal known = distance.get(previous);
                if (known == null || candidate.compareTo(known) < 0) {
                    distance.put(previous, candidate);
                    departsBy.put(previous, segment);
                    queue.add(new QueueEntry(previous, candidate));
                }
            }
        }

        return new InboundSearch(destinationNodeId, distance, departsBy);
    }

    /**
     * 주어진 노드 집합 안에서만 움직여 {@code startNodeId} 에서 걸어 닿는 노드.
     *
     * <p>진입 노드 후보를 <b>실제로 걸어갈 수 있는 곳</b>으로 좁히는 데 쓴다. {@link #searchInbound}
     * 의 도달성은 목적지 기준이고 층을 가리지 않는다. 그래서 역 그래프가 하나로 이어져 있으면
     * 어느 노드든 통과한다 — 역삼역 B3 두 승강장은 그 층 간선만으로는 서로 이어지지 않는데도
     * B2 를 경유해 이어지는 것으로 계산돼, 선로 건너편 노드가 후보에 남았다.
     *
     * <p>거리는 재지 않는다. 후보를 고르는 비용식이 따로 있고, 여기서 필요한 것은 "걸어갈 수
     * 있는가" 뿐이라 너비 우선으로 훑는다.
     *
     * <p>{@code startNodeId} 는 집합에 없어도 결과에 들어간다. 요청에 온 진입 노드를 후보에서
     * 떨어뜨리지 않기 위해서다.
     */
    public Set<Long> reachableWithin(
            RouteGraph graph,
            long startNodeId,
            Set<Long> allowedNodeIds,
            RouteType routeType
    ) {
        Map<Long, List<Segment>> adjacency = graph.forward(routeType);

        Set<Long> reached = new HashSet<>();
        reached.add(startNodeId);
        Deque<Long> queue = new ArrayDeque<>();
        queue.add(startNodeId);

        while (!queue.isEmpty()) {
            long node = queue.poll();
            for (Segment segment : adjacency.getOrDefault(node, List.of())) {
                long next = segment.toNodeId();
                if (!allowedNodeIds.contains(next) || !reached.add(next)) {
                    continue;
                }
                queue.add(next);
            }
        }

        return reached;
    }

    private RoutePath reconstruct(
            long startNodeId,
            long targetNodeId,
            Map<Long, BigDecimal> distance,
            Map<Long, Segment> arrivedBy
    ) {
        LinkedList<Long> nodeIds = new LinkedList<>();
        LinkedList<Segment> segments = new LinkedList<>();
        long cursor = targetNodeId;
        nodeIds.addFirst(cursor);
        while (cursor != startNodeId) {
            Segment segment = arrivedBy.get(cursor);
            segments.addFirst(segment);
            cursor = segment.fromNodeId();
            nodeIds.addFirst(cursor);
        }

        Integer totalTimeSec = 0;
        for (Segment segment : segments) {
            if (segment.estimatedTimeSec() == null) {
                totalTimeSec = null;
                break;
            }
            totalTimeSec += segment.estimatedTimeSec();
        }

        return new RoutePath(nodeIds, segments, distance.get(targetNodeId), totalTimeSec);
    }

    private record QueueEntry(long nodeId, BigDecimal distance) {
    }
}

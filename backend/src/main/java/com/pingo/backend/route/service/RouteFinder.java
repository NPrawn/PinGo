package com.pingo.backend.route.service;

import com.pingo.backend.route.domain.RouteMoveType;
import com.pingo.backend.route.domain.RouteType;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
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
     * @param edges        역의 활성 간선 목록
     * @param startNodeId  출발 노드
     * @param targetNodeId 도착 노드
     * @param routeType    경로 옵션(간선 필터 기준)
     * @return 탐색 결과. 도달 불가 시 {@link RoutePath#isReachable()} 가 false.
     */
    public RoutePath find(List<GraphEdge> edges, long startNodeId, long targetNodeId, RouteType routeType) {
        Map<Long, List<Segment>> adjacency = buildAdjacency(edges, routeType);

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
    public InboundSearch searchInbound(List<GraphEdge> edges, long destinationNodeId, RouteType routeType) {
        Map<Long, List<Segment>> inbound = buildInboundAdjacency(edges, routeType);

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
     * 도착 노드에서 그리로 들어오는 구간을 찾을 수 있게 뒤집어 담은 인접 목록.
     *
     * <p>담기는 구간 자체는 뒤집지 않는다. {@code from -> to} 를 키 {@code to} 아래 그대로
     * 둔다. 그래야 경로를 되짚을 때 나오는 구간이 곧 진행 방향이다.
     */
    private Map<Long, List<Segment>> buildInboundAdjacency(List<GraphEdge> edges, RouteType routeType) {
        Map<Long, List<Segment>> inbound = new HashMap<>();
        for (Map.Entry<Long, List<Segment>> entry : buildAdjacency(edges, routeType).entrySet()) {
            for (Segment segment : entry.getValue()) {
                inbound.computeIfAbsent(segment.toNodeId(), key -> new ArrayList<>()).add(segment);
            }
        }
        return inbound;
    }

    private Map<Long, List<Segment>> buildAdjacency(List<GraphEdge> edges, RouteType routeType) {
        Map<Long, List<Segment>> adjacency = new HashMap<>();
        for (GraphEdge edge : edges) {
            if (!allows(routeType, edge.moveType())) {
                continue;
            }
            adjacency.computeIfAbsent(edge.fromNodeId(), key -> new ArrayList<>())
                    .add(new Segment(edge.fromNodeId(), edge.toNodeId(), edge.distanceM(), edge.estimatedTimeSec(), edge.moveType()));
            if (edge.bidirectional()) {
                adjacency.computeIfAbsent(edge.toNodeId(), key -> new ArrayList<>())
                        .add(new Segment(edge.toNodeId(), edge.fromNodeId(), edge.distanceM(), edge.estimatedTimeSec(), edge.moveType()));
            }
        }
        return adjacency;
    }

    private boolean allows(RouteType routeType, RouteMoveType moveType) {
        return moveType == null || routeType.allows(moveType);
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

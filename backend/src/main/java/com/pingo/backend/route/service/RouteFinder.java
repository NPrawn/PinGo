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

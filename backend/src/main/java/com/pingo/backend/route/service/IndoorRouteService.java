package com.pingo.backend.route.service;

import com.pingo.backend.global.exception.BusinessException;
import com.pingo.backend.global.exception.ErrorCode;
import com.pingo.backend.route.domain.RouteMoveType;
import com.pingo.backend.route.domain.RouteNode;
import com.pingo.backend.route.domain.RouteType;
import com.pingo.backend.route.domain.RouteUnavailableReason;
import com.pingo.backend.route.dto.request.RouteCreateRequest;
import com.pingo.backend.route.dto.request.RouteOptionsRequest;
import com.pingo.backend.route.dto.response.RouteOptionResponse;
import com.pingo.backend.route.dto.response.RoutePathNode;
import com.pingo.backend.route.dto.response.RouteResponse;
import com.pingo.backend.route.dto.response.RouteStep;
import com.pingo.backend.route.repository.RouteEdgeRepository;
import com.pingo.backend.route.repository.RouteNodeRepository;
import com.pingo.backend.route.service.RouteFinder.GraphEdge;
import com.pingo.backend.route.service.RouteFinder.RoutePath;
import com.pingo.backend.route.service.RouteFinder.Segment;
import com.pingo.backend.station.repository.StationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 실내 경로 탐색 서비스. 역 노드·간선을 로드해 그래프로 변환하고 {@link RouteFinder} 로 경로를 탐색한다.
 * 도착지는 실내 노드 ID 로 직접 지정하며, 외부 목적지·출구 추천은 이 서비스 범위 밖이다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class IndoorRouteService {

    private final RouteNodeRepository routeNodeRepository;
    private final RouteEdgeRepository routeEdgeRepository;
    private final StationRepository stationRepository;
    private final RouteFinder routeFinder;

    /**
     * 출발 노드에서 도착 노드까지의 경로 옵션(빠른 경로·엘리베이터 이용 경로)을 요약으로 조회한다.
     */
    public List<RouteOptionResponse> getRouteOptions(RouteOptionsRequest request) {
        List<Long> requested = stopNodeIds(request.startNodeId(), request.waypointNodeIds(), request.targetNodeId());
        RouteGraphData data = loadGraph(request.stationId(), requested);

        List<RouteOptionResponse> options = new ArrayList<>();
        for (RouteType routeType : RouteType.values()) {
            List<Long> stopNodeIds = withChosenEntry(
                    requested, data, routeType, request.currentMapX(), request.currentMapY());
            RoutePath path = findThroughStops(data.edges(), stopNodeIds, routeType);
            if (path.isReachable()) {
                options.add(RouteOptionResponse.available(
                        routeType, path.totalDistanceM(), path.totalTimeSec(), hasStairsOrEscalator(path)));
            } else {
                options.add(RouteOptionResponse.unavailable(routeType, reasonFor(routeType), request.language()));
            }
        }
        return options;
    }

    /**
     * 선택한 경로 옵션의 상세 경로(steps·pathNodes 포함)를 생성한다.
     */
    public RouteResponse createRoute(RouteCreateRequest request) {
        RouteType routeType = RouteType.fromCode(request.routeType())
                .orElseThrow(() -> new BusinessException(ErrorCode.UNSUPPORTED_ROUTE_TYPE));

        List<Long> requested = stopNodeIds(request.startNodeId(), request.waypointNodeIds(), request.targetNodeId());
        RouteGraphData data = loadGraph(request.stationId(), requested);
        List<Long> stopNodeIds = withChosenEntry(
                requested, data, routeType, request.currentMapX(), request.currentMapY());
        RoutePath path = findThroughStops(data.edges(), stopNodeIds, routeType);

        if (!path.isReachable()) {
            return RouteResponse.unavailable(
                    routeType, request.startNodeId(), request.targetNodeId(),
                    reasonFor(routeType), request.language());
        }

        List<RouteStep> steps = toSteps(path.segments());
        List<RoutePathNode> pathNodes = toPathNodes(path.nodeIds(), data.nodes());
        return RouteResponse.available(
                routeType,
                stopNodeIds.get(0),
                request.targetNodeId(),
                path.totalDistanceM(),
                path.totalTimeSec(),
                steps,
                pathNodes
        );
    }

    private List<Long> stopNodeIds(Long startNodeId, List<Long> waypointNodeIds, Long targetNodeId) {
        List<Long> stopNodeIds = new ArrayList<>();
        stopNodeIds.add(startNodeId);
        stopNodeIds.addAll(waypointNodeIds);
        stopNodeIds.add(targetNodeId);
        return stopNodeIds;
    }

    private RoutePath findThroughStops(List<GraphEdge> edges, List<Long> stopNodeIds, RouteType routeType) {
        List<Long> nodeIds = new ArrayList<>();
        List<Segment> segments = new ArrayList<>();
        BigDecimal totalDistanceM = BigDecimal.ZERO;
        Integer totalTimeSec = 0;

        for (int i = 0; i < stopNodeIds.size() - 1; i++) {
            RoutePath path = routeFinder.find(edges, stopNodeIds.get(i), stopNodeIds.get(i + 1), routeType);
            if (!path.isReachable()) {
                return RoutePath.unreachable();
            }

            if (nodeIds.isEmpty()) {
                nodeIds.addAll(path.nodeIds());
            } else if (path.nodeIds().size() > 1) {
                nodeIds.addAll(path.nodeIds().subList(1, path.nodeIds().size()));
            }
            segments.addAll(path.segments());
            totalDistanceM = totalDistanceM.add(path.totalDistanceM());
            if (totalTimeSec != null) {
                totalTimeSec = path.totalTimeSec() == null ? null : totalTimeSec + path.totalTimeSec();
            }
        }

        return new RoutePath(nodeIds, segments, totalDistanceM, totalTimeSec);
    }

    private RouteGraphData loadGraph(Long stationId, List<Long> nodeIdsToValidate) {
        validateStationActive(stationId);

        Map<Long, RouteNode> nodes = routeNodeRepository.search(stationId, null).stream()
                .collect(Collectors.toMap(RouteNode::getId, Function.identity()));
        nodeIdsToValidate.forEach(nodeId -> requireNodeInStation(nodes, nodeId));

        List<GraphEdge> edges = routeEdgeRepository.findAllByStationIdAndActiveTrueOrderByIdAsc(stationId).stream()
                .map(edge -> new GraphEdge(
                        edge.getFromNodeId(),
                        edge.getToNodeId(),
                        edge.getDistanceM(),
                        edge.getEstimatedTimeSec(),
                        RouteMoveType.fromCode(edge.getMoveType()).orElse(null),
                        edge.isBidirectional()
                ))
                .toList();

        return new RouteGraphData(nodes, edges);
    }

    /**
     * 사용자의 실제 좌표를 알면 진입 노드를 다시 고른다.
     *
     * <p>진입 노드는 위치 인식 시점에 정해지는데, 그때는 목적지를 모르므로 거리만 보고 가장
     * 가까운 노드를 고른다({@code IndoorPositionResolver}). 그래서 목적지 반대쪽 노드가 뽑히면
     * 사용자를 뒤로 걷게 만든다. 역삼역 B3 에서 3번 출구로 갈 때 실제로 그랬다.
     *
     * <pre>
     *   현재 위치 (-34.90, 23.33)
     *   가장 가까운 노드 203  6.2m (목적지 반대쪽)  →  6.2 + 140.53 = 146.7m
     *   계단 6 노드     234  9.9m (목적지 쪽)      →  9.9 + 124.53 = 134.4m
     * </pre>
     *
     * <p>목적지에서 한 번 다익스트라를 돌려 모든 노드까지의 거리를 구하고, 거기에 사용자
     * 좌표에서 그 노드까지의 직선 거리를 더해 가장 작은 것을 고른다. 가상의 출발점을 그 층 모든
     * 노드에 직선 간선으로 이어 붙이고 다익스트라를 돌리는 것과 같은 답이며, 그래프를 건드리지
     * 않는다. 경로 유형마다 도달 가능한 노드가 다르므로 유형별로 따로 고른다.
     *
     * <p><b>같은 층만 후보로 둔다.</b> 층 이동은 계단·엘리베이터를 타야 하는데 직선 거리는
     * 그것을 모른다. 층은 요청에 온 {@code startNodeId} 의 층을 쓴다.
     *
     * <p><b>직선 거리라 벽을 모른다.</b> 직선으로 가깝지만 실제로는 벽 너머인 노드가 뽑힐 수
     * 있다. 지금 {@code IndoorPositionResolver} 도 같은 한계를 갖고 있어 일관은 하다. 제대로
     * 하려면 노드가 아니라 간선 위의 점에 투영해야 하고, 그것은 그래프 모델을 바꾸는 일이다.
     *
     * <p>좌표가 없거나 후보를 찾지 못하면 요청에 온 진입 노드를 그대로 쓴다. 선택 필드라
     * 클라이언트가 늦게 반영해도 동작이 바뀌지 않아야 한다.
     */
    private List<Long> withChosenEntry(
            List<Long> stopNodeIds,
            RouteGraphData data,
            RouteType routeType,
            BigDecimal currentMapX,
            BigDecimal currentMapY
    ) {
        if (currentMapX == null || currentMapY == null) {
            return stopNodeIds;
        }

        Long requestedEntry = stopNodeIds.get(0);
        RouteNode requestedNode = data.nodes().get(requestedEntry);
        if (requestedNode == null) {
            return stopNodeIds;
        }

        Long firstStop = stopNodeIds.get(1);
        Map<Long, BigDecimal> toFirstStop = routeFinder.distancesFrom(data.edges(), firstStop, routeType);
        if (toFirstStop.isEmpty()) {
            return stopNodeIds;
        }

        double x = currentMapX.doubleValue();
        double y = currentMapY.doubleValue();
        Long chosen = data.nodes().values().stream()
                .filter(node -> node.getFloorId().equals(requestedNode.getFloorId()))
                .filter(node -> toFirstStop.containsKey(node.getId()))
                .min(Comparator.comparingDouble(node ->
                        straightDistance(x, y, node) + toFirstStop.get(node.getId()).doubleValue()))
                .map(RouteNode::getId)
                .orElse(requestedEntry);

        if (chosen.equals(requestedEntry)) {
            return stopNodeIds;
        }

        List<Long> replaced = new ArrayList<>(stopNodeIds);
        replaced.set(0, chosen);
        return replaced;
    }

    private double straightDistance(double x, double y, RouteNode node) {
        return Math.hypot(node.getMapX().doubleValue() - x, node.getMapY().doubleValue() - y);
    }

    private List<RouteStep> toSteps(List<Segment> segments) {
        List<RouteStep> steps = new ArrayList<>();
        int order = 1;
        for (Segment segment : segments) {
            RouteMoveType moveType = segment.moveType();
            steps.add(new RouteStep(
                    order++,
                    segment.fromNodeId(),
                    segment.toNodeId(),
                    segment.distanceM(),
                    segment.estimatedTimeSec(),
                    moveType == null ? null : moveType.getCode(),
                    buildInstruction(moveType, segment.distanceM())
            ));
        }
        return steps;
    }

    private List<RoutePathNode> toPathNodes(List<Long> nodeIds, Map<Long, RouteNode> nodes) {
        return nodeIds.stream()
                .map(nodes::get)
                .map(RoutePathNode::from)
                .toList();
    }

    private String buildInstruction(RouteMoveType moveType, BigDecimal distanceM) {
        if (moveType == null) {
            return String.format("%s 이동하세요.", formatDistance(distanceM));
        }
        return switch (moveType) {
            case WALKWAY -> String.format("%s 직진하세요.", formatDistance(distanceM));
            case STAIR -> "계단을 이용해 이동하세요.";
            case ESCALATOR -> "에스컬레이터를 이용해 이동하세요.";
            case ELEVATOR -> "엘리베이터를 이용해 이동하세요.";
            case GATE -> "개찰구를 통과하세요.";
        };
    }

    private String formatDistance(BigDecimal distanceM) {
        return distanceM.setScale(0, RoundingMode.HALF_UP).toPlainString() + "m";
    }

    /**
     * 경로가 계단이나 에스컬레이터를 지나는지 여부(FR-U-009 "계단 포함 여부").
     *
     * <p>{@link RouteType#ELEVATOR_ONLY} 가 제외하는 두 이동 수단과 같은 기준이다.
     * 휠체어·유모차 기준으로는 에스컬레이터도 계단과 같은 장벽이라 함께 본다.
     */
    private boolean hasStairsOrEscalator(RoutePath path) {
        return path.segments().stream()
                .map(Segment::moveType)
                .anyMatch(moveType -> moveType == RouteMoveType.STAIR || moveType == RouteMoveType.ESCALATOR);
    }

    private RouteUnavailableReason reasonFor(RouteType routeType) {
        return routeType == RouteType.ELEVATOR_ONLY
                ? RouteUnavailableReason.NO_ACCESSIBLE_ROUTE
                : RouteUnavailableReason.NO_ROUTE;
    }

    private void requireNodeInStation(Map<Long, RouteNode> nodes, Long nodeId) {
        if (!nodes.containsKey(nodeId)) {
            throw new BusinessException(ErrorCode.ROUTE_NODE_NOT_FOUND);
        }
    }

    private void validateStationActive(Long stationId) {
        if (stationRepository.findByIdAndActiveTrue(stationId).isEmpty()) {
            throw new BusinessException(ErrorCode.STATION_NOT_FOUND);
        }
    }

    private record RouteGraphData(Map<Long, RouteNode> nodes, List<GraphEdge> edges) {
    }
}

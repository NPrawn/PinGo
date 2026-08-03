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
import com.pingo.backend.route.service.RouteFinder.InboundSearch;
import com.pingo.backend.route.service.RouteFinder.RoutePath;
import com.pingo.backend.route.service.RouteFinder.Segment;
import com.pingo.backend.station.domain.StationFloor;
import com.pingo.backend.station.repository.StationFloorRepository;
import com.pingo.backend.station.repository.StationRepository;
import com.pingo.backend.usersession.domain.Language;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
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

    /**
     * 진입 노드까지 직선으로 인정하는 최대 거리(m).
     *
     * <p><b>왜 상한이 필요한가.</b> 진입 노드는 {@code 사용자→노드 직선거리 + 노드→목적지
     * 그래프거리} 가 가장 작은 것을 고른다. 직선은 같은 두 점 사이 그래프 경로의 하한이라
     * 미터당 더 싸다. 그래서 최소화하면 목적지 방향으로 직선을 최대한 길게 쓰고 늦게 그래프에
     * 올라타는 쪽이 이긴다 — 진입 노드 선택이 아니라 지름길 치기가 된다. 상한이 없으면 역삼역
     * B3 에서 고른 진입 노드까지의 직선거리가 중앙 31.0m·최대 196.5m 였다. 같은 층 노드 간격이
     * 중앙 7.7m 인 곳에서다.
     *
     * <p><b>왜 15m 인가.</b> 상한이 너무 작으면 후보가 통째로 비고, 그러면
     * {@code orElse(requestedEntry)} 로 조용히 떨어져 337 이 고친 유턴이 되살아난다. 실제 사용자
     * 위치를 표본으로 만들어(B3 간선 위 0.1m 간격 보간 + 통로 중심선에서 좌우 3m, 1377개 위치
     * × 출구 9곳 = 12,393건) 재 보면 가장 가까운 유효 후보까지의 거리 최대값이 <b>14.1m</b> 다.
     *
     * <pre>
     *   상한 10m   후보 0개  567건 (4.6%)   &lt;- 침묵 폴백
     *   상한 15m   후보 0개    0건
     *   상한 20m   후보 0개    0건
     * </pre>
     *
     * <p>근거가 역삼역 전수 조사이므로 <b>다른 역 데이터가 들어오면 다시 재야 한다.</b> 노드가
     * 더 드문 역이면 15m 로도 후보가 빈다. 그때는 이 값을 올리거나 {@code 최근접 + 여유} 같은
     * 상대 상한으로 바꾼다. 줄이는 쪽은 위 표대로 위험하다.
     *
     * <p>선로 건너편 승강장을 막는 것은 이 상한이 아니라 후보 제한이다. 역삼역에서 마주보는
     * 최단 노드 쌍이 15.7m 라 15m 가 우연히 그것도 걸러내지만, 여유가 0.7m 뿐이라 기대면 안 된다.
     * (S15P11A206-338)
     */
    private static final double MAX_ENTRY_STRAIGHT_M = 15.0;

    private final RouteNodeRepository routeNodeRepository;
    private final RouteEdgeRepository routeEdgeRepository;
    private final StationRepository stationRepository;
    private final StationFloorRepository stationFloorRepository;
    private final RouteFinder routeFinder;
    private final RouteInstructionWriter instructionWriter;

    /**
     * 출발 노드에서 도착 노드까지의 경로 옵션(빠른 경로·엘리베이터 이용 경로)을 요약으로 조회한다.
     */
    public List<RouteOptionResponse> getRouteOptions(RouteOptionsRequest request) {
        List<Long> requested = stopNodeIds(request.startNodeId(), request.waypointNodeIds(), request.targetNodeId());
        RouteGraphData data = loadGraph(request.stationId(), requested);

        List<RouteOptionResponse> options = new ArrayList<>();
        for (RouteType routeType : RouteType.values()) {
            InboundSearch toFirstStop = searchToFirstStop(
                    requested, data, routeType, request.currentMapX(), request.currentMapY());
            List<Long> stopNodeIds = withChosenEntry(requested, data, toFirstStop, routeType,
                    request.currentMapX(), request.currentMapY());
            RoutePath path = findThroughStops(data.edges(), stopNodeIds, routeType, toFirstStop);
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
        InboundSearch toFirstStop = searchToFirstStop(
                requested, data, routeType, request.currentMapX(), request.currentMapY());
        List<Long> stopNodeIds = withChosenEntry(requested, data, toFirstStop, routeType,
                request.currentMapX(), request.currentMapY());
        RoutePath path = findThroughStops(data.edges(), stopNodeIds, routeType, toFirstStop);

        if (!path.isReachable()) {
            return RouteResponse.unavailable(
                    routeType, request.startNodeId(), request.targetNodeId(),
                    reasonFor(routeType), request.language());
        }

        List<RouteStep> steps = toSteps(path.segments(), data, request.language());
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

    /**
     * 첫 구간의 경로는 이미 구해 둔 것을 쓴다.
     *
     * <p>진입 노드를 고르려고 {@link RouteFinder#searchInbound} 를 이미 돌렸고, 그 결과에 고른
     * 노드에서 첫 경유지(또는 목적지)까지의 경로가 들어 있다. 다시 탐색하면 경로 유형마다
     * 다익스트라를 두 번 돌게 된다.
     *
     * <p>{@code toFirstStop} 이 {@code null} 이면 — 좌표를 받지 않아 진입 노드를 다시 고르지
     * 않은 경우다 — 예전처럼 구간마다 탐색한다.
     */
    private RoutePath findThroughStops(
            List<GraphEdge> edges,
            List<Long> stopNodeIds,
            RouteType routeType,
            InboundSearch toFirstStop
    ) {
        List<Long> nodeIds = new ArrayList<>();
        List<Segment> segments = new ArrayList<>();
        BigDecimal totalDistanceM = BigDecimal.ZERO;
        Integer totalTimeSec = 0;

        for (int i = 0; i < stopNodeIds.size() - 1; i++) {
            RoutePath path = i == 0 && toFirstStop != null
                    ? toFirstStop.pathFrom(stopNodeIds.get(0))
                    : routeFinder.find(edges, stopNodeIds.get(i), stopNodeIds.get(i + 1), routeType);
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

        Map<Long, Integer> floorOrders = stationFloorRepository.findAllByStationIdOrderByFloorOrderAsc(stationId)
                .stream()
                .collect(Collectors.toMap(StationFloor::getId, StationFloor::getFloorOrder));

        return new RouteGraphData(nodes, edges, floorOrders);
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
     * <p>첫 경유지(또는 목적지)에서 역방향으로 한 번 훑어 모든 노드까지의 거리를 구하고, 거기에
     * 사용자 좌표에서 그 노드까지의 직선 거리를 더해 가장 작은 것을 고른다. 경로 유형마다 도달
     * 가능한 노드가 다르므로 유형별로 따로 고른다.
     *
     * <p><b>그 층에서 걸어갈 수 있는 노드만 후보로 둔다.</b> 요청에 온 진입 노드에서 같은 층
     * 간선만으로 닿는 노드로 좁힌다({@link RouteFinder#reachableWithin}). 같은 층인 것만으로는
     * 모자라다 — 역삼역 B3 는 선로 양쪽에 승강장이 있고 그 둘은 같은 층인데도 이어져 있지
     * 않다. {@code toFirstStop} 의 도달성은 층을 가리지 않아 B2 를 경유해 이어지는 것으로
     * 계산되므로, 그것만 믿으면 선로 건너편 노드가 후보에 남는다(S15P11A206-338).
     *
     * <p><b>직선 구간에 상한을 둔다.</b> {@link #MAX_ENTRY_STRAIGHT_M} 참고. 위의 후보 제한과
     * 막는 것이 다르다 — 이것은 지름길 치기를, 후보 제한은 선로 건너편을 막는다.
     *
     * <p><b>직선 거리라 벽을 모른다.</b> 직선으로 가깝지만 실제로는 벽 너머인 노드가 뽑힐 수
     * 있다. 지금 {@code IndoorPositionResolver} 도 같은 한계를 갖고 있어 일관은 하다. 제대로
     * 하려면 노드가 아니라 간선 위의 점에 투영해야 하고, 그것은 그래프 모델을 바꾸는 일이다.
     * 걸어갈 수 있는 노드로 좁히는 것은 그 근사의 <b>범위</b>를 그 층 통로로 묶는 일이지,
     * 벽을 아는 일은 아니다.
     *
     * <p>탐색 결과가 없거나 후보를 찾지 못하면 요청에 온 진입 노드를 그대로 쓴다. 선택 필드라
     * 클라이언트가 늦게 반영해도 동작이 바뀌지 않아야 한다.
     */
    private List<Long> withChosenEntry(
            List<Long> stopNodeIds,
            RouteGraphData data,
            InboundSearch toFirstStop,
            RouteType routeType,
            BigDecimal currentMapX,
            BigDecimal currentMapY
    ) {
        if (toFirstStop == null || currentMapX == null || currentMapY == null) {
            return stopNodeIds;
        }

        Long requestedEntry = stopNodeIds.get(0);
        RouteNode requestedNode = data.nodes().get(requestedEntry);
        if (requestedNode == null) {
            return stopNodeIds;
        }

        Set<Long> sameFloor = data.nodes().values().stream()
                .filter(node -> node.getFloorId().equals(requestedNode.getFloorId()))
                .map(RouteNode::getId)
                .collect(Collectors.toSet());
        Set<Long> walkable = routeFinder.reachableWithin(data.edges(), requestedEntry, sameFloor, routeType);

        double x = currentMapX.doubleValue();
        double y = currentMapY.doubleValue();
        Long chosen = walkable.stream()
                .map(data.nodes()::get)
                .filter(node -> toFirstStop.reaches(node.getId()))
                .filter(node -> straightDistance(x, y, node) <= MAX_ENTRY_STRAIGHT_M)
                .min(Comparator.comparingDouble(node ->
                        straightDistance(x, y, node) + toFirstStop.distanceFrom(node.getId()).doubleValue()))
                .map(RouteNode::getId)
                .orElse(requestedEntry);

        if (chosen.equals(requestedEntry)) {
            return stopNodeIds;
        }

        List<Long> replaced = new ArrayList<>(stopNodeIds);
        replaced.set(0, chosen);
        return replaced;
    }

    /**
     * 첫 경유지(또는 목적지)까지의 역방향 탐색. 진입 노드 선택과 첫 구간 경로에 함께 쓴다.
     *
     * <p>좌표가 없으면 진입 노드를 다시 고를 이유가 없으므로 탐색하지 않는다. 그때는
     * {@link #findThroughStops} 가 예전처럼 구간마다 탐색한다.
     *
     * <p><b>{@code stopNodeIds} 는 항상 2 이상이다.</b> {@link #stopNodeIds} 가 출발지와
     * 목적지를 반드시 넣고 둘 다 {@code @NotNull} 이라 그렇다. 그래도 확인한다 — 이 전제가
     * 코드에 드러나 있지 않고, 나중에 다른 데서 부르면 조용히 깨진다.
     */
    private InboundSearch searchToFirstStop(
            List<Long> stopNodeIds,
            RouteGraphData data,
            RouteType routeType,
            BigDecimal currentMapX,
            BigDecimal currentMapY
    ) {
        if (currentMapX == null || currentMapY == null || stopNodeIds.size() < 2) {
            return null;
        }
        return routeFinder.searchInbound(data.edges(), stopNodeIds.get(1), routeType);
    }

    private double straightDistance(double x, double y, RouteNode node) {
        return Math.hypot(node.getMapX().doubleValue() - x, node.getMapY().doubleValue() - y);
    }

    private List<RouteStep> toSteps(List<Segment> segments, RouteGraphData data, Language language) {
        List<RouteStep> steps = new ArrayList<>();
        Segment previous = null;
        int order = 1;
        for (Segment segment : segments) {
            RouteMoveType moveType = segment.moveType();
            RouteInstructionWriter.Guidance guidance =
                    instructionWriter.write(previous, segment, data.nodes(), data.floorOrders(), language);
            steps.add(new RouteStep(
                    order++,
                    segment.fromNodeId(),
                    segment.toNodeId(),
                    segment.distanceM(),
                    segment.estimatedTimeSec(),
                    moveType == null ? null : moveType.getCode(),
                    guidance.instruction(),
                    guidance.turn(),
                    guidance.floorDelta()
            ));
            previous = segment;
        }
        return steps;
    }

    private List<RoutePathNode> toPathNodes(List<Long> nodeIds, Map<Long, RouteNode> nodes) {
        return nodeIds.stream()
                .map(nodes::get)
                .map(RoutePathNode::from)
                .toList();
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

    private record RouteGraphData(
            Map<Long, RouteNode> nodes,
            List<GraphEdge> edges,
            /** 층 ID 에서 {@code floor_order} 로. 층 이동 안내가 몇 층인지 셀 때 쓴다. */
            Map<Long, Integer> floorOrders
    ) {
    }
}

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
        RouteGraphData data = loadGraph(request.stationId(), request.startNodeId(), request.targetNodeId());

        List<RouteOptionResponse> options = new ArrayList<>();
        for (RouteType routeType : RouteType.values()) {
            RoutePath path = routeFinder.find(data.edges(), request.startNodeId(), request.targetNodeId(), routeType);
            if (path.isReachable()) {
                options.add(RouteOptionResponse.available(
                        routeType, path.totalDistanceM(), path.totalTimeSec(), hasStairsOrEscalator(path)));
            } else {
                options.add(RouteOptionResponse.unavailable(routeType, reasonFor(routeType)));
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

        RouteGraphData data = loadGraph(request.stationId(), request.startNodeId(), request.targetNodeId());
        RoutePath path = routeFinder.find(data.edges(), request.startNodeId(), request.targetNodeId(), routeType);

        if (!path.isReachable()) {
            return RouteResponse.unavailable(routeType, request.startNodeId(), request.targetNodeId(), reasonFor(routeType));
        }

        List<RouteStep> steps = toSteps(path.segments());
        List<RoutePathNode> pathNodes = toPathNodes(path.nodeIds(), data.nodes());
        return RouteResponse.available(
                routeType,
                request.startNodeId(),
                request.targetNodeId(),
                path.totalDistanceM(),
                path.totalTimeSec(),
                steps,
                pathNodes
        );
    }

    private RouteGraphData loadGraph(Long stationId, Long startNodeId, Long targetNodeId) {
        validateStationActive(stationId);

        Map<Long, RouteNode> nodes = routeNodeRepository.search(stationId, null).stream()
                .collect(Collectors.toMap(RouteNode::getId, Function.identity()));
        requireNodeInStation(nodes, startNodeId);
        requireNodeInStation(nodes, targetNodeId);

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

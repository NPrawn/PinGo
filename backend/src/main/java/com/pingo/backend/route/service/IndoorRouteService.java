package com.pingo.backend.route.service;

import com.pingo.backend.facility.repository.FacilityRepository;
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
import com.pingo.backend.route.service.RouteFinder.RouteGraph;
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

    /**
     * 총 이동 거리가 이만큼 안에서 비슷하면 <b>가까운 노드</b>를 진입점으로 고르는 여유(m).
     *
     * <p>후보를 {@code 직선 거리 + 남은 경로 거리} 로만 고르면 사용자가 노드 위에 서 있어도 다른
     * 노드가 뽑힌다. 그 노드에서 앞 노드로 가는 간선 하나뿐일 때 두 값이 <b>정확히 같아지기</b>
     * 때문이다 — 역삼역 B2_R023 에 서면 이렇다.
     *
     * <pre>
     *   B2_R023  직선  0m + 남은 (12 + r)  =  12 + r
     *   B2_R004  직선 12m + 남은 r         =  12 + r
     * </pre>
     *
     * <p>동점이면 스트림 순서가 정하므로 12m 떨어진 쪽이 뽑히곤 했다. 걷는 거리가 같다면 발밑에서
     * 시작하는 편이 낫다 — 경로선이 내 자리에서 뻗어 나가고 첫 안내도 지금 서 있는 곳 기준이 된다.
     *
     * <p>1m 인 것은 부동소수 오차를 흡수하면서, "가까운 쪽을 고르느라 1m 더 걷는" 정도만
     * 허용하기 위해서다. 이보다 키우면 목적지에서 멀어지는 노드가 뽑히기 시작한다.
     */
    private static final double ENTRY_TIE_TOLERANCE_M = 1.0;

    /**
     * 사용자가 <b>노드 위에 서 있다</b>고 볼 거리(m). 이 안이면 총거리 비교를 하지 않고 그 노드에서
     * 시작한다.
     *
     * <p>{@link #ENTRY_TIE_TOLERANCE_M} 로는 모자란 자리가 있다. 여유는 <b>동점</b>일 때만 닿는데,
     * ㄱ자로 꺾이는 통로에서는 모서리를 대각선으로 자르는 노드가 동점이 아니라 <b>더 짧게</b> 나온다.
     * 역삼역 B2 엘리베이터 A 앞({@code B2_R023})에 서서 3번 출구로 갈 때 이렇다.
     *
     * <pre>
     *   B2_R023  직선  0.00m + 남은 (7.19 + 8.42 + r)  =  15.61 + r
     *   B2_R004  직선  7.19m + 남은 (8.42 + r)         =  15.61 + r   &lt;- 동점, 여유가 R023 을 고른다
     *   B2_R005  직선 10.88m + 남은 r                  =  10.88 + r   &lt;- 4.73m 더 짧아 이것이 뽑힌다
     * </pre>
     *
     * <p>그 10.88m 대각선은 통로 모서리를 관통한다. 직선 거리라 벽을 모르는 탓인데, 사용자가 서 있는
     * 자리가 이미 통로 노드라면 <b>추정할 것이 없다</b> — 발밑에서 시작하는 것이 언제나 맞다. 지름길을
     * 치는 상한({@link #MAX_ENTRY_STRAIGHT_M})은 위치가 노드 사이에 있을 때를 위한 근사이고, 이
     * 값은 그 근사를 쓸 필요가 없는 경우를 먼저 걷어낸다.
     *
     * <p>화면에서는 이 어긋남이 <b>내 점이 순간이동한 것</b>으로 보인다. 안내 지도는 내 점을 경로
     * 간선 위에 올리므로(S15P11A206-345), 서 있는 노드가 경로에서 빠지면 점이 10.88m 떨어진
     * 대각선 위에 그려진다. 층을 옮긴 직후가 특히 그렇다 — 그때는 클라이언트가 노드를 정확히
     * 알고 좌표를 그 노드값으로 보낸다.
     *
     * <p>1.5m 인 것은 통로 폭의 절반 남짓이다. 여기까지는 그 노드 앞에 선 것으로 볼 수 있고,
     * 되돌아 걷는 군더더기도 최대 3m 다. 이보다 키우면 목적지 반대쪽 노드를 집어 337 이 고친
     * 유턴이 되살아난다.
     */
    private static final double ON_NODE_M = 1.5;

    private final RouteNodeRepository routeNodeRepository;
    private final RouteEdgeRepository routeEdgeRepository;
    private final StationRepository stationRepository;
    private final StationFloorRepository stationFloorRepository;
    /** 출구의 접근 경로용 도착 노드를 읽는다. {@link #accessibleTargetOf} 참고. */
    private final FacilityRepository facilityRepository;
    private final RouteFinder routeFinder;
    private final RouteInstructionWriter instructionWriter;

    /**
     * 출발 노드에서 도착 노드까지의 경로 옵션(빠른 경로·엘리베이터 이용 경로)을 요약으로 조회한다.
     */
    public List<RouteOptionResponse> getRouteOptions(RouteOptionsRequest request) {
        Long accessibleTarget = accessibleTargetOf(request.stationId(), request.targetNodeId());

        /* 두 유형의 도착 노드가 다를 수 있어 둘 다 검증한다. 그래프는 역 전체를 한 번에 읽으므로
           조회가 늘지는 않는다. */
        List<Long> toValidate = stopNodeIds(
                request.startNodeId(), request.waypointNodeIds(), request.targetNodeId());
        if (!accessibleTarget.equals(request.targetNodeId())) {
            toValidate.add(accessibleTarget);
        }
        RouteGraphData data = loadGraph(request.stationId(), toValidate);

        List<RouteOptionResponse> options = new ArrayList<>();
        for (RouteType routeType : RouteType.values()) {
            List<Long> requested = stopNodeIds(request.startNodeId(), request.waypointNodeIds(),
                    targetFor(routeType, request.targetNodeId(), accessibleTarget));
            InboundSearch toFirstStop = searchToFirstStop(
                    requested, data, routeType, request.currentMapX(), request.currentMapY());
            List<Long> stopNodeIds = withChosenEntry(requested, data, toFirstStop, routeType,
                    request.currentMapX(), request.currentMapY());
            RoutePath path = findThroughStops(data.graph(), stopNodeIds, routeType, toFirstStop);
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

        Long targetNodeId = targetFor(routeType, request.targetNodeId(),
                accessibleTargetOf(request.stationId(), request.targetNodeId()));

        List<Long> requested = stopNodeIds(request.startNodeId(), request.waypointNodeIds(), targetNodeId);
        RouteGraphData data = loadGraph(request.stationId(), requested);
        InboundSearch toFirstStop = searchToFirstStop(
                requested, data, routeType, request.currentMapX(), request.currentMapY());
        List<Long> stopNodeIds = withChosenEntry(requested, data, toFirstStop, routeType,
                request.currentMapX(), request.currentMapY());
        RoutePath path = findThroughStops(data.graph(), stopNodeIds, routeType, toFirstStop);

        if (!path.isReachable()) {
            return RouteResponse.unavailable(
                    routeType, request.startNodeId(), targetNodeId,
                    reasonFor(routeType), request.language());
        }

        List<RouteStep> steps = toSteps(path.segments(), data, request.language());
        List<RoutePathNode> pathNodes = toPathNodes(path.nodeIds(), data.nodes());
        return RouteResponse.available(
                routeType,
                stopNodeIds.get(0),
                targetNodeId,
                path.totalDistanceM(),
                path.totalTimeSec(),
                steps,
                pathNodes
        );
    }

    /**
     * 이 유형이 안내할 도착 노드.
     *
     * <p>{@code elevator_only} 만 접근 경로용 노드로 바꾼다. 역삼역 3·4번 출구는 출구 노드에
     * 닿는 길이 에스컬레이터 쪽 하나뿐이고, 나란히 있는 엘리베이터는 출구 노드로 이어지지 않는다
     * — 타면 지상으로 올라가므로 그것이 맞다. 그래서 접근 경로는 엘리베이터가 종점이다.
     *
     * <p><b>값이 같아져도 두 유형을 구분한다.</b> 3번 출구는 엘리베이터가 복도에서 4.03m,
     * 에스컬레이터 경유 출구가 19.38m 라 접근 경로가 오히려 짧다. 그래도 {@code fastest} 를
     * 엘리베이터로 보내지 않는다 — 두 옵션은 "어느 이동 수단으로 나가는가"를 고르는 것이고,
     * 거리로 하나가 다른 하나를 삼키면 고를 것이 없어진다.
     */
    private Long targetFor(RouteType routeType, Long requestedTarget, Long accessibleTarget) {
        return routeType == RouteType.ELEVATOR_ONLY ? accessibleTarget : requestedTarget;
    }

    /**
     * 이 노드를 도착점으로 갖는 시설의 접근 경로용 도착 노드. 없으면 받은 노드를 그대로 돌려준다.
     *
     * <p>그대로 돌려주는 것이 맞다 — 접근 대안이 없는 출구에서는 {@code elevator_only} 도
     * 출구 노드로 향하고, 계단·에스컬레이터 간선이 걸러져 닿지 못하면 그때 도달 불가로 답한다.
     * 노드를 바꿔치기하는 것과 "그 출구로는 계단 없이 갈 수 없다"는 답은 서로 다른 사실이다.
     */
    private Long accessibleTargetOf(Long stationId, Long targetNodeId) {
        if (stationId == null || targetNodeId == null) {
            return targetNodeId;
        }
        return facilityRepository.findAccessibleNodeIds(stationId, targetNodeId).stream()
                .findFirst()
                .orElse(targetNodeId);
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
            RouteGraph graph,
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
                    : routeFinder.find(graph, stopNodeIds.get(i), stopNodeIds.get(i + 1), routeType);
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

        List<StationFloor> stationFloors = stationFloorRepository.findAllByStationIdOrderByFloorOrderAsc(stationId);
        Map<Long, Integer> floorOrders = stationFloors.stream()
                .collect(Collectors.toMap(StationFloor::getId, StationFloor::getFloorOrder));
        Map<Long, String> floorCodes = stationFloors.stream()
                .filter(floor -> floor.getFloorCode() != null)
                .collect(Collectors.toMap(StationFloor::getId, StationFloor::getFloorCode));

        return new RouteGraphData(nodes, RouteFinder.graphOf(edges), floorOrders, floorCodes);
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
     * <p><b>복도 노드만 후보로 둔다.</b> 시설 노드는 통로에 매달린 끝점이라 그 자리에서 경로를
     * 시작하면 안내가 "교통카드 충전기에서 출발"처럼 읽힌다. 사용자가 실제로 서 있는 곳은
     * 그 앞 통로이고, 시설은 지나가는 자리가 아니라 목적지다. 시설 노드는 대개 복도 노드
     * 하나에만 붙어 있어서, 그것을 진입점으로 삼으면 첫 구간이 통로로 되돌아 나오는 군더더기가
     * 된다. {@code is_landmark} 가 둘을 가른다 — 복도(normal·junction)는 거짓, 시설은 참이다.
     *
     * <p><b>노드 위에 서 있으면 그 노드에서 시작한다.</b> 위의 총거리 비교를 건너뛴다. 추정할
     * 것이 없는 자리이고, 비교에 맡기면 통로 모서리를 대각선으로 자르는 노드가 뽑힌다
     * ({@link #ON_NODE_M}).
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
        Set<Long> walkable = routeFinder.reachableWithin(data.graph(), requestedEntry, sameFloor, routeType);

        double x = currentMapX.doubleValue();
        double y = currentMapY.doubleValue();
        List<RouteNode> candidates = walkable.stream()
                .map(data.nodes()::get)
                .filter(node -> !node.isLandmark())
                .filter(node -> toFirstStop.reaches(node.getId()))
                .filter(node -> straightDistance(x, y, node) <= MAX_ENTRY_STRAIGHT_M)
                .toList();

        /*
          노드 위에 서 있으면 그 노드에서 시작한다. 총거리를 비교하지 않는다 — ON_NODE_M 참고.
          아니면 총 이동 거리가 가장 짧은 것을 고르되, 비슷하면 가까운 쪽을 고른다
          (왜 동점이 생기고 왜 가까운 쪽이 나은지는 ENTRY_TIE_TOLERANCE_M 에 적어 두었다).
        */
        Long chosen = candidates.stream()
                .filter(node -> straightDistance(x, y, node) <= ON_NODE_M)
                .min(Comparator.comparingDouble(node -> straightDistance(x, y, node)))
                .map(RouteNode::getId)
                .orElseGet(() -> shortestTotalEntry(candidates, toFirstStop, x, y, requestedEntry));

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
        return routeFinder.searchInbound(data.graph(), stopNodeIds.get(1), routeType);
    }

    /**
     * {@code 직선 거리 + 남은 경로 거리} 가 가장 짧은 후보. 비슷하면 가까운 쪽을 고른다
     * ({@link #ENTRY_TIE_TOLERANCE_M}).
     *
     * <p>사용자 위치가 노드 사이에 있을 때 쓴다. 노드 위에 서 있으면 부르지 않는다
     * ({@link #ON_NODE_M}).
     */
    private Long shortestTotalEntry(
            List<RouteNode> candidates,
            InboundSearch toFirstStop,
            double x,
            double y,
            Long fallback
    ) {
        double best = candidates.stream()
                .mapToDouble(node -> straightDistance(x, y, node) + toFirstStop.distanceFrom(node.getId()).doubleValue())
                .min()
                .orElse(Double.NaN);

        return candidates.stream()
                .filter(node -> straightDistance(x, y, node)
                        + toFirstStop.distanceFrom(node.getId()).doubleValue() <= best + ENTRY_TIE_TOLERANCE_M)
                .min(Comparator.comparingDouble(node -> straightDistance(x, y, node)))
                .map(RouteNode::getId)
                .orElse(fallback);
    }

    private double straightDistance(double x, double y, RouteNode node) {
        return Math.hypot(node.getMapX().doubleValue() - x, node.getMapY().doubleValue() - y);
    }

    /**
     * 경로 구간을 단계별 안내로 옮긴다.
     *
     * <p><b>한 단계가 간선 하나가 아니다.</b> 연달아 직진하는 통로 구간은 하나로 묶는다
     * ({@link #mergeStraightRuns}). {@code pathNodes} 는 묶지 않는다 — 지도가 꼭짓점을 다
     * 필요로 한다. (S15P11A206-339)
     */
    private List<RouteStep> toSteps(List<Segment> segments, RouteGraphData data, Language language) {
        List<RouteStep> steps = new ArrayList<>();
        Segment previous = null;
        int order = 1;
        for (Segment segment : mergeStraightRuns(segments, data.nodes())) {
            RouteMoveType moveType = segment.moveType();
            RouteInstructionWriter.Guidance guidance =
                    instructionWriter.write(previous, segment, data.nodes(), data.floorOrders(), language);
            String fromFloorCode = floorCodeOf(segment.fromNodeId(), data);
            String toFloorCode = floorCodeOf(segment.toNodeId(), data);
            steps.add(new RouteStep(
                    order++,
                    segment.fromNodeId(),
                    segment.toNodeId(),
                    segment.distanceM(),
                    segment.estimatedTimeSec(),
                    moveType == null ? null : moveType.getCode(),
                    guidance.instruction(),
                    guidance.instructionTemplate(),
                    guidance.turn(),
                    guidance.floorDelta(),
                    stepTypeOf(fromFloorCode, toFloorCode),
                    edgeClassOf(moveType),
                    fromFloorCode,
                    toFloorCode,
                    accessibleFor(moveType)
            ));
            previous = segment;
        }
        return steps;
    }

    private String floorCodeOf(Long nodeId, RouteGraphData data) {
        RouteNode node = data.nodes().get(nodeId);
        return node == null ? null : data.floorCodes().get(node.getFloorId());
    }

    /**
     * 클라이언트가 층 이동 화면을 띄울지 가르는 값.
     *
     * <p><b>층 코드가 실제로 달라질 때만 {@code floor_change} 다.</b> 수직 이동 수단인지로
     * 정하지 않는다 — 역삼역 B1 의 B0.5 중간층은 {@code floorCode} 가 B1 이라, 그 계단·에스컬레이터는
     * 오르내리기는 하지만 보고 있는 지도가 바뀌지 않는다. 그 자리에서 층 이동 화면을 띄우면
     * 사용자는 넘어갈 층이 없는 화면을 닫아야 한다.
     *
     * <p>층을 모르면 {@code walk} 다. 모르는 것을 층 이동으로 다루면 도착층을 알려줄 수 없는
     * 화면을 띄우게 된다.
     */
    private String stepTypeOf(String fromFloorCode, String toFloorCode) {
        boolean changes = fromFloorCode != null && toFloorCode != null && !fromFloorCode.equals(toFloorCode);
        return changes ? RouteStep.TYPE_FLOOR_CHANGE : RouteStep.TYPE_WALK;
    }

    /**
     * 계단·에스컬레이터를 쓸 수 없는 사용자가 지날 수 있는 구간인지.
     *
     * <p>{@code route_edge.is_accessible} 을 읽지 않고 {@link RouteType#ELEVATOR_ONLY} 의 허용
     * 여부로 정한다. 그래야 이 값이 실제 탐색 결과와 어긋날 수 없다 — 거짓인 구간은 엘리베이터
     * 경로에 애초에 담기지 않는다. 컬럼을 따로 읽으면 둘이 갈라질 수 있고, 그때 클라이언트는
     * 경로에 들어 있는데 못 지나간다고 적힌 구간을 보게 된다.
     *
     * <p>{@code null} 은 허용으로 본다. {@link RouteFinder} 도 같게 다룬다 — 모르는 이동 수단을
     * 막으면 경로가 통째로 끊긴다.
     */
    private boolean accessibleFor(RouteMoveType moveType) {
        return moveType == null || RouteType.ELEVATOR_ONLY.allows(moveType);
    }

    /** 간선이 수직 이동 수단인지. 통로와 개찰구만 평지다. */
    private String edgeClassOf(RouteMoveType moveType) {
        boolean vertical = moveType == RouteMoveType.STAIR
                || moveType == RouteMoveType.ESCALATOR
                || moveType == RouteMoveType.ELEVATOR;
        return vertical ? RouteStep.EDGE_CLASS_VERTICAL : RouteStep.EDGE_CLASS_WALK;
    }

    /**
     * 연달아 직진하는 통로 구간을 하나로 묶는다. 판단 규칙은
     * {@link RouteInstructionWriter#continuesStraightRun} 에 있다.
     *
     * <p>묶인 구간의 회전은 <b>합친 구간의 현(chord)</b> 기준으로 판정된다 — 첫 간선만 보고
     * 판단하던 예전과 값이 달라질 수 있다. 여러 간선을 하나로 안내하는 것이니 그 전체가 어느
     * 방향으로 가는지가 맞는 기준이다.
     */
    private List<Segment> mergeStraightRuns(List<Segment> segments, Map<Long, RouteNode> nodes) {
        List<Segment> merged = new ArrayList<>();
        List<Segment> run = new ArrayList<>();

        for (Segment segment : segments) {
            if (run.isEmpty()) {
                run.add(segment);
                continue;
            }

            Segment runStart = run.get(0);
            Segment last = run.get(run.size() - 1);
            if (instructionWriter.continuesStraightRun(runStart, last, segment, nodes)) {
                run.add(segment);
                continue;
            }

            merged.add(collapse(run));
            run = new ArrayList<>();
            run.add(segment);
        }

        if (!run.isEmpty()) {
            merged.add(collapse(run));
        }
        return merged;
    }

    /**
     * 묶은 구간을 하나의 구간으로 만든다. 거리는 합이고 노드는 처음과 끝이다.
     *
     * <p><b>시간은 하나라도 비면 전체를 비운다.</b> 있는 것만 더하면 실제보다 짧은 수가
     * 나가는데, 받는 쪽은 그것이 부분 합인지 알 수 없다. 경로 총 시간도 같은 규칙이다
     * ({@link RoutePath}).
     */
    private Segment collapse(List<Segment> run) {
        if (run.size() == 1) {
            return run.get(0);
        }

        Segment first = run.get(0);
        Segment last = run.get(run.size() - 1);
        BigDecimal distanceM = BigDecimal.ZERO;
        Integer estimatedTimeSec = 0;
        for (Segment segment : run) {
            distanceM = distanceM.add(segment.distanceM());
            if (estimatedTimeSec != null) {
                estimatedTimeSec = segment.estimatedTimeSec() == null
                        ? null
                        : estimatedTimeSec + segment.estimatedTimeSec();
            }
        }

        return new Segment(first.fromNodeId(), last.toNodeId(), distanceM, estimatedTimeSec, first.moveType());
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
            /** 요청 범위 탐색 그래프. 인접 목록을 처음 쓸 때 만들고 재사용한다({@link RouteGraph}). */
            RouteGraph graph,
            /** 층 ID 에서 {@code floor_order} 로. 층 이동 안내가 몇 층인지 셀 때 쓴다. */
            Map<Long, Integer> floorOrders,
            /** 층 ID 에서 층 코드로. 층 이동 구간이 어느 층에서 어느 층으로 가는지 실을 때 쓴다. */
            Map<Long, String> floorCodes
    ) {
    }
}

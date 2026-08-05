package com.pingo.backend.route.service;

import com.pingo.backend.facility.repository.FacilityRepository;
import com.pingo.backend.global.exception.BusinessException;
import com.pingo.backend.global.exception.ErrorCode;
import com.pingo.backend.route.domain.RouteEdge;
import com.pingo.backend.route.domain.RouteMoveType;
import com.pingo.backend.route.domain.RouteNode;
import com.pingo.backend.route.domain.RouteUnavailableReason;
import com.pingo.backend.route.dto.request.RouteCreateRequest;
import com.pingo.backend.route.dto.request.RouteOptionsRequest;
import com.pingo.backend.route.dto.response.RouteOptionResponse;
import com.pingo.backend.route.dto.response.RoutePathNode;
import com.pingo.backend.route.dto.response.RouteResponse;
import com.pingo.backend.route.dto.response.RouteStep;
import com.pingo.backend.route.repository.RouteEdgeRepository;
import com.pingo.backend.route.repository.RouteNodeRepository;
import com.pingo.backend.station.domain.Station;
import com.pingo.backend.station.domain.StationFloor;
import com.pingo.backend.station.repository.StationFloorRepository;
import com.pingo.backend.station.repository.StationRepository;
import com.pingo.backend.usersession.domain.Language;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class IndoorRouteServiceTest {

    @Mock
    private RouteNodeRepository routeNodeRepository;

    @Mock
    private RouteEdgeRepository routeEdgeRepository;

    @Mock
    private StationRepository stationRepository;

    @Mock
    private StationFloorRepository stationFloorRepository;

    @Mock
    private FacilityRepository facilityRepository;

    private IndoorRouteService indoorRouteService;

    @BeforeEach
    void setUp() {
        indoorRouteService = new IndoorRouteService(
                routeNodeRepository,
                routeEdgeRepository,
                stationRepository,
                stationFloorRepository,
                facilityRepository,
                new RouteFinder(),
                new RouteInstructionWriter());
    }

    @Test
    @DisplayName("옵션 조회는 빠른 경로와 엘리베이터 이용 경로를 모두 반환한다")
    void getRouteOptionsReturnsBothOptions() {
        givenActiveStation(1L);
        givenNodes(1L, node(1L), node(2L), node(3L), node(4L));
        givenEdges(1L,
                edge(1L, 1L, 2L, 10, RouteMoveType.WALKWAY),
                edge(1L, 2L, 4L, 5, RouteMoveType.STAIR),
                edge(1L, 2L, 3L, 10, RouteMoveType.WALKWAY),
                edge(1L, 3L, 4L, 10, RouteMoveType.ELEVATOR));

        List<RouteOptionResponse> options =
                indoorRouteService.getRouteOptions(optionsRequest(1L, 1L, 4L, null, null));

        assertThat(options)
                .extracting(RouteOptionResponse::routeType, RouteOptionResponse::available)
                .containsExactly(
                        tuple("fastest", true),
                        tuple("elevator_only", true));
        assertThat(options.get(0).totalDistanceM()).isEqualByComparingTo(BigDecimal.valueOf(15));
        assertThat(options.get(1).totalDistanceM()).isEqualByComparingTo(BigDecimal.valueOf(30));
        // 빠른 경로는 계단(2→4)을 지나고, 엘리베이터 이용 경로는 정의상 지나지 않는다.
        assertThat(options.get(0).hasStairsOrEscalator()).isTrue();
        assertThat(options.get(1).hasStairsOrEscalator()).isFalse();
    }

    @Test
    @DisplayName("에스컬레이터를 지나는 경로도 계단 포함으로 본다")
    void marksEscalatorPathAsHavingStairs() {
        givenActiveStation(1L);
        givenNodes(1L, node(1L), node(2L), node(3L), node(4L));
        givenEdges(1L,
                edge(1L, 1L, 2L, 10, RouteMoveType.WALKWAY),
                edge(1L, 2L, 4L, 5, RouteMoveType.ESCALATOR),
                edge(1L, 2L, 3L, 10, RouteMoveType.WALKWAY),
                edge(1L, 3L, 4L, 10, RouteMoveType.ELEVATOR));

        List<RouteOptionResponse> options =
                indoorRouteService.getRouteOptions(optionsRequest(1L, 1L, 4L, null, null));

        // 휠체어·유모차 기준으로는 에스컬레이터도 계단과 같은 장벽이다.
        assertThat(options.get(0).hasStairsOrEscalator()).isTrue();
        assertThat(options.get(1).hasStairsOrEscalator()).isFalse();
    }

    /**
     * 두 유형이 층을 오르는 수단은 겹치지 않는다. (S15P11A206-345)
     *
     * <p>예전에는 {@code fastest} 가 모든 간선을 허용해서 엘리베이터가 최단이면 그것을 골랐고,
     * 그러면 두 카드가 같은 엘리베이터를 타서 무엇을 고르는지 알 수 없었다.
     */
    @Test
    @DisplayName("빠른 경로는 엘리베이터를 쓰지 않고 계단으로 올라간다")
    void fastestAvoidsElevator() {
        givenActiveStation(1L);
        //  1 ─(엘리베이터 5m)─ 3     짧지만 fastest 는 못 쓴다
        //    └(계단 20m)────── 3
        givenNodes(1L, node(1L), node(3L));
        givenEdges(1L,
                edge(1L, 1L, 3L, 5, RouteMoveType.ELEVATOR),
                edge(1L, 1L, 3L, 20, RouteMoveType.STAIR));

        List<RouteOptionResponse> options =
                indoorRouteService.getRouteOptions(optionsRequest(1L, 1L, 3L, null, null));

        // 빠른 경로는 더 먼 계단을 쓴다. 이름과 달리 최단이 아닐 수 있음을 받아들인 결과다.
        assertThat(options.get(0).totalDistanceM()).isEqualByComparingTo("20");
        assertThat(options.get(0).hasStairsOrEscalator()).isTrue();
        // 엘리베이터 경로는 계단을 못 쓰므로 엘리베이터로 간다.
        assertThat(options.get(1).totalDistanceM()).isEqualByComparingTo("5");
        assertThat(options.get(1).hasStairsOrEscalator()).isFalse();
    }

    /**
     * 층 사이가 엘리베이터로만 이어져 있으면 {@code fastest} 는 도달 불가다. 지금 역삼역
     * 데이터에는 그런 구간이 없지만, 엘리베이터 제외의 대가가 이것임을 여기서 붙잡아 둔다.
     */
    @Test
    @DisplayName("엘리베이터로만 이어진 구간은 빠른 경로가 도달 불가다")
    void fastestCannotReachElevatorOnlyLink() {
        givenActiveStation(1L);
        givenNodes(1L, node(1L), node(2L));
        givenEdges(1L, edge(1L, 1L, 2L, 5, RouteMoveType.ELEVATOR));

        List<RouteOptionResponse> options =
                indoorRouteService.getRouteOptions(optionsRequest(1L, 1L, 2L, null, null));

        assertThat(options.get(0).available()).isFalse();
        assertThat(options.get(1).available()).isTrue();
    }

    @Test
    @DisplayName("통로만 지나는 경로는 계단 포함이 아니다")
    void marksWalkwayOnlyPathAsStepFree() {
        givenActiveStation(1L);
        givenNodes(1L, node(1L), node(2L), node(3L));
        givenEdges(1L,
                edge(1L, 1L, 2L, 10, RouteMoveType.WALKWAY),
                edge(1L, 2L, 3L, 10, RouteMoveType.WALKWAY));

        List<RouteOptionResponse> options =
                indoorRouteService.getRouteOptions(optionsRequest(1L, 1L, 3L, null, null));

        assertThat(options).allSatisfy(option ->
                assertThat(option.hasStairsOrEscalator()).isFalse());
    }

    /**
     * 역삼역 3·4번 출구가 이 모양이다. 출구 노드에 닿는 길은 에스컬레이터 쪽 하나뿐이고, 나란히
     * 있는 엘리베이터는 출구 노드로 이어지지 않는다 — 타면 지상으로 올라가므로 그것이 맞다.
     * 그래서 접근 경로는 엘리베이터가 종점이다. (S15P11A206-345)
     */
    @Test
    @DisplayName("엘리베이터 이용 경로는 출구의 접근 대안 노드로 안내한다")
    void routesAccessibleOptionToAccessibleNode() {
        givenActiveStation(1L);
        //  1 ── 2(엘리베이터, 접근 대안) 은 여기서 끝
        //    └─ 3(에스컬레이터) ── 4(출구)
        givenNodes(1L, node(1L), node(2L), node(3L), node(4L));
        givenEdges(1L,
                edge(1L, 1L, 2L, 4, RouteMoveType.WALKWAY),
                edge(1L, 1L, 3L, 11, RouteMoveType.ESCALATOR),
                edge(1L, 3L, 4L, 9, RouteMoveType.WALKWAY));
        when(facilityRepository.findAccessibleNodeIds(1L, 4L)).thenReturn(List.of(2L));

        List<RouteOptionResponse> options =
                indoorRouteService.getRouteOptions(optionsRequest(1L, 1L, 4L, null, null));
        RouteResponse accessible = indoorRouteService.createRoute(new RouteCreateRequest(
                1L, 1L, 4L, null, "elevator_only", Language.KO, null, null));

        // 최단 경로는 출구 노드(4)까지 20m. 엘리베이터 경로는 대안 노드(2)까지 4m.
        assertThat(options.get(0).totalDistanceM()).isEqualByComparingTo("20");
        assertThat(options.get(1).totalDistanceM()).isEqualByComparingTo("4");
        // 응답이 실제로 안내한 도착 노드를 알려준다. 부르는 쪽이 요청한 4가 아니다.
        assertThat(accessible.targetNodeId()).isEqualTo(2L);
        assertThat(accessible.totalDistanceM()).isEqualByComparingTo("4");
    }

    /**
     * 접근 대안이 없는 출구는 바꿔치기하지 않는다. 계단 간선이 걸러져 닿지 못하면 그대로 도달
     * 불가로 답해야 한다 — "다른 노드로 보낸다"와 "계단 없이는 갈 수 없다"는 다른 사실이다.
     */
    @Test
    @DisplayName("접근 대안이 없으면 엘리베이터 경로도 요청한 도착 노드를 쓴다")
    void keepsRequestedTargetWhenNoAccessibleAlternative() {
        givenActiveStation(1L);
        givenNodes(1L, node(1L), node(2L));
        givenEdges(1L, edge(1L, 1L, 2L, 10, RouteMoveType.STAIR));

        RouteResponse accessible = indoorRouteService.createRoute(new RouteCreateRequest(
                1L, 1L, 2L, null, "elevator_only", Language.KO, null, null));

        assertThat(accessible.targetNodeId()).isEqualTo(2L);
        assertThat(accessible.available()).isFalse();
        assertThat(accessible.unavailableReason()).isEqualTo("NO_ACCESSIBLE_ROUTE");
    }

    @Test
    @DisplayName("도달 불가 옵션의 계단 포함 여부는 false로 내려간다")
    void unavailableOptionHasFalseStairsFlag() {
        givenActiveStation(1L);
        givenNodes(1L, node(1L), node(2L));
        givenEdges(1L, edge(1L, 1L, 2L, 10, RouteMoveType.STAIR));

        List<RouteOptionResponse> options =
                indoorRouteService.getRouteOptions(optionsRequest(1L, 1L, 2L, null, null));

        assertThat(options.get(1).available()).isFalse();
        assertThat(options.get(1).hasStairsOrEscalator()).isFalse();
    }

    @Test
    @DisplayName("이용 불가 사유 문구가 요청 언어로 내려간다")
    void putsUnavailableMessageInRequestedLanguage() {
        givenActiveStation(1L);
        givenNodes(1L, node(1L), node(2L));
        givenEdges(1L, edge(1L, 1L, 2L, 10, RouteMoveType.STAIR));

        RouteOptionResponse korean = indoorRouteService
                .getRouteOptions(optionsRequest(1L, 1L, 2L, null, Language.KO)).get(1);
        RouteOptionResponse english = indoorRouteService
                .getRouteOptions(optionsRequest(1L, 1L, 2L, null, Language.EN)).get(1);

        assertThat(korean.unavailableReason()).isEqualTo("NO_ACCESSIBLE_ROUTE");
        assertThat(korean.unavailableMessage())
                .isEqualTo("계단·에스컬레이터를 제외한 경로로는 도착지까지 이동할 수 없습니다.");
        assertThat(english.unavailableMessage())
                .isEqualTo("The destination cannot be reached without using stairs or escalators.");
        // 사유 코드는 언어와 무관하다. 클라이언트가 분기에 쓴다.
        assertThat(english.unavailableReason()).isEqualTo(korean.unavailableReason());
    }

    @Test
    @DisplayName("언어를 생략하면 영어로 내려간다")
    void defaultsToEnglishWhenLanguageOmitted() {
        givenActiveStation(1L);
        givenNodes(1L, node(1L), node(2L));
        givenEdges(1L, edge(1L, 1L, 2L, 10, RouteMoveType.STAIR));

        RouteOptionResponse option = indoorRouteService
                .getRouteOptions(optionsRequest(1L, 1L, 2L, null, null)).get(1);

        assertThat(option.unavailableMessage())
                .isEqualTo(RouteUnavailableReason.NO_ACCESSIBLE_ROUTE.messageFor(Language.DEFAULT));
    }

    @Test
    @DisplayName("이용 가능한 옵션에는 문구가 없다")
    void leavesUnavailableMessageNullWhenReachable() {
        givenActiveStation(1L);
        givenNodes(1L, node(1L), node(2L));
        givenEdges(1L, edge(1L, 1L, 2L, 10, RouteMoveType.WALKWAY));

        RouteOptionResponse option = indoorRouteService
                .getRouteOptions(optionsRequest(1L, 1L, 2L, null, Language.KO)).get(0);

        assertThat(option.available()).isTrue();
        assertThat(option.unavailableMessage()).isNull();
    }

    @Test
    @DisplayName("상세 경로도 이용 불가 문구를 요청 언어로 담는다")
    void putsUnavailableMessageOnDetailedRoute() {
        givenActiveStation(1L);
        givenNodes(1L, node(1L), node(2L));
        givenEdges(1L, edge(1L, 1L, 2L, 10, RouteMoveType.STAIR));

        RouteResponse route = indoorRouteService
                .createRoute(createRequest(1L, 1L, 2L, null, "elevator_only", Language.KO));

        assertThat(route.available()).isFalse();
        assertThat(route.unavailableMessage())
                .isEqualTo("계단·에스컬레이터를 제외한 경로로는 도착지까지 이동할 수 없습니다.");
    }

    @Test
    @DisplayName("상세 경로 생성은 steps와 pathNodes를 순서대로 조립한다")
    void createRouteAssemblesStepsAndPathNodes() {
        givenActiveStation(1L);
        givenNodes(1L, node(1L), node(2L), node(3L), node(4L));
        givenEdges(1L,
                edge(1L, 1L, 2L, 10, RouteMoveType.WALKWAY),
                edge(1L, 2L, 4L, 5, RouteMoveType.STAIR),
                edge(1L, 2L, 3L, 10, RouteMoveType.WALKWAY),
                edge(1L, 3L, 4L, 10, RouteMoveType.ELEVATOR));

        RouteResponse response =
                indoorRouteService.createRoute(createRequest(1L, 1L, 4L, null, "elevator_only", null));

        assertThat(response.routeType()).isEqualTo("elevator_only");
        assertThat(response.available()).isTrue();
        assertThat(response.totalDistanceM()).isEqualByComparingTo(BigDecimal.valueOf(30));
        assertThat(response.steps())
                .extracting(step -> step.order(), step -> step.fromNodeId(), step -> step.toNodeId())
                .containsExactly(
                        tuple(1, 1L, 2L),
                        tuple(2, 2L, 3L),
                        tuple(3, 3L, 4L));
        assertThat(response.pathNodes())
                .extracting(pathNode -> pathNode.nodeId())
                .containsExactly(1L, 2L, 3L, 4L);
    }

    @Test
    @DisplayName("경유지가 있으면 출발지에서 경유지를 거친 뒤 도착지까지 경로를 조립한다")
    void createRoutePassesThroughWaypoints() {
        givenActiveStation(1L);
        givenNodes(1L, node(1L), node(2L), node(3L), node(4L));
        givenEdges(1L,
                edge(1L, 1L, 4L, 5, RouteMoveType.WALKWAY, false),
                edge(1L, 1L, 2L, 10, RouteMoveType.WALKWAY),
                edge(1L, 2L, 3L, 10, RouteMoveType.WALKWAY),
                /* 수직 이동을 섞어 두는 것이 이 테스트의 관심사는 아니지만, 계단이어야 한다 —
                   `fastest` 는 엘리베이터를 제외하므로 그 간선으로는 도착지에 닿지 못한다. */
                edge(1L, 3L, 4L, 10, RouteMoveType.STAIR, false));

        RouteResponse response =
                indoorRouteService.createRoute(createRequest(
                        1L, 1L, 4L, List.of(3L), "fastest", null));

        assertThat(response.available()).isTrue();
        assertThat(response.totalDistanceM()).isEqualByComparingTo(BigDecimal.valueOf(30));
        assertThat(response.steps())
                .extracting(step -> step.order(), step -> step.fromNodeId(), step -> step.toNodeId())
                .containsExactly(
                        tuple(1, 1L, 2L),
                        tuple(2, 2L, 3L),
                        tuple(3, 3L, 4L));
        assertThat(response.pathNodes())
                .extracting(RoutePathNode::nodeId)
                .containsExactly(1L, 2L, 3L, 4L);
    }

    @Test
    @DisplayName("옵션 조회도 경유지 전체 구간의 거리와 계단 포함 여부를 계산한다")
    void getRouteOptionsUsesWaypoints() {
        givenActiveStation(1L);
        givenNodes(1L, node(1L), node(2L), node(3L), node(4L));
        givenEdges(1L,
                edge(1L, 1L, 2L, 10, RouteMoveType.WALKWAY),
                edge(1L, 2L, 3L, 10, RouteMoveType.STAIR),
                edge(1L, 3L, 4L, 10, RouteMoveType.WALKWAY));

        List<RouteOptionResponse> options =
                indoorRouteService.getRouteOptions(optionsRequest(1L, 1L, 4L, List.of(3L), null));

        assertThat(options.get(0).available()).isTrue();
        assertThat(options.get(0).totalDistanceM()).isEqualByComparingTo(BigDecimal.valueOf(30));
        assertThat(options.get(0).hasStairsOrEscalator()).isTrue();
        assertThat(options.get(1).available()).isFalse();
        assertThat(options.get(1).unavailableReason()).isEqualTo("NO_ACCESSIBLE_ROUTE");
    }

    @Test
    @DisplayName("도달할 수 없는 옵션은 available=false와 사유를 반환한다")
    void createRouteReturnsUnavailableWhenUnreachable() {
        givenActiveStation(1L);
        givenNodes(1L, node(1L), node(2L));
        givenEdges(1L, edge(1L, 1L, 2L, 10, RouteMoveType.STAIR));

        RouteResponse response =
                indoorRouteService.createRoute(createRequest(1L, 1L, 2L, null, "elevator_only", null));

        assertThat(response.available()).isFalse();
        assertThat(response.unavailableReason()).isEqualTo("NO_ACCESSIBLE_ROUTE");
        assertThat(response.steps()).isEmpty();
        assertThat(response.pathNodes()).isEmpty();
    }

    @Test
    @DisplayName("빠른 경로도 도달할 수 없으면 available=false와 NO_ROUTE를 반환한다")
    void createRouteReturnsNoRouteWhenFastestUnreachable() {
        givenActiveStation(1L);
        givenNodes(1L, node(1L), node(2L));
        givenEdges(1L, edge(1L, 1L, 5L, 10, RouteMoveType.WALKWAY)); // 목적지 2와 단절

        RouteResponse response =
                indoorRouteService.createRoute(createRequest(1L, 1L, 2L, null, "fastest", null));

        assertThat(response.available()).isFalse();
        assertThat(response.unavailableReason()).isEqualTo("NO_ROUTE");
        assertThat(response.steps()).isEmpty();
        assertThat(response.pathNodes()).isEmpty();
    }

    @Test
    @DisplayName("지원하지 않는 routeType이면 예외가 발생한다")
    void createRouteRejectsUnsupportedRouteType() {
        assertThatThrownBy(() ->
                indoorRouteService.createRoute(createRequest(1L, 1L, 2L, null, "flying", null)))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.UNSUPPORTED_ROUTE_TYPE));
    }

    @Test
    @DisplayName("존재하지 않는 역이면 예외가 발생한다")
    void getRouteOptionsRejectsUnknownStation() {
        when(stationRepository.findByIdAndActiveTrue(1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() ->
                indoorRouteService.getRouteOptions(optionsRequest(1L, 1L, 4L, null, null)))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.STATION_NOT_FOUND));
    }

    @Test
    @DisplayName("출발 노드가 역에 속하지 않으면 예외가 발생한다")
    void getRouteOptionsRejectsNodeNotInStation() {
        givenActiveStation(1L);
        givenNodes(1L, node(2L), node(4L)); // 출발 노드 1 없음

        assertThatThrownBy(() ->
                indoorRouteService.getRouteOptions(optionsRequest(1L, 1L, 4L, null, null)))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.ROUTE_NODE_NOT_FOUND));
    }

    @Test
    @DisplayName("경유지 노드가 역에 속하지 않으면 예외가 발생한다")
    void getRouteOptionsRejectsWaypointNotInStation() {
        givenActiveStation(1L);
        givenNodes(1L, node(1L), node(4L)); // 경유지 노드 3 없음

        assertThatThrownBy(() ->
                indoorRouteService.getRouteOptions(optionsRequest(1L, 1L, 4L, List.of(3L), null)))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.ROUTE_NODE_NOT_FOUND));
    }

    /**
     * 목적지 반대쪽 노드가 더 가깝더라도 총 거리가 짧은 쪽을 진입점으로 삼는다.
     *
     * <p>역삼역 B3 에서 3번 출구로 갈 때 실제로 겪은 모양을 줄여 옮겼다. 사용자는 노드 2와 3
     * 사이에 있고 노드 2가 조금 더 가깝지만, 목적지(4)로 가려면 노드 3을 거쳐야 한다.
     *
     * <pre>
     *   2(0,0) --- 사용자(6,0) --- 3(10,0) --- 4(30,0)
     *   가까운 쪽 2로 가면  6 + 10 + 20 = 36
     *   3으로 가면          4 +      20 = 24
     * </pre>
     */
    @Test
    @DisplayName("현재 좌표를 주면 목적지까지 총 거리가 짧은 노드를 진입점으로 고른다")
    void choosesEntryNodeByTotalDistance() {
        givenActiveStation(1L);
        givenNodes(1L, nodeAt(2L, 0, 0), nodeAt(3L, 10, 0), nodeAt(4L, 30, 0));
        givenEdges(1L,
                edge(1L, 2L, 3L, 10, RouteMoveType.WALKWAY),
                edge(1L, 3L, 4L, 20, RouteMoveType.WALKWAY));
        givenFloors(1L, new long[] {1L});

        RouteResponse response = indoorRouteService.createRoute(new RouteCreateRequest(
                1L, 2L, 4L, null, "fastest", Language.KO,
                new BigDecimal("6.0"), new BigDecimal("0.0")));

        assertThat(response.startNodeId()).isEqualTo(3L);
        assertThat(response.totalDistanceM()).isEqualByComparingTo("20");
    }

    @Test
    @DisplayName("현재 좌표가 없으면 요청에 온 진입 노드를 그대로 쓴다")
    void keepsRequestedEntryNodeWithoutPosition() {
        givenActiveStation(1L);
        givenNodes(1L, nodeAt(2L, 0, 0), nodeAt(3L, 10, 0), nodeAt(4L, 30, 0));
        givenEdges(1L,
                edge(1L, 2L, 3L, 10, RouteMoveType.WALKWAY),
                edge(1L, 3L, 4L, 20, RouteMoveType.WALKWAY));
        givenFloors(1L, new long[] {1L});

        RouteResponse response = indoorRouteService.createRoute(
                createRequest(1L, 2L, 4L, null, "fastest", Language.KO));

        assertThat(response.startNodeId()).isEqualTo(2L);
        assertThat(response.totalDistanceM()).isEqualByComparingTo("30");
    }

    /**
     * 시설 노드는 통로에 매달린 끝점이라 경로가 거기서 시작하면 안내가 "교통카드 충전기에서
     * 출발"처럼 읽힌다. 사용자가 실제로 서 있는 곳은 그 앞 통로다. (S15P11A206-345)
     */
    @Test
    @DisplayName("시설 노드는 진입점 후보에서 빠지고 복도 노드가 뽑힌다")
    void picksCorridorNodeOverFacilityNode() {
        givenActiveStation(1L);
        givenNodes(1L,
                nodeAt(2L, 0, 0),
                // 사용자 바로 옆이지만 시설이다. 통로로 되돌아 나와야 하므로 진입점이 아니다.
                landmarkAt(5L, 9, 1),
                nodeAt(3L, 10, 0),
                nodeAt(4L, 30, 0));
        givenEdges(1L,
                edge(1L, 2L, 3L, 10, RouteMoveType.WALKWAY),
                edge(1L, 3L, 4L, 20, RouteMoveType.WALKWAY),
                edge(1L, 5L, 3L, 1, RouteMoveType.WALKWAY));
        givenFloors(1L, new long[] {1L});

        RouteResponse response = indoorRouteService.createRoute(new RouteCreateRequest(
                1L, 2L, 4L, null, "fastest", Language.KO,
                new BigDecimal("9.0"), new BigDecimal("1.0")));

        assertThat(response.startNodeId()).isEqualTo(3L);
        assertThat(response.totalDistanceM()).isEqualByComparingTo("20");
    }

    /**
     * {@code elevator_only} 는 계단 간선을 쓰지 않으므로 그 간선으로만 목적지에 닿는 노드는
     * 진입점 후보가 될 수 없다. 후보에서 빠지지 않으면 도달 불가한 노드에서 출발하게 된다.
     */
    @Test
    @DisplayName("경로 유형에서 목적지에 닿지 못하는 노드는 진입점 후보에서 빠진다")
    void skipsUnreachableEntryNodeForRouteType() {
        givenActiveStation(1L);
        givenNodes(1L, nodeAt(2L, 0, 0), nodeAt(3L, 10, 0), nodeAt(4L, 30, 0), nodeAt(5L, 7, 0));
        givenEdges(1L,
                edge(1L, 2L, 3L, 10, RouteMoveType.WALKWAY),
                edge(1L, 3L, 4L, 20, RouteMoveType.WALKWAY),
                // 5는 사용자와 가장 가깝지만 계단으로만 목적지에 닿는다
                edge(1L, 5L, 4L, 1, RouteMoveType.STAIR));
        givenFloors(1L, new long[] {1L});

        RouteResponse response = indoorRouteService.createRoute(new RouteCreateRequest(
                1L, 2L, 4L, null, "elevator_only", Language.KO,
                new BigDecimal("6.0"), new BigDecimal("0.0")));

        assertThat(response.startNodeId()).isEqualTo(3L);
    }

    /**
     * 같은 층이어도 걸어갈 수 없는 노드는 진입점이 될 수 없다.
     *
     * <p>역삼역 B3 를 줄여 옮겼다. 선로 양쪽에 승강장이 있고 그 둘은 같은 층인데 간선이 없다.
     * 건너가려면 위층(2)으로 올라갔다 내려와야 한다. 사용자는 아래쪽 승강장에 서 있다.
     *
     * <pre>
     *   위층      12 ------------- 13 --- 목적지 14
     *              |                |
     *   B측 2 --- 3(계단)      건너편 22 --- 23(계단)
     *        사용자(6,0)
     * </pre>
     *
     * <p>건너편 22 는 직선으로 가깝고(사용자에서 9.2m) 목적지까지 그래프 거리도 짧아 예전
     * 비용식으로는 뽑혔다. 그러나 B3 간선만으로는 거기 갈 수 없다. (S15P11A206-338)
     */
    @Test
    @DisplayName("같은 층이어도 그 층 간선으로 닿지 못하는 노드는 진입점 후보에서 빠진다")
    void skipsEntryNodeAcrossDisconnectedPlatform() {
        givenActiveStation(1L);
        givenNodes(1L,
                nodeAt(2L, 0, 0), nodeAt(3L, 10, 0),          // 사용자가 선 승강장
                nodeAt(22L, 10, 9), nodeAt(23L, 20, 9),       // 선로 건너편 승강장 (간선으로 안 이어짐)
                nodeAtFloor(12L, 2L, 10, 0), nodeAtFloor(13L, 2L, 20, 9), nodeAtFloor(14L, 2L, 30, 9));
        givenEdges(1L,
                edge(1L, 2L, 3L, 10, RouteMoveType.WALKWAY),
                edge(1L, 22L, 23L, 10, RouteMoveType.WALKWAY),
                // 두 승강장은 위층을 거쳐서만 이어진다
                edge(1L, 3L, 12L, 5, RouteMoveType.STAIR),
                edge(1L, 23L, 13L, 5, RouteMoveType.STAIR),
                edge(1L, 12L, 13L, 14, RouteMoveType.WALKWAY),
                edge(1L, 13L, 14L, 10, RouteMoveType.WALKWAY));
        givenFloors(1L, new long[] {2L, 1L});

        RouteResponse response = indoorRouteService.createRoute(new RouteCreateRequest(
                1L, 2L, 14L, null, "fastest", Language.KO,
                new BigDecimal("6.0"), new BigDecimal("0.0")));

        assertThat(response.startNodeId()).isIn(2L, 3L);
        assertThat(response.pathNodes())
                .extracting(RoutePathNode::nodeId)
                .doesNotContain(22L, 23L);
    }

    /**
     * 직선 구간이 길면 후보에서 빠진다.
     *
     * <p>직선은 그래프 경로의 하한이라 미터당 싸다. 그래서 상한이 없으면 목적지 쪽으로 멀리 있는
     * 노드가 이긴다 — 걸어서 갈 수 없는 지름길을 태우는 셈이다.
     *
     * <p>3 과 4 사이 통로는 굽어 있어 걸어서 70m 인데 직선으로는 50m 다. 그래서 직선을 길게
     * 쓰는 4 쪽이 상한 없이는 이긴다.
     *
     * <pre>
     *   2(0,0) --- 3(10,0) ==== 굽은 통로 70m ==== 4(60,0) --- 목적지 5(70,0)
     *   사용자(6,0)
     *
     *   상한 없이:  4 로  54 + 10 = 64   &lt;- 54m 를 순간이동한다
     *              3 으로  4 + 80 = 84
     *   상한 15m:   4 는 후보에서 빠지고 3 이 남는다
     * </pre>
     */
    @Test
    @DisplayName("직선으로 상한을 넘게 떨어진 노드는 진입점 후보에서 빠진다")
    void skipsEntryNodeBeyondStraightLimit() {
        givenActiveStation(1L);
        givenNodes(1L, nodeAt(2L, 0, 0), nodeAt(3L, 10, 0), nodeAt(4L, 60, 0), nodeAt(5L, 70, 0));
        givenEdges(1L,
                edge(1L, 2L, 3L, 10, RouteMoveType.WALKWAY),
                edge(1L, 3L, 4L, 70, RouteMoveType.WALKWAY),
                edge(1L, 4L, 5L, 10, RouteMoveType.WALKWAY));
        givenFloors(1L, new long[] {1L});

        RouteResponse response = indoorRouteService.createRoute(new RouteCreateRequest(
                1L, 2L, 5L, null, "fastest", Language.KO,
                new BigDecimal("6.0"), new BigDecimal("0.0")));

        assertThat(response.startNodeId()).isEqualTo(3L);
        assertThat(response.totalDistanceM()).isEqualByComparingTo("80");
    }

    /**
     * 간선이 없는 노드를 가리켜도 진입 노드 선택은 깨지지 않는다.
     *
     * <p>리뷰에서 나온 우려다 — {@code withChosenEntry} 가 {@code data.nodes()::get} 으로 노드를
     * 꺼내니, 간선에는 있는데 노드 맵에는 없는 id 가 섞이면 {@code null} 이 흘러 NPE 가 난다는
     * 것이다. 실제로는 후보를 {@code sameFloor} 로 거르고 그 집합을 <b>노드 맵에서</b> 만들기
     * 때문에 그런 id 는 {@code reachableWithin} 의 {@code allowedNodeIds.contains(next)} 에서
     * 이미 떨어진다.
     *
     * <p>그 불변식을 여기서 붙잡아 둔다. {@code sameFloor} 를 간선 기준으로 바꾸는 변경이
     * 들어오면 이 테스트가 먼저 깨진다.
     */
    @Test
    @DisplayName("간선이 노드 맵에 없는 id를 가리켜도 진입 노드를 고른다")
    void ignoresEdgesPointingAtUnknownNodes() {
        givenActiveStation(1L);
        givenNodes(1L, nodeAt(2L, 0, 0), nodeAt(3L, 10, 0), nodeAt(5L, 20, 0));
        givenEdges(1L,
                edge(1L, 2L, 3L, 10, RouteMoveType.WALKWAY),
                edge(1L, 3L, 5L, 10, RouteMoveType.WALKWAY),
                // 노드 99는 givenNodes 에 없다. 정합성이 깨진 간선을 흉내낸다.
                edge(1L, 3L, 99L, 1, RouteMoveType.WALKWAY));
        givenFloors(1L, new long[] {1L});

        RouteResponse response = indoorRouteService.createRoute(new RouteCreateRequest(
                1L, 2L, 5L, null, "fastest", Language.KO,
                new BigDecimal("9.0"), new BigDecimal("0.0")));

        assertThat(response.startNodeId()).isEqualTo(3L);
        assertThat(response.pathNodes())
                .extracting(RoutePathNode::nodeId)
                .doesNotContain(99L);
    }

    @Test
    @DisplayName("상세 경로 안내에 회전과 층 이동 방향이 실린다")
    void writesTurnAndFloorDirection() {
        givenActiveStation(1L);
        givenNodes(1L, nodeAt(1L, 0, 0), nodeAt(2L, 10, 0), nodeAt(3L, 10, 12), nodeAtFloor(4L, 2L, 10, 12));
        givenEdges(1L,
                edge(1L, 1L, 2L, 10, RouteMoveType.WALKWAY),
                edge(1L, 2L, 3L, 12, RouteMoveType.WALKWAY),
                edge(1L, 3L, 4L, 5, RouteMoveType.STAIR));
        givenFloors(1L, new long[] {1L, 2L});

        RouteResponse response = indoorRouteService.createRoute(
                createRequest(1L, 1L, 4L, null, "fastest", Language.KO));

        assertThat(response.steps())
                .extracting(RouteStep::instruction)
                .containsExactly(
                        "10m 직진하세요.",
                        "오른쪽으로 돌아 12m 이동하세요.",
                        "계단으로 한 층 내려가세요.");
    }

    /**
     * 연달아 직진하는 통로는 한 안내로 묶인다(S15P11A206-339).
     *
     * <p>간선 하나가 안내 하나면 긴 통로에서 같은 문장이 되풀이된다. 역삼역 승강장은 복도 노드가
     * 평균 7.7m 마다 있어 B3 서쪽 끝에서 8번 출구까지 "직진하세요" 가 11번 연달아 나왔다.
     *
     * <p><b>{@code pathNodes} 는 묶지 않는다.</b> 지도가 꼭짓점을 다 필요로 한다.
     */
    @Test
    @DisplayName("곧게 이어지는 통로를 한 안내로 묶고 거리와 시간을 합친다")
    void mergesStraightWalkwayIntoOneStep() {
        givenActiveStation(1L);
        givenNodes(1L, nodeAt(1L, 0, 0), nodeAt(2L, 20, 0), nodeAt(3L, 45, 0), nodeAt(4L, 70, 0));
        givenEdges(1L,
                timedEdge(1L, 1L, 2L, 20, 16, RouteMoveType.WALKWAY),
                timedEdge(1L, 2L, 3L, 25, 20, RouteMoveType.WALKWAY),
                timedEdge(1L, 3L, 4L, 25, 20, RouteMoveType.WALKWAY));
        givenFloors(1L, new long[] {1L});

        RouteResponse response = indoorRouteService.createRoute(
                createRequest(1L, 1L, 4L, null, "fastest", Language.KO));

        assertThat(response.steps()).hasSize(1);
        assertThat(response.steps().get(0))
                .satisfies(step -> {
                    assertThat(step.instruction()).isEqualTo("70m 직진하세요.");
                    assertThat(step.distanceM()).isEqualByComparingTo("70");
                    assertThat(step.estimatedTimeSec()).isEqualTo(56);
                    // 묶은 구간의 처음과 끝이다. 중간 노드 2·3은 step 이 아니라 pathNodes 로만 남는다.
                    assertThat(step.fromNodeId()).isEqualTo(1L);
                    assertThat(step.toNodeId()).isEqualTo(4L);
                });
        assertThat(response.pathNodes())
                .extracting(RoutePathNode::nodeId)
                .containsExactly(1L, 2L, 3L, 4L);
    }

    @Test
    @DisplayName("꺾이는 곳과 층 이동에서는 안내를 끊는다")
    void keepsStepsSeparateAtTurnAndFloorChange() {
        givenActiveStation(1L);
        givenNodes(1L, nodeAt(1L, 0, 0), nodeAt(2L, 20, 0), nodeAt(3L, 45, 0),
                nodeAt(4L, 45, 25), nodeAtFloor(5L, 2L, 45, 25));
        givenEdges(1L,
                edge(1L, 1L, 2L, 20, RouteMoveType.WALKWAY),
                edge(1L, 2L, 3L, 25, RouteMoveType.WALKWAY),   // 여기까지 직진
                edge(1L, 3L, 4L, 25, RouteMoveType.WALKWAY),   // 남쪽으로 90도
                edge(1L, 4L, 5L, 5, RouteMoveType.STAIR));
        givenFloors(1L, new long[] {2L, 1L});

        RouteResponse response = indoorRouteService.createRoute(
                createRequest(1L, 1L, 5L, null, "fastest", Language.KO));

        assertThat(response.steps())
                .extracting(RouteStep::instruction)
                .containsExactly(
                        "45m 직진하세요.",
                        "오른쪽으로 돌아 25m 이동하세요.",
                        "계단으로 한 층 올라가세요.");
    }

    /**
     * 시간을 모르는 간선이 섞이면 묶은 안내의 시간도 비운다.
     *
     * <p>있는 것만 더하면 실제보다 짧은 수가 나가는데 받는 쪽은 부분 합인지 알 수 없다. 경로 총
     * 시간도 같은 규칙이다.
     */
    @Test
    @DisplayName("묶은 구간 중 시간을 모르는 간선이 있으면 그 안내의 시간은 비운다")
    void leavesMergedTimeNullWhenAnyEdgeHasNoTime() {
        givenActiveStation(1L);
        givenNodes(1L, nodeAt(1L, 0, 0), nodeAt(2L, 20, 0), nodeAt(3L, 45, 0));
        givenEdges(1L,
                timedEdge(1L, 1L, 2L, 20, 16, RouteMoveType.WALKWAY),
                edge(1L, 2L, 3L, 25, RouteMoveType.WALKWAY));   // 시간 없음
        givenFloors(1L, new long[] {1L});

        RouteResponse response = indoorRouteService.createRoute(
                createRequest(1L, 1L, 3L, null, "fastest", Language.KO));

        assertThat(response.steps()).hasSize(1);
        assertThat(response.steps().get(0).distanceM()).isEqualByComparingTo("45");
        assertThat(response.steps().get(0).estimatedTimeSec()).isNull();
        assertThat(response.estimatedTimeSec()).isNull();
    }

    @Test
    @DisplayName("언어가 한국어가 아니면 안내가 영어로 나온다")
    void writesEnglishInstructions() {
        givenActiveStation(1L);
        givenNodes(1L, nodeAt(1L, 0, 0), nodeAt(2L, 10, 0));
        givenEdges(1L, edge(1L, 1L, 2L, 10, RouteMoveType.WALKWAY));
        givenFloors(1L, new long[] {1L});

        RouteResponse response = indoorRouteService.createRoute(
                createRequest(1L, 1L, 2L, null, "fastest", Language.EN));

        assertThat(response.steps())
                .extracting(RouteStep::instruction)
                .containsExactly("Go straight for 10m.");
    }

    /** 현재 좌표 없이 보내는 요청. 좌표는 선택이라 대부분의 시나리오가 이 형태다. */
    private RouteOptionsRequest optionsRequest(
            Long stationId, Long startNodeId, Long targetNodeId, List<Long> waypointNodeIds, Language language) {
        return new RouteOptionsRequest(stationId, startNodeId, targetNodeId, waypointNodeIds, language, null, null);
    }

    private RouteCreateRequest createRequest(
            Long stationId,
            Long startNodeId,
            Long targetNodeId,
            List<Long> waypointNodeIds,
            String routeType,
            Language language) {
        return new RouteCreateRequest(
                stationId, startNodeId, targetNodeId, waypointNodeIds, routeType, language, null, null);
    }

    private void givenActiveStation(long stationId) {
        when(stationRepository.findByIdAndActiveTrue(stationId)).thenReturn(Optional.of(station(stationId)));
    }

    private void givenNodes(long stationId, RouteNode... nodes) {
        when(routeNodeRepository.search(stationId, null)).thenReturn(List.of(nodes));
    }

    private void givenEdges(long stationId, RouteEdge... edges) {
        when(routeEdgeRepository.findAllByStationIdAndActiveTrueOrderByIdAsc(stationId)).thenReturn(List.of(edges));
    }

    private Station station(long id) {
        Station station = Station.create("테스트역", "Test", "1호선", new BigDecimal("37.5"), new BigDecimal("127.0"));
        ReflectionTestUtils.setField(station, "id", id);
        return station;
    }

    private RouteNode node(long id) {
        RouteNode node = RouteNode.create(1L, 1L, "normal", "노드" + id,
                new BigDecimal("10.0"), new BigDecimal("20.0"), null, false);
        ReflectionTestUtils.setField(node, "id", id);
        return node;
    }

    private RouteNode nodeAt(long id, double x, double y) {
        return nodeAtFloor(id, 1L, x, y);
    }

    private RouteNode nodeAtFloor(long id, long floorId, double x, double y) {
        RouteNode node = RouteNode.create(1L, floorId, "normal", "노드" + id,
                BigDecimal.valueOf(x), BigDecimal.valueOf(y), null, false);
        ReflectionTestUtils.setField(node, "id", id);
        return node;
    }

    /** 시설 노드. {@code is_landmark} 가 복도와 시설을 가른다. */
    private RouteNode landmarkAt(long id, double x, double y) {
        RouteNode node = RouteNode.create(1L, 1L, "facility", "시설" + id,
                BigDecimal.valueOf(x), BigDecimal.valueOf(y), null, true);
        ReflectionTestUtils.setField(node, "id", id);
        return node;
    }

    /** 층 순서는 위층이 작다. 넘긴 순서대로 1부터 매긴다. */
    private void givenFloors(long stationId, long[] floorIds) {
        List<StationFloor> floors = new ArrayList<>();
        long[] ids = floorIds;
        for (int i = 0; i < ids.length; i++) {
            StationFloor floor = StationFloor.create(
                    station(stationId), "B" + (i + 1), "지하" + (i + 1) + "층", i + 1, null);
            ReflectionTestUtils.setField(floor, "id", ids[i]);
            floors.add(floor);
        }
        when(stationFloorRepository.findAllByStationIdOrderByFloorOrderAsc(stationId)).thenReturn(floors);
    }

    private RouteEdge edge(long stationId, long fromNodeId, long toNodeId, long distanceM, RouteMoveType moveType) {
        return edge(stationId, fromNodeId, toNodeId, distanceM, moveType, true);
    }

    /**
     * 예상 시간이 있는 간선. {@link #edge} 는 시간을 비워 두므로 시간을 검증할 때 이것을 쓴다.
     *
     * <p>역삼역 시드 간선 205개는 전부 시간이 들어 있다. 시간이 빈 간선은 관리자가 그렇게 만든
     * 경우다 — {@code RouteEdgeCreateRequest.estimatedTimeSec} 가 필수가 아니다.
     */
    private RouteEdge timedEdge(
            long stationId, long fromNodeId, long toNodeId, long distanceM, int seconds, RouteMoveType moveType) {
        return RouteEdge.create(stationId, fromNodeId, toNodeId, BigDecimal.valueOf(distanceM),
                seconds, moveType.getCode(), true, true);
    }

    private RouteEdge edge(
            long stationId,
            long fromNodeId,
            long toNodeId,
            long distanceM,
            RouteMoveType moveType,
            boolean bidirectional
    ) {
        return RouteEdge.create(stationId, fromNodeId, toNodeId, BigDecimal.valueOf(distanceM),
                null, moveType.getCode(), true, bidirectional);
    }
}

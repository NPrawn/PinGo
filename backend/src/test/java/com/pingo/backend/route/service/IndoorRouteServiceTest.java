package com.pingo.backend.route.service;

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

    private IndoorRouteService indoorRouteService;

    @BeforeEach
    void setUp() {
        indoorRouteService = new IndoorRouteService(
                routeNodeRepository,
                routeEdgeRepository,
                stationRepository,
                stationFloorRepository,
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
                edge(1L, 3L, 4L, 10, RouteMoveType.ELEVATOR, false));

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

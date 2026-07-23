package com.pingo.backend.route.service;

import com.pingo.backend.global.exception.BusinessException;
import com.pingo.backend.global.exception.ErrorCode;
import com.pingo.backend.route.domain.RouteEdge;
import com.pingo.backend.route.domain.RouteMoveType;
import com.pingo.backend.route.domain.RouteNode;
import com.pingo.backend.route.dto.request.RouteCreateRequest;
import com.pingo.backend.route.dto.request.RouteOptionsRequest;
import com.pingo.backend.route.dto.response.RouteOptionResponse;
import com.pingo.backend.route.dto.response.RouteResponse;
import com.pingo.backend.route.repository.RouteEdgeRepository;
import com.pingo.backend.route.repository.RouteNodeRepository;
import com.pingo.backend.station.domain.Station;
import com.pingo.backend.station.repository.StationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
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

    private IndoorRouteService indoorRouteService;

    @BeforeEach
    void setUp() {
        indoorRouteService = new IndoorRouteService(
                routeNodeRepository, routeEdgeRepository, stationRepository, new RouteFinder());
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
                indoorRouteService.getRouteOptions(new RouteOptionsRequest(1L, 1L, 4L));

        assertThat(options)
                .extracting(RouteOptionResponse::routeType, RouteOptionResponse::available)
                .containsExactly(
                        tuple("fastest", true),
                        tuple("elevator_only", true));
        assertThat(options.get(0).totalDistanceM()).isEqualByComparingTo(BigDecimal.valueOf(15));
        assertThat(options.get(1).totalDistanceM()).isEqualByComparingTo(BigDecimal.valueOf(30));
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
                indoorRouteService.createRoute(new RouteCreateRequest(1L, 1L, 4L, "elevator_only"));

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
    @DisplayName("도달할 수 없는 옵션은 available=false와 사유를 반환한다")
    void createRouteReturnsUnavailableWhenUnreachable() {
        givenActiveStation(1L);
        givenNodes(1L, node(1L), node(2L));
        givenEdges(1L, edge(1L, 1L, 2L, 10, RouteMoveType.STAIR));

        RouteResponse response =
                indoorRouteService.createRoute(new RouteCreateRequest(1L, 1L, 2L, "elevator_only"));

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
                indoorRouteService.createRoute(new RouteCreateRequest(1L, 1L, 2L, "fastest"));

        assertThat(response.available()).isFalse();
        assertThat(response.unavailableReason()).isEqualTo("NO_ROUTE");
        assertThat(response.steps()).isEmpty();
        assertThat(response.pathNodes()).isEmpty();
    }

    @Test
    @DisplayName("지원하지 않는 routeType이면 예외가 발생한다")
    void createRouteRejectsUnsupportedRouteType() {
        assertThatThrownBy(() ->
                indoorRouteService.createRoute(new RouteCreateRequest(1L, 1L, 2L, "flying")))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.UNSUPPORTED_ROUTE_TYPE));
    }

    @Test
    @DisplayName("존재하지 않는 역이면 예외가 발생한다")
    void getRouteOptionsRejectsUnknownStation() {
        when(stationRepository.findByIdAndActiveTrue(1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() ->
                indoorRouteService.getRouteOptions(new RouteOptionsRequest(1L, 1L, 4L)))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.STATION_NOT_FOUND));
    }

    @Test
    @DisplayName("출발 노드가 역에 속하지 않으면 예외가 발생한다")
    void getRouteOptionsRejectsNodeNotInStation() {
        givenActiveStation(1L);
        givenNodes(1L, node(2L), node(4L)); // 출발 노드 1 없음

        assertThatThrownBy(() ->
                indoorRouteService.getRouteOptions(new RouteOptionsRequest(1L, 1L, 4L)))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.ROUTE_NODE_NOT_FOUND));
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
                new BigDecimal("10.0"), new BigDecimal("20.0"), false);
        ReflectionTestUtils.setField(node, "id", id);
        return node;
    }

    private RouteEdge edge(long stationId, long fromNodeId, long toNodeId, long distanceM, RouteMoveType moveType) {
        return RouteEdge.create(stationId, fromNodeId, toNodeId, BigDecimal.valueOf(distanceM),
                null, moveType.getCode(), true, true);
    }
}

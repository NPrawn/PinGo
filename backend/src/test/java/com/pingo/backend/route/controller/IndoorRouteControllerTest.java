package com.pingo.backend.route.controller;

import com.pingo.backend.global.exception.GlobalExceptionHandler;
import com.pingo.backend.route.domain.RouteType;
import com.pingo.backend.route.domain.RouteUnavailableReason;
import com.pingo.backend.route.dto.response.RouteOptionResponse;
import com.pingo.backend.route.dto.response.RoutePathNode;
import com.pingo.backend.route.dto.response.RouteResponse;
import com.pingo.backend.route.dto.response.RouteStep;
import com.pingo.backend.route.service.IndoorRouteService;
import com.pingo.backend.usersession.domain.Language;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.math.BigDecimal;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class IndoorRouteControllerTest {

    @Mock
    private IndoorRouteService indoorRouteService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        IndoorRouteController controller = new IndoorRouteController(indoorRouteService);
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    @DisplayName("옵션 조회 정상 요청은 200과 옵션 목록을 반환한다")
    void getRouteOptionsReturnsOptions() throws Exception {
        when(indoorRouteService.getRouteOptions(any())).thenReturn(List.of(
                RouteOptionResponse.available(RouteType.FASTEST, BigDecimal.valueOf(15), 240, true),
                RouteOptionResponse.unavailable(RouteType.ELEVATOR_ONLY,
                        RouteUnavailableReason.NO_ACCESSIBLE_ROUTE, Language.KO)));

        mockMvc.perform(post("/api/routes/indoor/options")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"stationId":1,"startNodeId":1,"targetNodeId":4,"language":"ko"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].routeType").value("fastest"))
                .andExpect(jsonPath("$.data[0].available").value(true))
                .andExpect(jsonPath("$.data[0].hasStairsOrEscalator").value(true))
                // 이용 가능하면 문구가 없어야 한다. 빈 문자열이 아니라 null 이다.
                .andExpect(jsonPath("$.data[0].unavailableMessage").isEmpty())
                .andExpect(jsonPath("$.data[1].routeType").value("elevator_only"))
                .andExpect(jsonPath("$.data[1].available").value(false))
                .andExpect(jsonPath("$.data[1].unavailableReason").value("NO_ACCESSIBLE_ROUTE"))
                .andExpect(jsonPath("$.data[1].unavailableMessage")
                        .value("계단·에스컬레이터를 제외한 경로로는 도착지까지 이동할 수 없습니다."))
                .andExpect(jsonPath("$.data[1].hasStairsOrEscalator").value(false));
    }

    @Test
    @DisplayName("상세 경로 생성 정상 요청은 200과 steps·pathNodes를 반환한다")
    void createRouteReturnsRoute() throws Exception {
        RouteResponse response = RouteResponse.available(
                RouteType.FASTEST, 1L, 4L, BigDecimal.valueOf(15), 240,
                List.of(new RouteStep(
                        1, 1L, 2L, BigDecimal.valueOf(10), 120, "walkway", "10m 직진하세요.", "straight", null)),
                List.of(new RoutePathNode(
                        1L, 1L, BigDecimal.valueOf(10), BigDecimal.valueOf(20), BigDecimal.valueOf(5))));
        when(indoorRouteService.createRoute(any())).thenReturn(response);

        mockMvc.perform(post("/api/routes/indoor")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"stationId":1,"startNodeId":1,"targetNodeId":4,"routeType":"fastest"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.routeType").value("fastest"))
                .andExpect(jsonPath("$.data.available").value(true))
                .andExpect(jsonPath("$.data.steps[0].order").value(1))
                .andExpect(jsonPath("$.data.pathNodes[0].nodeId").value(1L))
                // 같은 층 안에서 높이가 갈리는 구간(역삼역 B0.5)을 FE 가 구분하려면 필요하다.
                .andExpect(jsonPath("$.data.pathNodes[0].mapZ").value(5));
    }

    @Test
    @DisplayName("필수 값이 누락되면 400과 INVALID_REQUEST를 반환한다")
    void createRouteRejectsMissingField() throws Exception {
        mockMvc.perform(post("/api/routes/indoor")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"stationId":1,"targetNodeId":4,"routeType":"fastest"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }

    @Test
    @DisplayName("경유지가 10개를 초과하면 400과 INVALID_REQUEST를 반환한다")
    void createRouteRejectsTooManyWaypoints() throws Exception {
        mockMvc.perform(post("/api/routes/indoor")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "stationId":1,
                                  "startNodeId":1,
                                  "targetNodeId":4,
                                  "waypointNodeIds":[10,11,12,13,14,15,16,17,18,19,20],
                                  "routeType":"fastest"
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));

        verifyNoInteractions(indoorRouteService);
    }

    @Test
    @DisplayName("경유지 목록에 null이 있으면 400과 INVALID_REQUEST를 반환한다")
    void getRouteOptionsRejectsNullWaypoint() throws Exception {
        mockMvc.perform(post("/api/routes/indoor/options")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "stationId":1,
                                  "startNodeId":1,
                                  "targetNodeId":4,
                                  "waypointNodeIds":[2,null,3]
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));

        verifyNoInteractions(indoorRouteService);
    }
}

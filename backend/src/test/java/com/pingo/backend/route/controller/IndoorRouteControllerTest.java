package com.pingo.backend.route.controller;

import com.pingo.backend.global.exception.GlobalExceptionHandler;
import com.pingo.backend.route.domain.RouteType;
import com.pingo.backend.route.domain.RouteUnavailableReason;
import com.pingo.backend.route.dto.response.RouteOptionResponse;
import com.pingo.backend.route.dto.response.RoutePathNode;
import com.pingo.backend.route.dto.response.RouteResponse;
import com.pingo.backend.route.dto.response.RouteStep;
import com.pingo.backend.route.service.IndoorRouteService;
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
                RouteOptionResponse.available(RouteType.FASTEST, BigDecimal.valueOf(15), 240),
                RouteOptionResponse.unavailable(RouteType.ELEVATOR_ONLY,
                        RouteUnavailableReason.NO_ACCESSIBLE_ROUTE)));

        mockMvc.perform(post("/api/routes/indoor/options")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"stationId":1,"startNodeId":1,"targetNodeId":4}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].routeType").value("fastest"))
                .andExpect(jsonPath("$.data[0].available").value(true))
                .andExpect(jsonPath("$.data[1].routeType").value("elevator_only"))
                .andExpect(jsonPath("$.data[1].available").value(false))
                .andExpect(jsonPath("$.data[1].unavailableReason").value("NO_ACCESSIBLE_ROUTE"));
    }

    @Test
    @DisplayName("상세 경로 생성 정상 요청은 200과 steps·pathNodes를 반환한다")
    void createRouteReturnsRoute() throws Exception {
        RouteResponse response = RouteResponse.available(
                RouteType.FASTEST, 1L, 4L, BigDecimal.valueOf(15), 240,
                List.of(new RouteStep(1, 1L, 2L, BigDecimal.valueOf(10), 120, "walkway", "10m 직진하세요.")),
                List.of(new RoutePathNode(1L, 1L, BigDecimal.valueOf(10), BigDecimal.valueOf(20))));
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
                .andExpect(jsonPath("$.data.pathNodes[0].nodeId").value(1L));
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
}

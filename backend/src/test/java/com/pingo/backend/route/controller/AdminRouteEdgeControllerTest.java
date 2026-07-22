package com.pingo.backend.route.controller;

import com.pingo.backend.global.exception.GlobalExceptionHandler;
import com.pingo.backend.route.dto.request.RouteEdgeCreateRequest;
import com.pingo.backend.route.dto.response.RouteEdgeIdResponse;
import com.pingo.backend.route.dto.response.RouteEdgeResponse;
import com.pingo.backend.route.service.RouteService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class AdminRouteEdgeControllerTest {

    @Mock
    private RouteService routeService;

    private MockMvc mockMvc;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        AdminRouteEdgeController controller = new AdminRouteEdgeController(routeService);
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
        objectMapper = new ObjectMapper();
    }

    @Test
    void createEdgeReturnsCreatedResponse() throws Exception {
        RouteEdgeCreateRequest request = new RouteEdgeCreateRequest(
                1L, 20L, 21L, new BigDecimal("20"), 30, "walkway", true, true);
        when(routeService.createEdge(any(RouteEdgeCreateRequest.class)))
                .thenReturn(new RouteEdgeIdResponse(30L));

        mockMvc.perform(post("/api/admin/route-edges")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.edgeId").value(30L));
    }

    @Test
    void createEdgeReturnsBadRequestWhenDistanceMissing() throws Exception {
        RouteEdgeCreateRequest request = new RouteEdgeCreateRequest(
                1L, 20L, 21L, null, 30, "walkway", true, true);

        mockMvc.perform(post("/api/admin/route-edges")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }

    @Test
    void getEdgesReturnsList() throws Exception {
        when(routeService.getEdges(1L)).thenReturn(List.of(
                new RouteEdgeResponse(30L, 1L, 20L, 21L, new BigDecimal("20"), 30, "walkway", true, true)));

        mockMvc.perform(get("/api/admin/route-edges").param("stationId", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].edgeId").value(30L))
                .andExpect(jsonPath("$.data[0].moveType").value("walkway"));
    }
}

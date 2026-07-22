package com.pingo.backend.route.controller;

import com.pingo.backend.global.exception.GlobalExceptionHandler;
import com.pingo.backend.route.dto.request.RouteNodeCreateRequest;
import com.pingo.backend.route.dto.response.RouteNodeIdResponse;
import com.pingo.backend.route.dto.response.RouteNodeResponse;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class AdminRouteNodeControllerTest {

    @Mock
    private RouteService routeService;

    private MockMvc mockMvc;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        AdminRouteNodeController controller = new AdminRouteNodeController(routeService);
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
        objectMapper = new ObjectMapper();
    }

    @Test
    void createNodeReturnsCreatedResponse() throws Exception {
        RouteNodeCreateRequest request = new RouteNodeCreateRequest(
                1L, 2L, "junction", "B2 갈림길", new BigDecimal("300"), new BigDecimal("200"), true);
        when(routeService.createNode(any(RouteNodeCreateRequest.class)))
                .thenReturn(new RouteNodeIdResponse(20L));

        mockMvc.perform(post("/api/admin/route-nodes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.nodeId").value(20L));
    }

    @Test
    void getNodesReturnsList() throws Exception {
        when(routeService.getNodes(1L, null)).thenReturn(List.of(
                new RouteNodeResponse(20L, 1L, 2L, "junction", "B2 갈림길",
                        new BigDecimal("300"), new BigDecimal("200"), true)));

        mockMvc.perform(get("/api/admin/route-nodes").param("stationId", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].nodeId").value(20L));
    }

    @Test
    void deleteNodeReturnsSuccess() throws Exception {
        mockMvc.perform(delete("/api/admin/route-nodes/20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }
}

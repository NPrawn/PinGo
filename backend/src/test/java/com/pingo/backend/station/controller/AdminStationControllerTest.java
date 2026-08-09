package com.pingo.backend.station.controller;

import com.pingo.backend.global.exception.BusinessException;
import com.pingo.backend.global.exception.ErrorCode;
import com.pingo.backend.global.exception.GlobalExceptionHandler;
import com.pingo.backend.station.dto.request.FloorCreateRequest;
import com.pingo.backend.station.dto.request.StationCreateRequest;
import com.pingo.backend.station.dto.response.FloorIdResponse;
import com.pingo.backend.station.dto.response.StationIdResponse;
import com.pingo.backend.station.service.StationService;
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

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class AdminStationControllerTest {

    @Mock
    private StationService stationService;

    private MockMvc mockMvc;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        AdminStationController controller = new AdminStationController(stationService);
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
        objectMapper = new ObjectMapper();
    }

    @Test
    void createStationReturnsCreatedResponse() throws Exception {
        StationCreateRequest request = new StationCreateRequest(
                "역삼역",
                "Yeoksam Station",
                "2호선",
                new BigDecimal("37.5007000"),
                new BigDecimal("127.0365000")
        );
        when(stationService.createStation(request)).thenReturn(new StationIdResponse(1L));

        mockMvc.perform(post("/api/admin/stations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.stationId").value(1L));
    }

    @Test
    void createStationReturnsBadRequestForInvalidLatitude() throws Exception {
        StationCreateRequest request = new StationCreateRequest(
                "역삼역",
                "Yeoksam Station",
                "2호선",
                new BigDecimal("91.0"),
                new BigDecimal("127.0365000")
        );

        mockMvc.perform(post("/api/admin/stations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }

    @Test
    void createFloorReturnsConflictForDuplicatedCode() throws Exception {
        FloorCreateRequest request = new FloorCreateRequest("B2", "지하 2층", 1, null);
        when(stationService.createFloor(1L, request))
                .thenThrow(new BusinessException(ErrorCode.DUPLICATE_FLOOR_CODE));

        mockMvc.perform(post("/api/admin/stations/1/floors")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value("DUPLICATE_FLOOR_CODE"));
    }
}

package com.pingo.backend.station.controller;

import com.pingo.backend.global.exception.BusinessException;
import com.pingo.backend.global.exception.ErrorCode;
import com.pingo.backend.global.exception.GlobalExceptionHandler;
import com.pingo.backend.station.dto.response.StationSearchResponse;
import com.pingo.backend.station.service.StationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class StationControllerTest {

    @Mock
    private StationService stationService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        StationController controller = new StationController(stationService);
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void searchStationsReturnsMatchingStations() throws Exception {
        when(stationService.searchStations("역삼"))
                .thenReturn(List.of(new StationSearchResponse(1L, "역삼역", "Yeoksam Station", "2호선")));

        mockMvc.perform(get("/api/stations/search").param("keyword", "역삼"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].stationId").value(1L))
                .andExpect(jsonPath("$.data[0].nameKo").value("역삼역"))
                .andExpect(jsonPath("$.data[0].nameEn").value("Yeoksam Station"))
                .andExpect(jsonPath("$.data[0].lineInfo").value("2호선"));
    }

    @Test
    void searchStationsReturnsBadRequestForBlankKeyword() throws Exception {
        when(stationService.searchStations("  "))
                .thenThrow(new BusinessException(ErrorCode.INVALID_REQUEST));

        mockMvc.perform(get("/api/stations/search").param("keyword", "  "))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }

    @Test
    void searchStationsReturnsBadRequestForMissingKeyword() throws Exception {
        when(stationService.searchStations(null))
                .thenThrow(new BusinessException(ErrorCode.INVALID_REQUEST));

        mockMvc.perform(get("/api/stations/search"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }
}

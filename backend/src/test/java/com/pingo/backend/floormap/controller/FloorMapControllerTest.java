package com.pingo.backend.floormap.controller;

import com.pingo.backend.floormap.dto.response.FloorMapResponse;
import com.pingo.backend.floormap.service.FloorMapService;
import com.pingo.backend.global.exception.BusinessException;
import com.pingo.backend.global.exception.ErrorCode;
import com.pingo.backend.global.exception.GlobalExceptionHandler;
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
class FloorMapControllerTest {

    @Mock
    private FloorMapService floorMapService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        FloorMapController controller = new FloorMapController(floorMapService);
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void getStationMapsReturnsMaps() throws Exception {
        when(floorMapService.getMapsByStation(1L)).thenReturn(List.of(
                new FloorMapResponse(10L, 2L, "B2", "image", "/uploads/maps/b2.png", 1200, 800, null, null, null, null, "v1", null)));

        mockMvc.perform(get("/api/stations/1/maps"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].mapId").value(10L))
                .andExpect(jsonPath("$.data[0].floorCode").value("B2"))
                .andExpect(jsonPath("$.data[0].mapUrl").value("/uploads/maps/b2.png"));
    }

    @Test
    void getStationMapsReturnsNotFoundForUnknownStation() throws Exception {
        when(floorMapService.getMapsByStation(99L))
                .thenThrow(new BusinessException(ErrorCode.STATION_NOT_FOUND));

        mockMvc.perform(get("/api/stations/99/maps"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("STATION_NOT_FOUND"));
    }
}

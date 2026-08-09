package com.pingo.backend.facility.controller;

import com.pingo.backend.facility.dto.response.ExitDetailResponse;
import com.pingo.backend.facility.dto.response.FacilityDetailResponse;
import com.pingo.backend.facility.dto.response.FacilityResponse;
import com.pingo.backend.facility.service.FacilityService;
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

import java.math.BigDecimal;
import java.util.List;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class FacilityControllerTest {

    @Mock
    private FacilityService facilityService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        FacilityController controller = new FacilityController(facilityService);
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void getStationFacilitiesReturnsList() throws Exception {
        when(facilityService.getFacilities(1L, 2L, "exit")).thenReturn(List.of(
                new FacilityResponse(10L, 1L, 2L, "exit", "5번 출구", "Exit 5",
                        new BigDecimal("820.4"), new BigDecimal("120.7"), 44L, true)));

        mockMvc.perform(get("/api/stations/1/facilities")
                        .param("floorId", "2")
                        .param("facilityType", "exit"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].facilityId").value(10L))
                .andExpect(jsonPath("$.data[0].facilityType").value("exit"))
                .andExpect(jsonPath("$.data[0].linkedNodeId").value(44L));
    }

    @Test
    void getFacilityReturnsDetailWithExitDetail() throws Exception {
        when(facilityService.getFacility(10L)).thenReturn(new FacilityDetailResponse(
                10L, 1L, 2L, "exit", "5번 출구", "Exit 5",
                new BigDecimal("820.4"), new BigDecimal("120.7"), 44L, true,
                new ExitDetailResponse("5", new BigDecimal("37.4982"), new BigDecimal("127.0281"), null, null)));

        mockMvc.perform(get("/api/facilities/10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.facilityId").value(10L))
                .andExpect(jsonPath("$.data.exitDetail.exitNumber").value("5"));
    }

    @Test
    void getFacilityReturnsNotFoundForUnknownFacility() throws Exception {
        when(facilityService.getFacility(99L))
                .thenThrow(new BusinessException(ErrorCode.FACILITY_NOT_FOUND));

        mockMvc.perform(get("/api/facilities/99"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("FACILITY_NOT_FOUND"));
    }
}

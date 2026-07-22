package com.pingo.backend.facility.controller;

import com.pingo.backend.facility.dto.request.FacilityCreateRequest;
import com.pingo.backend.facility.dto.response.FacilityDetailResponse;
import com.pingo.backend.facility.dto.response.FacilityIdResponse;
import com.pingo.backend.facility.dto.response.FacilityResponse;
import com.pingo.backend.facility.service.FacilityService;
import com.pingo.backend.global.exception.GlobalExceptionHandler;
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
class AdminFacilityControllerTest {

    @Mock
    private FacilityService facilityService;

    private MockMvc mockMvc;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        AdminFacilityController controller = new AdminFacilityController(facilityService);
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
        objectMapper = new ObjectMapper();
    }

    @Test
    void createFacilityReturnsCreatedResponse() throws Exception {
        FacilityCreateRequest request = new FacilityCreateRequest(
                1L, 2L, "exit", "5번 출구", "Exit 5",
                new BigDecimal("820.4"), new BigDecimal("120.7"), null, true, null);
        when(facilityService.createFacility(any(FacilityCreateRequest.class)))
                .thenReturn(new FacilityIdResponse(10L));

        mockMvc.perform(post("/api/admin/facilities")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.facilityId").value(10L));
    }

    @Test
    void createFacilityReturnsBadRequestWhenRequiredFieldMissing() throws Exception {
        FacilityCreateRequest request = new FacilityCreateRequest(
                1L, 2L, "  ", "5번 출구", null,
                new BigDecimal("820.4"), new BigDecimal("120.7"), null, null, null);

        mockMvc.perform(post("/api/admin/facilities")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }

    @Test
    void getFacilitiesReturnsList() throws Exception {
        when(facilityService.getFacilities(1L, null, null)).thenReturn(List.of(
                new FacilityResponse(10L, 1L, 2L, "exit", "5번 출구", "Exit 5",
                        new BigDecimal("820.4"), new BigDecimal("120.7"), null, true)));

        mockMvc.perform(get("/api/admin/facilities").param("stationId", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].facilityId").value(10L))
                .andExpect(jsonPath("$.data[0].facilityType").value("exit"));
    }

    @Test
    void getFacilitiesReturnsBadRequestWhenStationIdMissing() throws Exception {
        mockMvc.perform(get("/api/admin/facilities"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }

    @Test
    void getFacilityReturnsDetail() throws Exception {
        when(facilityService.getFacility(10L)).thenReturn(new FacilityDetailResponse(
                10L, 1L, 2L, "exit", "5번 출구", "Exit 5",
                new BigDecimal("820.4"), new BigDecimal("120.7"), null, true, null));

        mockMvc.perform(get("/api/admin/facilities/10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.facilityId").value(10L));
    }

    @Test
    void deleteFacilityReturnsSuccess() throws Exception {
        mockMvc.perform(delete("/api/admin/facilities/10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }
}

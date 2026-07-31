package com.pingo.backend.destination.controller;

import com.pingo.backend.destination.dto.request.NearestExitRequest;
import com.pingo.backend.destination.dto.response.DestinationSearchResponse;
import com.pingo.backend.destination.dto.response.NearestExitResponse;
import com.pingo.backend.destination.service.DestinationService;
import com.pingo.backend.destination.service.NearestExitService;
import com.pingo.backend.global.exception.BusinessException;
import com.pingo.backend.global.exception.ErrorCode;
import com.pingo.backend.global.exception.GlobalExceptionHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.math.BigDecimal;
import java.util.List;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class DestinationControllerTest {

    @Mock
    private DestinationService destinationService;

    @Mock
    private NearestExitService nearestExitService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        DestinationController controller = new DestinationController(destinationService, nearestExitService);
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void searchReturnsUnifiedResults() throws Exception {
        when(destinationService.search(1L, "출구")).thenReturn(List.of(
                new DestinationSearchResponse("facility", 10L, "5번 출구", "Exit 5", "exit"),
                new DestinationSearchResponse("place", 3L, "코엑스몰", "COEX Mall", "shopping")));

        mockMvc.perform(get("/api/destinations/search")
                        .param("stationId", "1")
                        .param("keyword", "출구"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].destinationType").value("facility"))
                .andExpect(jsonPath("$.data[0].destinationId").value(10L))
                .andExpect(jsonPath("$.data[1].destinationType").value("place"))
                .andExpect(jsonPath("$.data[1].category").value("shopping"));
    }

    @Test
    void searchReturnsBadRequestWhenStationIdMissing() throws Exception {
        when(destinationService.search(null, "출구"))
                .thenThrow(new BusinessException(ErrorCode.INVALID_REQUEST));

        mockMvc.perform(get("/api/destinations/search").param("keyword", "출구"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }

    @Test
    void findNearestExitReturnsExitIdAndNumber() throws Exception {
        NearestExitRequest request = new NearestExitRequest(
                1L,
                new BigDecimal("37.500029"),
                new BigDecimal("127.036431")
        );
        when(nearestExitService.findNearestExit(request))
                .thenReturn(new NearestExitResponse(10L, "5"));

        mockMvc.perform(post("/api/destinations/nearest-exit")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "stationId": 1,
                                  "destinationLatitude": 37.500029,
                                  "destinationLongitude": 127.036431
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.exitFacilityId").value(10L))
                .andExpect(jsonPath("$.data.exitNumber").value("5"));
    }

    @Test
    void findNearestExitRejectsInvalidCoordinates() throws Exception {
        mockMvc.perform(post("/api/destinations/nearest-exit")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "stationId": 1,
                                  "destinationLatitude": 91,
                                  "destinationLongitude": 127.036431
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }
}

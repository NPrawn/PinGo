package com.pingo.backend.place.controller;

import com.pingo.backend.global.exception.BusinessException;
import com.pingo.backend.global.exception.ErrorCode;
import com.pingo.backend.global.exception.GlobalExceptionHandler;
import com.pingo.backend.place.dto.response.RecommendedExitResponse;
import com.pingo.backend.place.service.RecommendedExitService;
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
class RecommendedExitControllerTest {

    @Mock
    private RecommendedExitService recommendedExitService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        RecommendedExitController controller = new RecommendedExitController(recommendedExitService);
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void getRecommendedExitsReturnsList() throws Exception {
        when(recommendedExitService.getRecommendedExits(3L)).thenReturn(List.of(
                new RecommendedExitResponse(1L, 3L, 10L, "5번 출구", "Exit 5", 1, true,
                        "가장 가까운 출구", "Closest exit", 6,
                        new RecommendedExitResponse.ExitLocation(new BigDecimal("37.4982"), new BigDecimal("127.0281")))));

        mockMvc.perform(get("/api/places/3/recommended-exits"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].exitFacilityId").value(10L))
                .andExpect(jsonPath("$.data[0].isPrimary").value(true))
                .andExpect(jsonPath("$.data[0].exitLocation.latitude").value(37.4982));
    }

    @Test
    void getRecommendedExitsReturnsNotFoundForUnknownPlace() throws Exception {
        when(recommendedExitService.getRecommendedExits(99L))
                .thenThrow(new BusinessException(ErrorCode.PLACE_NOT_FOUND));

        mockMvc.perform(get("/api/places/99/recommended-exits"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("PLACE_NOT_FOUND"));
    }
}

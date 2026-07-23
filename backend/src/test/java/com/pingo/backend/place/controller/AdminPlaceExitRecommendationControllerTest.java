package com.pingo.backend.place.controller;

import com.pingo.backend.global.exception.GlobalExceptionHandler;
import com.pingo.backend.place.dto.response.PlaceExitRecommendationIdResponse;
import com.pingo.backend.place.dto.response.PlaceExitRecommendationResponse;
import com.pingo.backend.place.service.AdminPlaceService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class AdminPlaceExitRecommendationControllerTest {

    @Mock
    private AdminPlaceService adminPlaceService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        AdminPlaceExitRecommendationController controller =
                new AdminPlaceExitRecommendationController(adminPlaceService);
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    @DisplayName("추천 등록 정상 요청은 201과 생성된 ID를 반환한다")
    void createRecommendationReturnsCreated() throws Exception {
        when(adminPlaceService.createRecommendation(any()))
                .thenReturn(new PlaceExitRecommendationIdResponse(20L));

        mockMvc.perform(post("/api/admin/place-exit-recommendations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"placeId":3,"exitFacilityId":10,"priority":1,"isPrimary":true}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.recommendationId").value(20L));
    }

    @Test
    @DisplayName("필수 값이 누락되면 400과 INVALID_REQUEST를 반환한다")
    void createRecommendationRejectsMissingField() throws Exception {
        mockMvc.perform(post("/api/admin/place-exit-recommendations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"placeId":3,"priority":1}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }

    @Test
    @DisplayName("장소별 추천 목록을 조회한다")
    void getRecommendationsReturnsList() throws Exception {
        when(adminPlaceService.getRecommendations(3L)).thenReturn(List.of(
                new PlaceExitRecommendationResponse(20L, 3L, 10L, 1, "가까운 출구", null, 6, true)));

        mockMvc.perform(get("/api/admin/place-exit-recommendations").param("placeId", "3"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].recommendationId").value(20L))
                .andExpect(jsonPath("$.data[0].isPrimary").value(true));
    }

    @Test
    @DisplayName("placeId 없이 추천 목록을 조회하면 400을 반환한다")
    void getRecommendationsRejectsMissingPlaceId() throws Exception {
        mockMvc.perform(get("/api/admin/place-exit-recommendations"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }

    @Test
    @DisplayName("추천을 삭제한다")
    void deleteRecommendationReturnsSuccess() throws Exception {
        mockMvc.perform(delete("/api/admin/place-exit-recommendations/20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }
}

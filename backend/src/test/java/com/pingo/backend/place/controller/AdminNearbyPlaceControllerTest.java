package com.pingo.backend.place.controller;

import com.pingo.backend.global.exception.GlobalExceptionHandler;
import com.pingo.backend.place.dto.response.NearbyPlaceIdResponse;
import com.pingo.backend.place.dto.response.NearbyPlaceResponse;
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

import java.math.BigDecimal;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class AdminNearbyPlaceControllerTest {

    @Mock
    private AdminPlaceService adminPlaceService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        AdminNearbyPlaceController controller = new AdminNearbyPlaceController(adminPlaceService);
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    @DisplayName("장소 등록 정상 요청은 201과 생성된 ID를 반환한다")
    void createPlaceReturnsCreated() throws Exception {
        when(adminPlaceService.createPlace(any())).thenReturn(new NearbyPlaceIdResponse(10L));

        mockMvc.perform(post("/api/admin/nearby-places")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"stationId":1,"nameKo":"코엑스몰","category":"shopping"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.placeId").value(10L));
    }

    @Test
    @DisplayName("필수 값이 누락되면 400과 INVALID_REQUEST를 반환한다")
    void createPlaceRejectsMissingField() throws Exception {
        mockMvc.perform(post("/api/admin/nearby-places")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"stationId":1,"category":"shopping"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }

    @Test
    @DisplayName("역별 장소 목록을 조회한다")
    void getPlacesReturnsList() throws Exception {
        when(adminPlaceService.getPlaces(1L)).thenReturn(List.of(
                new NearbyPlaceResponse(10L, 1L, "코엑스몰", "COEX Mall", "shopping", "서울 강남구",
                        new BigDecimal("37.5118"), new BigDecimal("127.0592"), null, true)));

        mockMvc.perform(get("/api/admin/nearby-places").param("stationId", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].placeId").value(10L))
                .andExpect(jsonPath("$.data[0].nameKo").value("코엑스몰"));
    }

    @Test
    @DisplayName("장소 상세를 조회한다")
    void getPlaceReturnsDetail() throws Exception {
        when(adminPlaceService.getPlace(10L)).thenReturn(
                new NearbyPlaceResponse(10L, 1L, "코엑스몰", "COEX Mall", "shopping", "서울 강남구",
                        new BigDecimal("37.5118"), new BigDecimal("127.0592"), null, true));

        mockMvc.perform(get("/api/admin/nearby-places/10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.placeId").value(10L));
    }

    @Test
    @DisplayName("장소를 수정한다")
    void updatePlaceReturnsUpdated() throws Exception {
        when(adminPlaceService.updatePlace(eq(10L), any())).thenReturn(
                new NearbyPlaceResponse(10L, 1L, "스타필드", "Starfield", "shopping", "하남시",
                        null, null, null, true));

        mockMvc.perform(patch("/api/admin/nearby-places/10")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"nameKo":"스타필드","category":"shopping"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.nameKo").value("스타필드"));
    }

    @Test
    @DisplayName("장소를 삭제한다")
    void deletePlaceReturnsSuccess() throws Exception {
        mockMvc.perform(delete("/api/admin/nearby-places/10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }
}

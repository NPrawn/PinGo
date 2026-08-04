package com.pingo.backend.externalmap.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pingo.backend.externalmap.dto.request.ExternalDestinationRequest;
import com.pingo.backend.externalmap.dto.request.ExternalDirectionRequest;
import com.pingo.backend.externalmap.dto.request.GeoPointRequest;
import com.pingo.backend.externalmap.dto.response.ExternalDirectionResponse;
import com.pingo.backend.externalmap.service.ExternalMapService;
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

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class ExternalMapControllerTest {

    @Mock
    private ExternalMapService externalMapService;

    private MockMvc mockMvc;

    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        ExternalMapController controller = new ExternalMapController(externalMapService);
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
        objectMapper = new ObjectMapper();
    }

    @Test
    void createDirectionReturnsKakaoUrls() throws Exception {
        when(externalMapService.createDirection(any(ExternalDirectionRequest.class)))
                .thenReturn(new ExternalDirectionResponse(
                        "kakao",
                        "kakaomap://route?sp=37.4982,127.0281&ep=37.5118,127.0592&by=foot",
                        "https://map.kakao.com/link/by/walk/%ED%98%84%EC%9E%AC%20%EC%9C%84%EC%B9%98,37.4982,127.0281/COEX%20Mall,37.5118,127.0592",
                        2450L,
                        2295L
                ));

        mockMvc.perform(post("/api/external-maps/directions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createRequest())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.provider").value("kakao"))
                .andExpect(jsonPath("$.data.appUrl").value("kakaomap://route?sp=37.4982,127.0281&ep=37.5118,127.0592&by=foot"))
                .andExpect(jsonPath("$.data.webUrl").value("https://map.kakao.com/link/by/walk/%ED%98%84%EC%9E%AC%20%EC%9C%84%EC%B9%98,37.4982,127.0281/COEX%20Mall,37.5118,127.0592"))
                .andExpect(jsonPath("$.data.distanceM").value(2450))
                .andExpect(jsonPath("$.data.estimatedTimeSec").value(2295));
    }

    @Test
    void createDirectionReturnsBadRequestForInvalidBody() throws Exception {
        mockMvc.perform(post("/api/external-maps/directions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }

    @Test
    void createDirectionReturnsOkWithNullMetricsWhenWalkingRouteIsUnavailable() throws Exception {
        when(externalMapService.createDirection(any(ExternalDirectionRequest.class)))
                .thenReturn(new ExternalDirectionResponse(
                        "kakao",
                        "kakaomap://route?by=foot",
                        "https://map.kakao.com/link/by/walk/example",
                        null,
                        null
                ));

        mockMvc.perform(post("/api/external-maps/directions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createRequest())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.distanceM").value(nullValue()))
                .andExpect(jsonPath("$.data.estimatedTimeSec").value(nullValue()));
    }

    @Test
    void createDirectionReturnsBadRequestForUnsupportedProvider() throws Exception {
        when(externalMapService.createDirection(any(ExternalDirectionRequest.class)))
                .thenThrow(new BusinessException(ErrorCode.INVALID_REQUEST));

        mockMvc.perform(post("/api/external-maps/directions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createRequest())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }

    @Test
    void createDirectionReturnsBadRequestForMissingDestinationCoordinate() throws Exception {
        ExternalDirectionRequest request = new ExternalDirectionRequest(
                "kakao",
                new GeoPointRequest(new BigDecimal("37.4982"), new BigDecimal("127.0281")),
                new ExternalDestinationRequest(
                        3L,
                        "COEX Mall",
                        null,
                        new BigDecimal("127.0592"),
                        "서울특별시 강남구 영동대로 513"
                ),
                "walking"
        );

        mockMvc.perform(post("/api/external-maps/directions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }

    private ExternalDirectionRequest createRequest() {
        return new ExternalDirectionRequest(
                "kakao",
                new GeoPointRequest(new BigDecimal("37.4982"), new BigDecimal("127.0281")),
                new ExternalDestinationRequest(
                        3L,
                        "COEX Mall",
                        new BigDecimal("37.5118"),
                        new BigDecimal("127.0592"),
                        "서울특별시 강남구 영동대로 513"
                ),
                "walking"
        );
    }
}

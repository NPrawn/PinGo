package com.pingo.backend.externalmap.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.pingo.backend.externalmap.dto.request.ExternalDestinationRequest;
import com.pingo.backend.externalmap.dto.request.ExternalDirectionRequest;
import com.pingo.backend.externalmap.dto.request.GeoPointRequest;
import com.pingo.backend.externalmap.dto.response.ExternalDirectionResponse;
import com.pingo.backend.global.exception.BusinessException;
import com.pingo.backend.global.exception.ErrorCode;
import java.math.BigDecimal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

public class ExternalMapServiceTest {

    private ExternalMapService externalMapService;

    @BeforeEach
    void setUp() {
        externalMapService = new ExternalMapService();
    }

    @Test
    void createDirectionReturnsKakaoAppAndWebUrl() {
        ExternalDirectionRequest request = new ExternalDirectionRequest(
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

        ExternalDirectionResponse response = externalMapService.createDirection(request);

        assertThat(response.provider()).isEqualTo("kakao");
        assertThat(response.appUrl())
                .isEqualTo("kakaomap://route?sp=37.4982,127.0281&ep=37.5118,127.0592&by=foot");
        assertThat(response.webUrl())
                .isEqualTo(
                        "https://map.kakao.com/link/by/walk/%ED%98%84%EC%9E%AC%20%EC%9C%84%EC%B9%98,37.4982,127.0281/COEX%20Mall,37.5118,127.0592");

    }

    @Test
    void createDirectionsThrowsForUnsupportedProvider() {
        ExternalDirectionRequest request = new ExternalDirectionRequest(
                "naver",
                new GeoPointRequest(new BigDecimal("37.4982"), new BigDecimal("127.0281")),
                new ExternalDestinationRequest(3L, "COEX Mall", new BigDecimal("37.5118"), new BigDecimal("127.0592"),
                        null),
                "walking"
        );

        assertThatThrownBy(() -> externalMapService.createDirection(request))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.INVALID_REQUEST));
    }

    @Test
    void createDirectionsThrowsForUnsupportedMode() {
        ExternalDirectionRequest request = new ExternalDirectionRequest(
                "kakao",
                new GeoPointRequest(new BigDecimal("37.4982"), new BigDecimal("127.0281")),
                new ExternalDestinationRequest(3L, "COEX Mall", new BigDecimal("37.5118"), new BigDecimal("127.0592"),
                        null),
                "driving"
        );

        assertThatThrownBy(() -> externalMapService.createDirection(request))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.INVALID_REQUEST));
    }
}

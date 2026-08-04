package com.pingo.backend.externalmap.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.pingo.backend.externalmap.dto.request.ExternalDestinationRequest;
import com.pingo.backend.externalmap.dto.request.ExternalDirectionRequest;
import com.pingo.backend.externalmap.dto.request.GeoPointRequest;
import com.pingo.backend.externalmap.dto.response.ExternalDirectionResponse;
import com.pingo.backend.externalmap.client.KakaoLocalClient;
import com.pingo.backend.externalmap.client.KakaoWalkingRouteResult;
import com.pingo.backend.global.exception.BusinessException;
import com.pingo.backend.global.exception.ErrorCode;
import java.math.BigDecimal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.junit.jupiter.api.extension.ExtendWith;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;

@ExtendWith(MockitoExtension.class)
public class ExternalMapServiceTest {

    @Mock
    private KakaoLocalClient kakaoLocalClient;

    private ExternalMapService externalMapService;

    @BeforeEach
    void setUp() {
        externalMapService = new ExternalMapService(kakaoLocalClient);
        lenient().when(kakaoLocalClient.findWalkingRoute(any(), any(), any(), any()))
                .thenReturn(new KakaoWalkingRouteResult(2450L, 2295L, null));
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
                "foot"
        );

        ExternalDirectionResponse response = externalMapService.createDirection(request);

        assertThat(response.provider()).isEqualTo("kakao");
        assertThat(response.appUrl())
                .isEqualTo("kakaomap://route?sp=37.4982,127.0281&ep=37.5118,127.0592&by=foot");
        assertThat(response.webUrl())
                .isEqualTo(
                        "https://map.kakao.com/link/by/walk/%ED%98%84%EC%9E%AC%20%EC%9C%84%EC%B9%98,37.4982,127.0281/COEX%20Mall,37.5118,127.0592");
        assertThat(response.distanceM()).isEqualTo(2450L);
        assertThat(response.estimatedTimeSec()).isEqualTo(2295L);

    }

    @Test
    void createDirectionStillAcceptsLegacyWalkingMode() {
        ExternalDirectionRequest request = new ExternalDirectionRequest(
                "kakao",
                new GeoPointRequest(new BigDecimal("37.4982"), new BigDecimal("127.0281")),
                new ExternalDestinationRequest(
                        3L,
                        "COEX Mall",
                        new BigDecimal("37.5118"),
                        new BigDecimal("127.0592"),
                        null
                ),
                "walking"
        );

        assertThat(externalMapService.createDirection(request).provider()).isEqualTo("kakao");
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

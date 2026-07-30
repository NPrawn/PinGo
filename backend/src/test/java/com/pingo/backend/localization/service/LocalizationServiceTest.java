package com.pingo.backend.localization.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.pingo.backend.localization.client.AiLocalizationClient;
import com.pingo.backend.localization.client.AiLocalizationClientErrorType;
import com.pingo.backend.localization.client.AiLocalizationClientException;
import com.pingo.backend.localization.client.dto.AiLocalizationResponse;
import com.pingo.backend.localization.client.dto.AiLocalizationStatus;
import com.pingo.backend.localization.client.dto.AiPoseResponse;
import com.pingo.backend.localization.client.dto.AiQualityResponse;
import com.pingo.backend.localization.client.dto.AiTimingResponse;
import com.pingo.backend.localization.dto.request.LocalizationRequestMetadata;
import com.pingo.backend.localization.dto.response.LocalizationFallbackOption;
import com.pingo.backend.localization.dto.response.LocalizationResultStatus;
import com.pingo.backend.route.repository.RouteNodeRepository;
import com.pingo.backend.route.domain.RouteNode;
import com.pingo.backend.station.domain.Station;
import com.pingo.backend.station.domain.StationFloor;
import com.pingo.backend.station.repository.StationFloorRepository;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;

class LocalizationServiceTest {

    private AiLocalizationClient aiLocalizationClient;
    private LocalizationService localizationService;
    private StationFloorRepository stationFloorRepository;
    private RouteNodeRepository routeNodeRepository;

    @BeforeEach
    void setUp() {
        aiLocalizationClient = mock(AiLocalizationClient.class);
        stationFloorRepository = mock(StationFloorRepository.class);
        routeNodeRepository = mock(RouteNodeRepository.class);
        localizationService = new LocalizationService(
                aiLocalizationClient,
                new AiLocalizationStatusMapper(),
                new LocalizationFallbackPolicy(),
                new AiLocalizationRequestMapper(),
                stationFloorRepository,
                routeNodeRepository
        );
    }

    @Test
    void localizeReturnsSuccessWhenAiLocalized() {
        MockMultipartFile image = image();
        LocalizationRequestMetadata metadata = metadata();

        when(aiLocalizationClient.localize(eq("loc-1"), eq("YS-2026-07-23.1"), eq(image), any()))
                .thenReturn(aiResponse(AiLocalizationStatus.LOCALIZED, null));

        var response = localizationService.localize("loc-1", image, metadata);

        assertThat(response.requestId()).isEqualTo("loc-1");
        assertThat(response.resultStatus()).isEqualTo(LocalizationResultStatus.SUCCESS);
        assertThat(response.mapVersion()).isEqualTo("YS-2026-07-23.1");
        assertThat(response.fallbackOptions()).isEmpty();
        assertThat(response.processingTimeMs()).isEqualTo(1234);
    }

    @Test
    void localizeAnchorsAiPoseToNearestRouteNode() {
        MockMultipartFile image = image();
        LocalizationRequestMetadata metadata = metadata();
        Station station = Station.create("station", "Station", null, null, null);
        ReflectionTestUtils.setField(station, "id", 1L);
        StationFloor floor = StationFloor.create(station, "B2", "B2", 1);
        ReflectionTestUtils.setField(floor, "id", 2L);
        RouteNode node = RouteNode.create(
                1L, 2L, "normal", "Gate", new BigDecimal("12.5"), new BigDecimal("8.5"), true);
        ReflectionTestUtils.setField(node, "id", 101L);

        AiLocalizationResponse response = new AiLocalizationResponse(
                "loc-1",
                AiLocalizationStatus.LOCALIZED,
                "YS-2026-07-23.1",
                null,
                "B2",
                new AiPoseResponse("world", List.of(), List.of(), List.of(12.0, 1.0, 8.0)),
                new AiQualityResponse(null, null, null, 0.87, null, null, null, null),
                List.of(),
                new AiTimingResponse(1234, null, null, null),
                null
        );
        when(aiLocalizationClient.localize(eq("loc-1"), eq("YS-2026-07-23.1"), eq(image), any()))
                .thenReturn(response);
        when(stationFloorRepository.findAllByStationIdOrderByFloorOrderAsc(1L)).thenReturn(List.of(floor));
        when(routeNodeRepository.search(1L, 2L)).thenReturn(List.of(node));

        var result = localizationService.localize("loc-1", image, metadata);

        assertThat(result.candidates()).hasSize(1);
        assertThat(result.candidates().get(0).nodeId()).isEqualTo(101L);
        assertThat(result.candidates().get(0).confidenceLabel()).isEqualTo("high");
    }

    @Test
    void localizeReturnsFallbackWhenAiLowQuality() {
        MockMultipartFile image = image();
        LocalizationRequestMetadata metadata = metadata();

        when(aiLocalizationClient.localize(eq("loc-1"), eq("YS-2026-07-23.1"), eq(image), any()))
                .thenReturn(aiResponse(AiLocalizationStatus.LOW_GEOMETRIC_QUALITY, "LOW_GEOMETRIC_QUALITY"));

        var response = localizationService.localize("loc-1", image, metadata);

        assertThat(response.requestId()).isEqualTo("loc-1");
        assertThat(response.resultStatus()).isEqualTo(LocalizationResultStatus.LOW_CONFIDENCE);
        assertThat(response.mapVersion()).isEqualTo("YS-2026-07-23.1");
        assertThat(response.fallbackOptions()).containsExactly(
                LocalizationFallbackOption.RETRY_CAPTURE,
                LocalizationFallbackOption.SELECT_LANDMARK,
                LocalizationFallbackOption.SELECT_ON_MAP,
                LocalizationFallbackOption.REQUEST_CONSULTATION
        );
    }

    @Test
    void localizeReturnsTimeoutFallbackWhenClientTimeout() {
        MockMultipartFile image = image();
        LocalizationRequestMetadata metadata = metadata();

        when(aiLocalizationClient.localize(eq("loc-1"), eq("YS-2026-07-23.1"), eq(image), any()))
                .thenThrow(new AiLocalizationClientException(
                        AiLocalizationClientErrorType.TIMEOUT,
                        "timeout"
                ));

        var response = localizationService.localize("loc-1", image, metadata);

        assertThat(response.requestId()).isEqualTo("loc-1");
        assertThat(response.resultStatus()).isEqualTo(LocalizationResultStatus.TIMEOUT);
        assertThat(response.mapVersion()).isEqualTo("YS-2026-07-23.1");
        assertThat(response.processingTimeMs()).isNull();
        assertThat(response.fallbackOptions()).containsExactly(
                LocalizationFallbackOption.RETRY_CAPTURE,
                LocalizationFallbackOption.SELECT_ON_MAP,
                LocalizationFallbackOption.REQUEST_CONSULTATION
        );
    }

    @Test
    void localizeReturnsUnavailableFallbackWhenClientUnavailable() {
        MockMultipartFile image = image();
        LocalizationRequestMetadata metadata = metadata();

        when(aiLocalizationClient.localize(eq("loc-1"), eq("YS-2026-07-23.1"), eq(image), any()))
                .thenThrow(new AiLocalizationClientException(
                        AiLocalizationClientErrorType.UNAVAILABLE,
                        "unavailable"
                ));

        var response = localizationService.localize("loc-1", image, metadata);

        assertThat(response.requestId()).isEqualTo("loc-1");
        assertThat(response.resultStatus()).isEqualTo(LocalizationResultStatus.AI_SERVER_UNAVAILABLE);
        assertThat(response.mapVersion()).isEqualTo("YS-2026-07-23.1");
        assertThat(response.fallbackOptions()).containsExactly(
                LocalizationFallbackOption.SELECT_ON_MAP,
                LocalizationFallbackOption.REQUEST_CONSULTATION
        );
    }

    @Test
    void localizeReturnsInternalErrorFallbackWhenAiResponseIsNull() {
        MockMultipartFile image = image();
        LocalizationRequestMetadata metadata = metadata();

        when(aiLocalizationClient.localize(eq("loc-1"), eq("YS-2026-07-23.1"), eq(image), any()))
                .thenReturn(null);

        var response = localizationService.localize("loc-1", image, metadata);

        assertThat(response.requestId()).isEqualTo("loc-1");
        assertThat(response.resultStatus()).isEqualTo(LocalizationResultStatus.INTERNAL_ERROR);
        assertThat(response.mapVersion()).isEqualTo("YS-2026-07-23.1");
        assertThat(response.processingTimeMs()).isNull();
        assertThat(response.fallbackOptions()).containsExactly(
                LocalizationFallbackOption.RETRY_CAPTURE,
                LocalizationFallbackOption.SELECT_ON_MAP,
                LocalizationFallbackOption.REQUEST_CONSULTATION
        );
    }

    @Test
    void localizeReturnsInternalErrorFallbackWhenAiStatusIsNull() {
        MockMultipartFile image = image();
        LocalizationRequestMetadata metadata = metadata();

        when(aiLocalizationClient.localize(eq("loc-1"), eq("YS-2026-07-23.1"), eq(image), any()))
                .thenReturn(aiResponse(null, null));

        var response = localizationService.localize("loc-1", image, metadata);

        assertThat(response.requestId()).isEqualTo("loc-1");
        assertThat(response.resultStatus()).isEqualTo(LocalizationResultStatus.INTERNAL_ERROR);
        assertThat(response.mapVersion()).isEqualTo("YS-2026-07-23.1");
        assertThat(response.processingTimeMs()).isEqualTo(1234);
        assertThat(response.fallbackOptions()).containsExactly(
                LocalizationFallbackOption.RETRY_CAPTURE,
                LocalizationFallbackOption.SELECT_ON_MAP,
                LocalizationFallbackOption.REQUEST_CONSULTATION
        );
    }

    private AiLocalizationResponse aiResponse(AiLocalizationStatus status, String failureReason) {
        return new AiLocalizationResponse(
                "loc-1",
                status,
                "YS-2026-07-23.1",
                null,
                null,
                null,
                null,
                List.of(),
                new AiTimingResponse(1234, null, null, null),
                failureReason
        );
    }

    private MockMultipartFile image() {
        return new MockMultipartFile(
                "image",
                "query.jpg",
                "image/jpeg",
                "image".getBytes()
        );
    }

    private LocalizationRequestMetadata metadata() {
        return new LocalizationRequestMetadata(
                "usr_sess_01JABC",
                1L,
                "YS-2026-07-23.1",
                null,
                null,
                null
        );
    }
}

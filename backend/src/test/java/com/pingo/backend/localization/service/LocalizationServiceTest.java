package com.pingo.backend.localization.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.anyDouble;

import com.pingo.backend.localization.client.AiLocalizationClient;
import com.pingo.backend.localization.client.AiLocalizationClientErrorType;
import com.pingo.backend.localization.client.AiLocalizationClientException;
import com.pingo.backend.localization.client.AiLocalizationProperties;
import com.pingo.backend.localization.client.dto.AiLocalizationResponse;
import com.pingo.backend.localization.client.dto.AiLocalizationStatus;
import com.pingo.backend.localization.client.dto.AiTimingResponse;
import com.pingo.backend.localization.anchoring.AnchoredLocation;
import com.pingo.backend.localization.anchoring.ColmapToCanonicalMapper;
import com.pingo.backend.localization.anchoring.IndoorPositionResolver;
import com.pingo.backend.localization.anchoring.VpsAnchoringProperties;
import com.pingo.backend.localization.anchoring.VpsAnchoringProperties.FloorFrame;
import com.pingo.backend.localization.client.dto.AiPoseResponse;
import com.pingo.backend.localization.client.dto.AiQualityResponse;
import com.pingo.backend.localization.dto.request.LocalizationRequestMetadata;
import com.pingo.backend.localization.dto.response.LocalizationFallbackOption;
import com.pingo.backend.localization.dto.response.LocalizationResultStatus;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

class LocalizationServiceTest {

    private AiLocalizationClient aiLocalizationClient;
    private IndoorPositionResolver positionResolver;
    private LocalizationService localizationService;

    @BeforeEach
    void setUp() {
        aiLocalizationClient = mock(AiLocalizationClient.class);
        positionResolver = mock(IndoorPositionResolver.class);
        localizationService = new LocalizationService(
                aiLocalizationClient,
                new AiLocalizationStatusMapper(),
                new LocalizationFallbackPolicy(),
                new AiLocalizationRequestMapper(),
                new ColmapToCanonicalMapper(new VpsAnchoringProperties(Map.of())),
                positionResolver,
                properties()
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
        // 정합 계수가 없어 앵커링을 못 하면 SUCCESS 로 두지 않는다. 그대로 두면 좌표도
        // 경로 진입점도 없는데 fallbackOptions 까지 비어 클라이언트가 갈 화면이 없어진다.
        assertThat(response.resultStatus()).isEqualTo(LocalizationResultStatus.MAP_NOT_READY);
        assertThat(response.position()).isNull();
        assertThat(response.startNodeId()).isNull();
        assertThat(response.fallbackOptions()).isNotEmpty();
        assertThat(response.mapVersion()).isEqualTo("YS-2026-07-23.1");
        assertThat(response.processingTimeMs()).isEqualTo(1234);
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

    @Test
    void localizeFillsPositionAndStartNodeWhenAnchored() {
        MockMultipartFile image = image();
        LocalizationRequestMetadata metadata = metadata();
        LocalizationService service = serviceWithFrame();

        when(aiLocalizationClient.localize(eq("loc-1"), eq("YS-2026-07-23.1"), eq(image), any()))
                .thenReturn(localizedOnB2());
        when(positionResolver.resolve(eq(1L), eq("B2"), any(), any(), anyDouble()))
                .thenReturn(Optional.of(anchored()));

        var response = service.localize("loc-1", image, metadata);

        assertThat(response.resultStatus()).isEqualTo(LocalizationResultStatus.SUCCESS);
        assertThat(response.startNodeId()).isEqualTo(123L);
        assertThat(response.startNodeLabel()).isEqualTo("B2-B3 엘리베이터 A");
        assertThat(response.fallbackOptions()).isEmpty();
        assertThat(response.position()).isNotNull();
        assertThat(response.position().floorId()).isEqualTo(2L);
        assertThat(response.position().floorCode()).isEqualTo("B2");
        assertThat(response.position().mapX()).isEqualByComparingTo("-0.975");
        assertThat(response.position().mapY()).isEqualByComparingTo("27.717");
        assertThat(response.position().mapZ()).isEqualByComparingTo("0.000");
        assertThat(response.position().accuracyM()).isEqualByComparingTo("0.497");
        assertThat(response.position().forwardMap()).isNotNull();
        assertThat(response.position().forwardMap().x()).isEqualByComparingTo("0.930418");
        assertThat(response.position().forwardMap().y()).isEqualByComparingTo("-0.366501");
    }

    @Test
    void localizeKeepsPositionWhenDirectionIsUnavailable() {
        MockMultipartFile image = image();
        LocalizationRequestMetadata metadata = metadata();
        LocalizationService service = serviceWithFrame();

        when(aiLocalizationClient.localize(eq("loc-1"), eq("YS-2026-07-23.1"), eq(image), any()))
                .thenReturn(localizedOnB2());
        // 방향을 못 구한 경우. 좌표까지 버리면 지도에 위치도 못 찍는다.
        when(positionResolver.resolve(eq(1L), eq("B2"), any(), any(), anyDouble()))
                .thenReturn(Optional.of(anchored(null, null)));

        var response = service.localize("loc-1", image, metadata);

        assertThat(response.resultStatus()).isEqualTo(LocalizationResultStatus.SUCCESS);
        assertThat(response.position()).isNotNull();
        assertThat(response.position().mapX()).isEqualByComparingTo("-0.975");
        assertThat(response.position().forwardMap()).isNull();
    }

    @Test
    void localizeReturnsAnchoredCandidateForWeakGeometricResult() {
        MockMultipartFile image = image();
        LocalizationService service = serviceWithFrame();
        AiLocalizationResponse weak = new AiLocalizationResponse(
                "loc-1",
                AiLocalizationStatus.LOW_GEOMETRIC_QUALITY,
                "YS-2026-07-23.1",
                "b2-v1",
                "B2",
                new AiPoseResponse(
                        "CAM_FROM_COLMAP_WORLD",
                        List.of(0.0, 0.0, 0.0, 1.0),
                        List.of(0.0, 0.0, 0.0),
                        List.of(1.0736587455, -1.1765271796, 6.6548534318)
                ),
                new AiQualityResponse(30, 20, 18, 0.15, 9.0, 20, 2, "browser", 0.72),
                List.of(),
                new AiTimingResponse(1234, null, null, null),
                "LOW_GEOMETRIC_QUALITY"
        );

        when(aiLocalizationClient.localize(eq("loc-1"), eq("YS-2026-07-23.1"), eq(image), any()))
                .thenReturn(weak);
        when(positionResolver.resolve(eq(1L), eq("B2"), any(), any(), anyDouble()))
                .thenReturn(Optional.of(anchored()));

        var response = service.localize("loc-1", image, metadata());

        assertThat(response.resultStatus()).isEqualTo(LocalizationResultStatus.LOW_CONFIDENCE);
        assertThat(response.position()).isNull();
        assertThat(response.startNodeId()).isNull();
        assertThat(response.candidate()).isNotNull();
        assertThat(response.candidate().confidenceScore()).isEqualTo(0.72);
        assertThat(response.candidate().startNodeId()).isEqualTo(123L);
        assertThat(response.candidate().position().floorCode()).isEqualTo("B2");
    }

    @Test
    void localizeFallsBackToMapNotReadyWhenNodeLookupFails() {
        MockMultipartFile image = image();
        LocalizationRequestMetadata metadata = metadata();
        LocalizationService service = serviceWithFrame();

        when(aiLocalizationClient.localize(eq("loc-1"), eq("YS-2026-07-23.1"), eq(image), any()))
                .thenReturn(localizedOnB2());
        // 계수는 있는데 층·노드를 못 찾은 경우. 좌표가 없으므로 SUCCESS 로 두면 안 된다.
        when(positionResolver.resolve(eq(1L), eq("B2"), any(), any(), anyDouble()))
                .thenReturn(Optional.empty());

        var response = service.localize("loc-1", image, metadata);

        assertThat(response.resultStatus()).isEqualTo(LocalizationResultStatus.MAP_NOT_READY);
        assertThat(response.position()).isNull();
        assertThat(response.startNodeId()).isNull();
        assertThat(response.fallbackOptions()).isNotEmpty();
    }

    @Test
    void localizeDoesNotAnchorWhenAiOmitsCameraCenter() {
        MockMultipartFile image = image();
        LocalizationRequestMetadata metadata = metadata();
        LocalizationService service = serviceWithFrame();

        // AI 는 LOW_GEOMETRIC_QUALITY 일 때 카메라 중심을 비운다.
        when(aiLocalizationClient.localize(eq("loc-1"), eq("YS-2026-07-23.1"), eq(image), any()))
                .thenReturn(new AiLocalizationResponse(
                        "loc-1", AiLocalizationStatus.LOW_GEOMETRIC_QUALITY, "YS-2026-07-23.1", null,
                        "B2", new AiPoseResponse("colmap", null, null, null), null, List.of(),
                        new AiTimingResponse(1234, null, null, null), "LOW_GEOMETRIC_QUALITY"));

        var response = service.localize("loc-1", image, metadata);

        assertThat(response.resultStatus()).isEqualTo(LocalizationResultStatus.LOW_CONFIDENCE);
        assertThat(response.position()).isNull();
        assertThat(response.startNodeId()).isNull();
        assertThat(response.fallbackOptions()).isNotEmpty();
    }

    /** 정합 계수가 있는 서비스. 기본 setUp 은 계수를 비워 앵커링 실패 경로를 만든다. */
    private LocalizationService serviceWithFrame() {
        FloorFrame b2 = new FloorFrame(1L,
                new double[]{0.157222117, -0.906216753, 5.731709510, 5.568476835, -1.589723009, -0.404089100},
                new double[]{-40.354147323, 22.557001580}, 0.0, 0.497);
        return new LocalizationService(
                aiLocalizationClient,
                new AiLocalizationStatusMapper(),
                new LocalizationFallbackPolicy(),
                new AiLocalizationRequestMapper(),
                new ColmapToCanonicalMapper(new VpsAnchoringProperties(Map.of("B2", b2))),
                positionResolver,
                properties());
    }

    private AiLocalizationResponse localizedOnB2() {
        return new AiLocalizationResponse(
                "loc-1", AiLocalizationStatus.LOCALIZED, "YS-2026-07-23.1", null,
                "B2",
                new AiPoseResponse("colmap", null, null, List.of(1.0736587455, -1.1765271796, 6.6548534318)),
                null, List.of(), new AiTimingResponse(1234, null, null, null), null);
    }

    private AnchoredLocation anchored() {
        return anchored(new BigDecimal("0.930418"), new BigDecimal("-0.366501"));
    }

    private AnchoredLocation anchored(BigDecimal forwardMapX, BigDecimal forwardMapY) {
        return new AnchoredLocation(
                2L, "B2",
                new BigDecimal("-0.975"), new BigDecimal("27.717"), new BigDecimal("0.000"),
                forwardMapX, forwardMapY,
                new BigDecimal("0.497"),
                123L, "B2-B3 엘리베이터 A", new BigDecimal("0.770"));
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
                null,
                null,
                null
        );
    }

    @Test
    void localizeReturnsMapNotReadyWithoutCallingAiForUnconfiguredStation() {
        LocalizationRequestMetadata metadata = new LocalizationRequestMetadata(
                "usr_sess_01JABC",
                999L,
                null,
                null,
                null
        );

        var response = localizationService.localize("loc-1", image(), metadata);

        assertThat(response.resultStatus()).isEqualTo(LocalizationResultStatus.MAP_NOT_READY);
        assertThat(response.mapVersion()).isNull();
        verifyNoInteractions(aiLocalizationClient);
    }

    private AiLocalizationProperties properties() {
        return new AiLocalizationProperties(
                "http://ai.test",
                "secret-token",
                300,
                6000,
                Map.of(1L, "YS-2026-07-23.1")
        );
    }
}

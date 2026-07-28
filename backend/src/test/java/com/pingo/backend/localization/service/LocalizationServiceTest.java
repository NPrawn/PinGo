package com.pingo.backend.localization.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.pingo.backend.localization.client.AiLocalizationClient;
import com.pingo.backend.localization.client.AiLocalizationClientErrorType;
import com.pingo.backend.localization.client.AiLocalizationClientException;
import com.pingo.backend.localization.client.dto.AiLocalizationRequestMetadata;
import com.pingo.backend.localization.client.dto.AiLocalizationResponse;
import com.pingo.backend.localization.client.dto.AiLocalizationStatus;
import com.pingo.backend.localization.dto.response.LocalizationFallbackOption;
import com.pingo.backend.localization.dto.response.LocalizationResultStatus;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

class LocalizationServiceTest {

    private AiLocalizationClient aiLocalizationClient;
    private LocalizationService localizationService;

    @BeforeEach
    void setUp() {
        aiLocalizationClient = mock(AiLocalizationClient.class);
        localizationService = new LocalizationService(
                aiLocalizationClient,
                new AiLocalizationStatusMapper(),
                new LocalizationFallbackPolicy()
        );
    }

    @Test
    void localizeReturnsSuccessWhenAiLocalized() {
        MockMultipartFile image = image();
        AiLocalizationRequestMetadata metadata = metadata();

        when(aiLocalizationClient.localize("loc-1", "YS-2026-07-23.1", image, metadata))
                .thenReturn(aiResponse(AiLocalizationStatus.LOCALIZED, null));

        var response = localizationService.localize("loc-1", "YS-2026-07-23.1", image, metadata);

        assertThat(response.resultStatus()).isEqualTo(LocalizationResultStatus.SUCCESS);
        assertThat(response.fallbackOptions()).isEmpty();
    }

    @Test
    void localizeReturnsFallbackWhenAiLowQuality() {
        MockMultipartFile image = image();
        AiLocalizationRequestMetadata metadata = metadata();

        when(aiLocalizationClient.localize("loc-1", "YS-2026-07-23.1", image, metadata))
                .thenReturn(aiResponse(AiLocalizationStatus.LOW_GEOMETRIC_QUALITY, "LOW_GEOMETRIC_QUALITY"));

        var response = localizationService.localize("loc-1", "YS-2026-07-23.1", image, metadata);

        assertThat(response.resultStatus()).isEqualTo(LocalizationResultStatus.LOW_CONFIDENCE);
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
        AiLocalizationRequestMetadata metadata = metadata();

        when(aiLocalizationClient.localize("loc-1", "YS-2026-07-23.1", image, metadata))
                .thenThrow(new AiLocalizationClientException(
                        AiLocalizationClientErrorType.TIMEOUT,
                        "timeout"
                ));

        var response = localizationService.localize("loc-1", "YS-2026-07-23.1", image, metadata);

        assertThat(response.resultStatus()).isEqualTo(LocalizationResultStatus.TIMEOUT);
        assertThat(response.fallbackOptions()).containsExactly(
                LocalizationFallbackOption.RETRY_CAPTURE,
                LocalizationFallbackOption.SELECT_ON_MAP,
                LocalizationFallbackOption.REQUEST_CONSULTATION
        );
    }

    @Test
    void localizeReturnsUnavailableFallbackWhenClientUnavailable() {
        MockMultipartFile image = image();
        AiLocalizationRequestMetadata metadata = metadata();

        when(aiLocalizationClient.localize("loc-1", "YS-2026-07-23.1", image, metadata))
                .thenThrow(new AiLocalizationClientException(
                        AiLocalizationClientErrorType.UNAVAILABLE,
                        "unavailable"
                ));

        var response = localizationService.localize("loc-1", "YS-2026-07-23.1", image, metadata);

        assertThat(response.resultStatus()).isEqualTo(LocalizationResultStatus.AI_SERVER_UNAVAILABLE);
        assertThat(response.fallbackOptions()).containsExactly(
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
                null,
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

    private AiLocalizationRequestMetadata metadata() {
        return new AiLocalizationRequestMetadata(
                1L,
                null,
                null
        );
    }
}
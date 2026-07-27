package com.pingo.backend.localization.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.pingo.backend.localization.dto.response.LocalizationFallbackOption;
import com.pingo.backend.localization.dto.response.LocalizationResultStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class LocalizationFallbackPolicyTest {

    private LocalizationFallbackPolicy policy;

    @BeforeEach
    void setUp() {
        policy = new LocalizationFallbackPolicy();
    }

    @Test
    void successReturnsNoFallbackOptions() {
        assertThat(policy.optionsFor(LocalizationResultStatus.SUCCESS)).isEmpty();
    }

    @Test
    void lowConfidenceReturnsFullFallbackOptions() {
        assertThat(policy.optionsFor(LocalizationResultStatus.LOW_CONFIDENCE))
                .containsExactly(
                        LocalizationFallbackOption.RETRY_CAPTURE,
                        LocalizationFallbackOption.SELECT_LANDMARK,
                        LocalizationFallbackOption.SELECT_ON_MAP,
                        LocalizationFallbackOption.REQUEST_CONSULTATION
                );
    }

    @Test
    void noMatchReturnsFullFallbackOptions() {
        assertThat(policy.optionsFor(LocalizationResultStatus.NO_MATCH))
                .containsExactly(
                        LocalizationFallbackOption.RETRY_CAPTURE,
                        LocalizationFallbackOption.SELECT_LANDMARK,
                        LocalizationFallbackOption.SELECT_ON_MAP,
                        LocalizationFallbackOption.REQUEST_CONSULTATION
                );
    }

    @Test
    void timeoutReturnsRetryMapAndConsultationOptions() {
        assertThat(policy.optionsFor(LocalizationResultStatus.TIMEOUT))
                .containsExactly(
                        LocalizationFallbackOption.RETRY_CAPTURE,
                        LocalizationFallbackOption.SELECT_ON_MAP,
                        LocalizationFallbackOption.REQUEST_CONSULTATION
                );
    }

    @Test
    void unavailableReturnsMapAndConsultationOptions() {
        assertThat(policy.optionsFor(LocalizationResultStatus.AI_SERVER_UNAVAILABLE))
                .containsExactly(
                        LocalizationFallbackOption.SELECT_ON_MAP,
                        LocalizationFallbackOption.REQUEST_CONSULTATION
                );
    }

    @Test
    void invalidImageReturnsRetryAndMapOptions() {
        assertThat(policy.optionsFor(LocalizationResultStatus.INVALID_IMAGE))
                .containsExactly(
                        LocalizationFallbackOption.RETRY_CAPTURE,
                        LocalizationFallbackOption.SELECT_ON_MAP
                );
    }
}

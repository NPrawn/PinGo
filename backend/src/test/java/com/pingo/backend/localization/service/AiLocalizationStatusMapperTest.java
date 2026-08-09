package com.pingo.backend.localization.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.pingo.backend.localization.dto.response.LocalizationResultStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

public class AiLocalizationStatusMapperTest {

    private AiLocalizationStatusMapper mapper;

    @BeforeEach
    void setUp() {
        mapper = new AiLocalizationStatusMapper();
    }

    @Test
    void mapsLocalizedToSuccess() {
        assertThat(mapper.map("LOCALIZED", null))
                .isEqualTo(LocalizationResultStatus.SUCCESS);
    }

    @Test
    void mapsInvalidImage() {
        assertThat(mapper.map("INVALID_IMAGE", "INVALID_IMAGE"))
                .isEqualTo(LocalizationResultStatus.INVALID_IMAGE);
    }

    @Test
    void mapsInvalidIntrinsics() {
        assertThat(mapper.map("INVALID_INTRINSICS", "INVALID_INTRINSICS"))
                .isEqualTo(LocalizationResultStatus.INVALID_INTRINSICS);
    }

    @Test
    void mapsMapNotLoadedToMapNotReady() {
        assertThat(mapper.map("MAP_NOT_LOADED", "MAP_NOT_LOADED"))
                .isEqualTo(LocalizationResultStatus.MAP_NOT_READY);
    }

    @Test
    void mapsMatchingFailuresToNoMatch() {
        assertThat(mapper.map("NO_RETRIEVAL_CANDIDATE", "NO_RETRIEVAL_CANDIDATE"))
                .isEqualTo(LocalizationResultStatus.NO_MATCH);
        assertThat(mapper.map("INSUFFICIENT_MATCHES", "INSUFFICIENT_MATCHES"))
                .isEqualTo(LocalizationResultStatus.NO_MATCH);
        assertThat(mapper.map("POSE_ESTIMATION_FAILED", "POSE_ESTIMATION_FAILED"))
                .isEqualTo(LocalizationResultStatus.NO_MATCH);
    }

    @Test
    void mapsLowGeometricQualityToLowConfidence() {
        assertThat(mapper.map("LOW_GEOMETRIC_QUALITY", "LOW_GEOMETRIC_QUALITY"))
                .isEqualTo(LocalizationResultStatus.LOW_CONFIDENCE);
    }

    @Test
    void mapsOverloaded() {
        assertThat(mapper.map("OVERLOADED", "OVERLOADED"))
                .isEqualTo(LocalizationResultStatus.OVERLOADED);
    }

    @Test
    void mapsEngineNotReadyToAiServerUnavailable() {
        assertThat(mapper.map("INTERNAL_ERROR", "ENGINE_NOT_READY"))
                .isEqualTo(LocalizationResultStatus.AI_SERVER_UNAVAILABLE);
    }

    @Test
    void mapsUnknownStatusToInternalError() {
        assertThat(mapper.map("UNKNOWN", "UNKNOWN"))
                .isEqualTo(LocalizationResultStatus.INTERNAL_ERROR);
    }
}

package com.pingo.backend.localization.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.pingo.backend.localization.dto.request.CameraMetadataRequest;
import com.pingo.backend.localization.dto.request.LocalizationRequestMetadata;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class AiLocalizationRequestMapperTest {

    private AiLocalizationRequestMapper mapper;

    @BeforeEach
    void setUp() {
        mapper = new AiLocalizationRequestMapper();
    }

    @Test
    void mapsRequestMetadataToAiMetadata() {
        Instant capturedAt = Instant.parse("2026-07-23T08:10:11.123Z");
        LocalizationRequestMetadata request = new LocalizationRequestMetadata(
                "usr_sess_01JABC",
                1L,
                "YS-2026-07-23.1",
                126.8,
                capturedAt,
                new CameraMetadataRequest(
                        "PINHOLE",
                        1280,
                        720,
                        List.of(1050.2, 1048.8, 640.0, 360.0),
                        "DEVICE_PROFILE"
                )
        );

        var aiMetadata = mapper.toAiMetadata(request);

        assertThat(aiMetadata.stationId()).isEqualTo(1L);
        assertThat(aiMetadata.capturedAt()).isEqualTo(capturedAt);
        assertThat(aiMetadata.camera().model()).isEqualTo("PINHOLE");
        assertThat(aiMetadata.camera().width()).isEqualTo(1280);
        assertThat(aiMetadata.camera().height()).isEqualTo(720);
        assertThat(aiMetadata.camera().params()).containsExactly(1050.2, 1048.8, 640.0, 360.0);
        assertThat(aiMetadata.camera().intrinsicsSource()).isEqualTo("DEVICE_PROFILE");
    }

    @Test
    void mapsNullCameraToNullAiCamera() {
        LocalizationRequestMetadata request = new LocalizationRequestMetadata(
                "usr_sess_01JABC",
                1L,
                "YS-2026-07-23.1",
                null,
                null,
                null
        );

        var aiMetadata = mapper.toAiMetadata(request);

        assertThat(aiMetadata.stationId()).isEqualTo(1L);
        assertThat(aiMetadata.camera()).isNull();
        assertThat(aiMetadata.capturedAt()).isNull();
    }
}
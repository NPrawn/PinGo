package com.pingo.backend.localization.dto.response;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class LocalizationResponseTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void serializesPositionAndStartNodeFields() throws Exception {
        LocalizationResponse response = new LocalizationResponse(
                "loc_01JABC",
                LocalizationResultStatus.SUCCESS,
                "YS-2026-07-23.1",
                new LocalizedPositionResponse(
                        2L, "B2",
                        new java.math.BigDecimal("-0.975"),
                        new java.math.BigDecimal("27.717"),
                        new java.math.BigDecimal("0.000"),
                        new java.math.BigDecimal("0.497")),
                123L,
                "B2-B3 엘리베이터 A",
                List.of(),
                2310
        );

        String json = objectMapper.writeValueAsString(response);

        assertThat(json).contains("\"floorId\":2");
        assertThat(json).contains("\"floorCode\":\"B2\"");
        assertThat(json).contains("\"mapX\":-0.975");
        assertThat(json).contains("\"mapY\":27.717");
        assertThat(json).contains("\"mapZ\":0.000");
        assertThat(json).contains("\"accuracyM\":0.497");
        assertThat(json).contains("\"startNodeId\":123");
        assertThat(json).contains("\"startNodeLabel\":\"B2-B3 엘리베이터 A\"");
    }

    @Test
    void serializesStatusAndFallbackOptionsAsApiContractCodes() throws Exception {
        LocalizationResponse response = new LocalizationResponse(
                "loc_01JABC",
                LocalizationResultStatus.LOW_CONFIDENCE,
                "YS-2026-07-23.1",
                null,
                null,
                null,
                List.of(
                        LocalizationFallbackOption.RETRY_CAPTURE,
                        LocalizationFallbackOption.SELECT_LANDMARK,
                        LocalizationFallbackOption.SELECT_ON_MAP,
                        LocalizationFallbackOption.REQUEST_CONSULTATION
                ),
                2310
        );

        String json = objectMapper.writeValueAsString(response);

        assertThat(json).contains("\"requestId\":\"loc_01JABC\"");
        assertThat(json).contains("\"resultStatus\":\"low_confidence\"");
        assertThat(json).contains("\"mapVersion\":\"YS-2026-07-23.1\"");
        assertThat(json).contains("\"fallbackOptions\":[\"retry_capture\",\"select_landmark\",\"select_on_map\",\"request_consultation\"]");
        assertThat(json).contains("\"processingTimeMs\":2310");
    }
}

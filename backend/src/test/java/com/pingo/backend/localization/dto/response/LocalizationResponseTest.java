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
                        new PlanarDirectionResponse(
                                new java.math.BigDecimal("0.930418"),
                                new java.math.BigDecimal("-0.366501")),
                        new java.math.BigDecimal("0.497")),
                123L,
                "B2-B3 엘리베이터 A",
                "B2-B3 Elevator A",
                null,
                0.87,
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
        assertThat(json).contains("\"startNodeLabelEn\":\"B2-B3 Elevator A\"");
        assertThat(json).contains("\"confidenceScore\":0.87");
        // FE 는 forwardMap.x / forwardMap.y 로 읽는다. 평탄화하면 계약이 깨진다.
        assertThat(json).contains("\"forwardMap\":{\"x\":0.930418,\"y\":-0.366501}");
    }

    @Test
    void serializesForwardMapAsNullWhenDirectionIsUnavailable() throws Exception {
        LocalizationResponse response = new LocalizationResponse(
                "loc_01JABC",
                LocalizationResultStatus.SUCCESS,
                "YS-2026-07-23.1",
                new LocalizedPositionResponse(
                        2L, "B2",
                        new java.math.BigDecimal("-0.975"),
                        new java.math.BigDecimal("27.717"),
                        new java.math.BigDecimal("0.000"),
                        null,
                        new java.math.BigDecimal("0.497")),
                123L,
                "B2-B3 엘리베이터 A",
                "B2-B3 Elevator A",
                null,
                0.87,
                List.of(),
                2310
        );

        String json = objectMapper.writeValueAsString(response);

        // 방향이 없어도 좌표는 그대로 나간다. 필드가 사라지면 FE 가 구버전 응답과 구분하지 못한다.
        assertThat(json).contains("\"forwardMap\":null");
        assertThat(json).contains("\"mapX\":-0.975");
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

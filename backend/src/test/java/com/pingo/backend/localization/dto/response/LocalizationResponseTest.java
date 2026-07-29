package com.pingo.backend.localization.dto.response;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class LocalizationResponseTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void serializesStatusAndFallbackOptionsAsApiContractCodes() throws Exception {
        LocalizationResponse response = new LocalizationResponse(
                "loc_01JABC",
                LocalizationResultStatus.LOW_CONFIDENCE,
                "YS-2026-07-23.1",
                List.of(),
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

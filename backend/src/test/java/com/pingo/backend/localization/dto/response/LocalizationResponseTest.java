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
                LocalizationResultStatus.LOW_CONFIDENCE,
                List.of(),
                List.of(
                        LocalizationFallbackOption.RETRY_CAPTURE,
                        LocalizationFallbackOption.SELECT_LANDMARK,
                        LocalizationFallbackOption.SELECT_ON_MAP,
                        LocalizationFallbackOption.REQUEST_CONSULTATION
                )
        );

        String json = objectMapper.writeValueAsString(response);

        assertThat(json).contains("\"resultStatus\":\"low_confidence\"");
        assertThat(json).contains("\"fallbackOptions\":[\"retry_capture\",\"select_landmark\",\"select_on_map\",\"request_consultation\"]");
    }
}

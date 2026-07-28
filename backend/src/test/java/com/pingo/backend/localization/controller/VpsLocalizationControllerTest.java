package com.pingo.backend.localization.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.startsWith;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.pingo.backend.global.exception.GlobalExceptionHandler;
import com.pingo.backend.localization.dto.response.LocalizationFallbackOption;
import com.pingo.backend.localization.dto.response.LocalizationResponse;
import com.pingo.backend.localization.dto.response.LocalizationResultStatus;
import com.pingo.backend.localization.service.LocalizationService;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class VpsLocalizationControllerTest {

    private LocalizationService localizationService;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        localizationService = Mockito.mock(LocalizationService.class);
        mockMvc = MockMvcBuilders.standaloneSetup(new VpsLocalizationController(localizationService))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void localizeReturnsFallbackResponse() throws Exception {
        when(localizationService.localize(startsWith("loc_"), any(), any()))
                .thenReturn(new LocalizationResponse(
                        LocalizationResultStatus.LOW_CONFIDENCE,
                        List.of(),
                        List.of(LocalizationFallbackOption.RETRY_CAPTURE)
                ));

        mockMvc.perform(multipart("/api/vps/localize")
                        .file(image())
                        .file(metadata()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.resultStatus").value("low_confidence"))
                .andExpect(jsonPath("$.data.fallbackOptions[0]").value("retry_capture"));
    }

    @Test
    void localizeReturnsBadRequestForMissingMetadata() throws Exception {
        mockMvc.perform(multipart("/api/vps/localize")
                        .file(image()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }

    @Test
    void localizeReturnsBadRequestForEmptyImage() throws Exception {
        MockMultipartFile emptyImage = new MockMultipartFile(
                "image",
                "query.jpg",
                "image/jpeg",
                new byte[0]
        );

        mockMvc.perform(multipart("/api/vps/localize")
                        .file(emptyImage)
                        .file(metadata()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }

    @Test
    void localizeReturnsBadRequestForUnsupportedImageType() throws Exception {
        MockMultipartFile textFile = new MockMultipartFile(
                "image",
                "query.txt",
                "text/plain",
                "image".getBytes(StandardCharsets.UTF_8)
        );

        mockMvc.perform(multipart("/api/vps/localize")
                        .file(textFile)
                        .file(metadata()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }

    @Test
    void localizeReturnsBadRequestForInvalidMetadata() throws Exception {
        MockMultipartFile invalidMetadata = new MockMultipartFile(
                "metadata",
                "",
                MediaType.APPLICATION_JSON_VALUE,
                """
                {
                  "userSessionId": "",
                  "stationId": 1,
                  "mapVersion": "YS-2026-07-23.1"
                }
                """.getBytes(StandardCharsets.UTF_8)
        );

        mockMvc.perform(multipart("/api/vps/localize")
                        .file(image())
                        .file(invalidMetadata))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }

    private MockMultipartFile image() {
        return new MockMultipartFile(
                "image",
                "query.jpg",
                "image/jpeg",
                "image".getBytes(StandardCharsets.UTF_8)
        );
    }

    private MockMultipartFile metadata() {
        return new MockMultipartFile(
                "metadata",
                "",
                MediaType.APPLICATION_JSON_VALUE,
                """
                {
                  "userSessionId": "usr_sess_01JABC",
                  "stationId": 1,
                  "mapVersion": "YS-2026-07-23.1"
                }
                """.getBytes(StandardCharsets.UTF_8)
        );
    }
}

package com.pingo.backend.consultation.fallback;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pingo.backend.consultation.fallback.dto.request.ConsultationFallbackEventRequest;
import com.pingo.backend.global.exception.GlobalExceptionHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class ConsultationFallbackControllerTest {

    private ConsultationFallbackEventPublisher fallbackEventPublisher;
    private MockMvc mockMvc;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        fallbackEventPublisher = mock(ConsultationFallbackEventPublisher.class);
        ConsultationFallbackController controller = new ConsultationFallbackController(fallbackEventPublisher);
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
        objectMapper = new ObjectMapper();
    }

    @Test
    void publishFallbackEventReturnsSuccess() throws Exception {
        ConsultationFallbackEventRequest request = new ConsultationFallbackEventRequest(
                ConsultationFallbackEventType.VIDEO_FAILED,
                "camera permission denied"
        );

        mockMvc.perform(post("/api/consultations/consultation-1/fallback-events")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        verify(fallbackEventPublisher).publishVideoFailed("consultation-1", "camera permission denied");
    }

    @Test
    void publishFallbackEventReturnsBadRequestForMissingType() throws Exception {
        mockMvc.perform(post("/api/consultations/consultation-1/fallback-events")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }
}
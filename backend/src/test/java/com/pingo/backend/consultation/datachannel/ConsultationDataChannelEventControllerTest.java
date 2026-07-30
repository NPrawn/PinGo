package com.pingo.backend.consultation.datachannel;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pingo.backend.global.exception.GlobalExceptionHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.notNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class ConsultationDataChannelEventControllerTest {

    private ConsultationDataChannelEventPublisher dataChannelEventPublisher;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        dataChannelEventPublisher = mock(ConsultationDataChannelEventPublisher.class);
        ConsultationDataChannelEventController controller =
                new ConsultationDataChannelEventController(dataChannelEventPublisher);
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void publishDataChannelEventReturnsSuccess() throws Exception {
        mockMvc.perform(post("/api/consultations/consultation-1/data-channel-events")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "type": "GUIDE_MESSAGE_SENT",
                                  "payload": {
                                    "message": "왼쪽으로 이동하세요."
                                  }
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        verify(dataChannelEventPublisher).publish(
                eq("consultation-1"),
                eq(ConsultationDataChannelEventType.GUIDE_MESSAGE_SENT),
                notNull()
        );
    }

    @Test
    void publishDataChannelEventReturnsBadRequestForMissingType() throws Exception {
        mockMvc.perform(post("/api/consultations/consultation-1/data-channel-events")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "payload": {
                                    "message": "왼쪽으로 이동하세요."
                                  }
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }
}
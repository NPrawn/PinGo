package com.pingo.backend.consultation.datachannel;

import com.pingo.backend.global.exception.GlobalExceptionHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
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

    /**
     * 프론트가 실제로 보내는 그리기 이벤트를 받아 줘야 우회로가 뜻을 갖는다.
     *
     * DataChannel 이 열리지 않은 상담에서 상담자가 그린 선은 이 경로로만 사용자에게 간다.
     * enum 에 없으면 요청이 400 으로 거절돼 우회로가 통째로 막힌다.
     */
    @ParameterizedTest
    @ValueSource(strings = {"DRAW_STROKE_START", "DRAW_STROKE_MOVE", "DRAW_STROKE_END", "DRAW_CLEAR"})
    void publishDataChannelEventAcceptsDrawEvents(String type) throws Exception {
        mockMvc.perform(post("/api/consultations/consultation-1/data-channel-events")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "type": "%s",
                                  "payload": {
                                    "eventType": "%s",
                                    "strokeId": "stroke_1"
                                  }
                                }
                                """.formatted(type, type)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        verify(dataChannelEventPublisher).publish(
                eq("consultation-1"),
                eq(ConsultationDataChannelEventType.valueOf(type)),
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
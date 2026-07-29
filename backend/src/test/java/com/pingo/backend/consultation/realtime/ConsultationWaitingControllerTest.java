package com.pingo.backend.consultation.realtime;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;


public class ConsultationWaitingControllerTest {

    private ConsultationWaitingEmitterRegistry emitterRegistry;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        emitterRegistry = mock(ConsultationWaitingEmitterRegistry.class);
        ConsultationWaitingController controller = new ConsultationWaitingController(emitterRegistry);
        mockMvc = MockMvcBuilders.standaloneSetup(controller).build();
    }

    @Test
    void subscribeWaitingEventsReturnsSseEmitter() throws Exception {
        SseEmitter emitter = new SseEmitter();
        when(emitterRegistry.register("consultation-1")).thenReturn(emitter);

        mockMvc.perform(get("/api/consultations/consultation-1/waiting-events"))
                .andExpect(status().isOk())
                .andExpect(request().asyncStarted());

        verify(emitterRegistry).register("consultation-1");
    }
}

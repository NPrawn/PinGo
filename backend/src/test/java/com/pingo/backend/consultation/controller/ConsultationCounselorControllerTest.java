package com.pingo.backend.consultation.controller;

import com.pingo.backend.consultation.domain.ConsultationStatus;
import com.pingo.backend.consultation.dto.response.ConsultationAcceptResponse;
import com.pingo.backend.consultation.dto.response.ConsultationEndResponse;
import com.pingo.backend.consultation.dto.response.ConsultationRejectResponse;
import com.pingo.backend.consultation.service.ConsultationSessionService;
import com.pingo.backend.global.exception.BusinessException;
import com.pingo.backend.global.exception.ErrorCode;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = ConsultationCounselorController.class)
@AutoConfigureMockMvc(addFilters = false)
class ConsultationCounselorControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ConsultationSessionService consultationSessionService;

    private static final String CONSULTATION_ID = "cs_abc123";

    @Test
    void acceptConsultation_성공() throws Exception {
        ConsultationAcceptResponse response = new ConsultationAcceptResponse(
                CONSULTATION_ID, ConsultationStatus.ACCEPTED, 7L, "room_" + CONSULTATION_ID, "signaling-token"
        );
        given(consultationSessionService.accept(eq(CONSULTATION_ID), any())).willReturn(response);

        mockMvc.perform(post("/api/consultations/{id}/accept", CONSULTATION_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ACCEPTED"))
                .andExpect(jsonPath("$.data.signalingRoomId").value("room_" + CONSULTATION_ID))
                .andExpect(jsonPath("$.data.signalingAccessToken").value("signaling-token"));
    }

    @Test
    void acceptConsultation_실패_수락_불가능한_상태() throws Exception {
        given(consultationSessionService.accept(eq(CONSULTATION_ID), any()))
                .willThrow(new BusinessException(ErrorCode.CONSULTATION_NOT_ACCEPTABLE));

        mockMvc.perform(post("/api/consultations/{id}/accept", CONSULTATION_ID))
                .andExpect(status().isConflict());
    }

    @Test
    void rejectConsultation_성공() throws Exception {
        ConsultationRejectResponse response = new ConsultationRejectResponse(
                CONSULTATION_ID, ConsultationStatus.REJECTED
        );
        given(consultationSessionService.reject(eq(CONSULTATION_ID), any())).willReturn(response);

        mockMvc.perform(post("/api/consultations/{id}/reject", CONSULTATION_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("REJECTED"));
    }

    @Test
    void rejectConsultation_실패_존재하지_않는_상담() throws Exception {
        given(consultationSessionService.reject(eq(CONSULTATION_ID), any()))
                .willThrow(new BusinessException(ErrorCode.CONSULTATION_NOT_FOUND));

        mockMvc.perform(post("/api/consultations/{id}/reject", CONSULTATION_ID))
                .andExpect(status().isNotFound());
    }

    @Test
    void endConsultation_성공() throws Exception {
        ConsultationEndResponse response = new ConsultationEndResponse(
                CONSULTATION_ID, ConsultationStatus.ENDED
        );
        given(consultationSessionService.end(eq(CONSULTATION_ID), any())).willReturn(response);

        mockMvc.perform(post("/api/consultations/{id}/end", CONSULTATION_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ENDED"));
    }

    @Test
    void endConsultation_실패_종료_불가능한_상태() throws Exception {
        given(consultationSessionService.end(eq(CONSULTATION_ID), any()))
                .willThrow(new BusinessException(ErrorCode.CONSULTATION_NOT_ENDABLE));

        mockMvc.perform(post("/api/consultations/{id}/end", CONSULTATION_ID))
                .andExpect(status().isConflict());
    }
}

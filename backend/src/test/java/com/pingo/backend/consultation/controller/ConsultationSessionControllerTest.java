package com.pingo.backend.consultation.controller;

import com.pingo.backend.consultation.domain.ConsultationStatus;
import com.pingo.backend.consultation.domain.ProblemType;
import com.pingo.backend.consultation.dto.request.ConsultationCreateRequest;
import com.pingo.backend.consultation.dto.request.ConsultationEndRequest;
import com.pingo.backend.consultation.dto.response.ConsultationCancelResponse;
import com.pingo.backend.consultation.dto.response.ConsultationCreateResponse;
import com.pingo.backend.consultation.dto.response.ConsultationEndResponse;
import com.pingo.backend.consultation.dto.response.ConsultationResponse;
import com.pingo.backend.consultation.service.ConsultationSessionService;
import com.pingo.backend.global.exception.BusinessException;
import com.pingo.backend.global.exception.ErrorCode;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

import java.time.LocalDateTime;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = ConsultationSessionController.class)
@AutoConfigureMockMvc(addFilters = false)
class ConsultationSessionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ConsultationSessionService consultationSessionService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private static final String CONSULTATION_ID = "cs_abc123";
    private static final String USER_SESSION_ID = "usr_9f3a2b";

    @Test
    void createConsultation_성공() throws Exception {
        ConsultationCreateRequest request = new ConsultationCreateRequest(
                USER_SESSION_ID, 1L, ProblemType.CANNOT_FIND_EXIT,
                15L, "place", 3L, true, true
        );
        ConsultationCreateResponse response = new ConsultationCreateResponse(
                CONSULTATION_ID, ConsultationStatus.WAITING, LocalDateTime.now()
        );
        given(consultationSessionService.create(any())).willReturn(response);

        mockMvc.perform(post("/api/consultations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.consultationId").value(CONSULTATION_ID));
    }

    @Test
    void getConsultation_성공() throws Exception {
        ConsultationResponse response = new ConsultationResponse(
                CONSULTATION_ID, ConsultationStatus.ACCEPTED, 7L, "room_" + CONSULTATION_ID, "signaling-token"
        );
        given(consultationSessionService.get(CONSULTATION_ID, USER_SESSION_ID)).willReturn(response);

        mockMvc.perform(get("/api/consultations/{id}", CONSULTATION_ID)
                        .param("userSessionId", USER_SESSION_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.consultationId").value(CONSULTATION_ID))
                .andExpect(jsonPath("$.data.signalingAccessToken").value("signaling-token"));
    }

    @Test
    void getConsultation_실패_userSessionId_파라미터_누락() throws Exception {
        mockMvc.perform(get("/api/consultations/{id}", CONSULTATION_ID))
                .andExpect(status().isBadRequest());
    }

    @Test
    void getConsultation_실패_존재하지_않거나_소유자가_아님() throws Exception {
        given(consultationSessionService.get(CONSULTATION_ID, USER_SESSION_ID))
                .willThrow(new BusinessException(ErrorCode.CONSULTATION_NOT_FOUND));

        mockMvc.perform(get("/api/consultations/{id}", CONSULTATION_ID)
                        .param("userSessionId", USER_SESSION_ID))
                .andExpect(status().isNotFound());
    }

    @Test
    void cancelConsultation_성공() throws Exception {
        ConsultationCancelResponse response = new ConsultationCancelResponse(
                CONSULTATION_ID, ConsultationStatus.CANCELED
        );
        given(consultationSessionService.cancel(CONSULTATION_ID, USER_SESSION_ID)).willReturn(response);

        mockMvc.perform(delete("/api/consultations/{id}", CONSULTATION_ID)
                        .param("userSessionId", USER_SESSION_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("CANCELED"));
    }

    @Test
    void cancelConsultation_실패_userSessionId_파라미터_누락() throws Exception {
        mockMvc.perform(delete("/api/consultations/{id}", CONSULTATION_ID))
                .andExpect(status().isBadRequest());
    }

    @Test
    void endConsultation_성공_사용자() throws Exception {
        ConsultationEndRequest request = new ConsultationEndRequest("user", USER_SESSION_ID);
        ConsultationEndResponse response = new ConsultationEndResponse(CONSULTATION_ID, ConsultationStatus.ENDED);
        given(consultationSessionService.end(eq(CONSULTATION_ID), any(), any())).willReturn(response);

        mockMvc.perform(post("/api/consultations/{id}/end", CONSULTATION_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ENDED"));
    }

    @Test
    void endConsultation_실패_잘못된_endedBy_값() throws Exception {
        String invalidBody = """
            {"endedBy": "robot"}
            """;

        mockMvc.perform(post("/api/consultations/{id}/end", CONSULTATION_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(invalidBody))
                .andExpect(status().isBadRequest());
    }

    @Test
    void endConsultation_실패_종료_불가능한_상태() throws Exception {
        ConsultationEndRequest request = new ConsultationEndRequest("user", USER_SESSION_ID);
        given(consultationSessionService.end(eq(CONSULTATION_ID), any(), any()))
                .willThrow(new BusinessException(ErrorCode.CONSULTATION_NOT_ENDABLE));

        mockMvc.perform(post("/api/consultations/{id}/end", CONSULTATION_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isConflict());
    }
}

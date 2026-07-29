package com.pingo.backend.consultation.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pingo.backend.consultation.domain.ConsultationStatus;
import com.pingo.backend.consultation.domain.ProblemType;
import com.pingo.backend.consultation.dto.request.ConsultationCreateRequest;
import com.pingo.backend.consultation.dto.response.ConsultationCancelResponse;
import com.pingo.backend.consultation.dto.response.ConsultationCreateResponse;
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

import java.time.LocalDateTime;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
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

    private final ObjectMapper objectMapper = new ObjectMapper();

    @MockitoBean
    private ConsultationSessionService consultationSessionService;

    @Test
    void createConsultation_정상_요청이면_200과_생성된_상담정보를_반환한다() throws Exception {
        ConsultationCreateRequest request = new ConsultationCreateRequest(
                "usr_abc123", 1L, ProblemType.CANNOT_FIND_EXIT,
                null, null, null, true, true
        );
        ConsultationCreateResponse response = new ConsultationCreateResponse(
                "cs_abc123", ConsultationStatus.WAITING, LocalDateTime.now()
        );
        when(consultationSessionService.create(any())).thenReturn(response);

        mockMvc.perform(post("/api/consultations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.consultationId").value("cs_abc123"))
                .andExpect(jsonPath("$.data.status").value("WAITING"));
    }

    @Test
    void createConsultation_userSessionId가_없으면_400을_반환한다() throws Exception {
        String invalidJson = """
                {
                    "stationId": 1,
                    "problemType": "CANNOT_FIND_EXIT",
                    "videoConsent": true,
                    "audioConsent": true
                }
                """;

        mockMvc.perform(post("/api/consultations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(invalidJson))
                .andExpect(status().isBadRequest());
    }

    @Test
    void getConsultation_정상_조회면_200을_반환한다() throws Exception {
        ConsultationResponse response = new ConsultationResponse(
                "cs_abc123", ConsultationStatus.ACCEPTED, 7L, "room_cs_abc123"
        );
        when(consultationSessionService.get("cs_abc123")).thenReturn(response);

        mockMvc.perform(get("/api/consultations/{id}", "cs_abc123"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ACCEPTED"))
                .andExpect(jsonPath("$.data.signalingRoomId").value("room_cs_abc123"));
    }

    @Test
    void getConsultation_존재하지_않으면_404를_반환한다() throws Exception {
        when(consultationSessionService.get("cs_none"))
                .thenThrow(new BusinessException(ErrorCode.CONSULTATION_NOT_FOUND));

        mockMvc.perform(get("/api/consultations/{id}", "cs_none"))
                .andExpect(status().isNotFound());
    }

    @Test
    void cancelConsultation_정상_취소면_200과_CANCELED_상태를_반환한다() throws Exception {
        ConsultationCancelResponse response = new ConsultationCancelResponse(
                "cs_abc123", ConsultationStatus.CANCELED
        );
        when(consultationSessionService.cancel("cs_abc123")).thenReturn(response);

        mockMvc.perform(delete("/api/consultations/{id}", "cs_abc123"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("CANCELED"));
    }

    @Test
    void cancelConsultation_취소불가_상태면_400을_반환한다() throws Exception {
        when(consultationSessionService.cancel("cs_abc123"))
                .thenThrow(new BusinessException(ErrorCode.CONSULTATION_NOT_CANCELABLE));

        mockMvc.perform(delete("/api/consultations/{id}", "cs_abc123"))
                .andExpect(status().isBadRequest());
    }
}
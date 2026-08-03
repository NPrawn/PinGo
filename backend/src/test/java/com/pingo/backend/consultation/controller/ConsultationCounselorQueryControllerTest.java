package com.pingo.backend.consultation.controller;

import com.pingo.backend.consultation.domain.ConsultationStatus;
import com.pingo.backend.consultation.domain.ProblemType;
import com.pingo.backend.consultation.dto.response.ConsultationDetailResponse;
import com.pingo.backend.consultation.dto.response.ConsultationListResponse;
import com.pingo.backend.consultation.service.ConsultationSessionService;
import com.pingo.backend.global.exception.BusinessException;
import com.pingo.backend.global.exception.ErrorCode;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = ConsultationCounselorQueryController.class)
@AutoConfigureMockMvc(addFilters = false)
class ConsultationCounselorQueryControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ConsultationSessionService consultationSessionService;



    private static final String CONSULTATION_ID = "cs_abc123";

    @Test
    void getConsultations_성공() throws Exception {
        ConsultationListResponse response = new ConsultationListResponse(
                CONSULTATION_ID, 1L, ProblemType.CANNOT_FIND_EXIT, ConsultationStatus.WAITING,
                null, null, null, null, null, null, Instant.now()
        );
        given(consultationSessionService.getConsultationsForCounselor(any(), isNull()))
                .willReturn(List.of(response));

        mockMvc.perform(get("/api/counselors/consultations"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].consultationId").value(CONSULTATION_ID));
    }

    @Test
    void getConsultations_상태_필터_성공() throws Exception {
        given(consultationSessionService.getConsultationsForCounselor(any(), eq(ConsultationStatus.WAITING)))
                .willReturn(List.of());

        mockMvc.perform(get("/api/counselors/consultations").param("status", "WAITING"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray());
    }

    @Test
    void getConsultations_실패_비활성_계정() throws Exception {
        given(consultationSessionService.getConsultationsForCounselor(any(), isNull()))
                .willThrow(new BusinessException(ErrorCode.INACTIVE_ACCOUNT));

        mockMvc.perform(get("/api/counselors/consultations"))
                .andExpect(status().isForbidden());
    }

    @Test
    void getConsultationDetail_성공() throws Exception {
        ConsultationDetailResponse response = new ConsultationDetailResponse(
                CONSULTATION_ID, 1L, ProblemType.CANNOT_FIND_EXIT, ConsultationStatus.WAITING,
                null, null, true, true, Instant.now(),
                null,null
        );
        given(consultationSessionService.getConsultationDetailForCounselor(eq(CONSULTATION_ID), any()))
                .willReturn(response);

        mockMvc.perform(get("/api/counselors/consultations/{id}", CONSULTATION_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.consultationId").value(CONSULTATION_ID));
    }

    @Test
    void getConsultationDetail_실패_존재하지_않는_상담() throws Exception {
        given(consultationSessionService.getConsultationDetailForCounselor(eq(CONSULTATION_ID), any()))
                .willThrow(new BusinessException(ErrorCode.CONSULTATION_NOT_FOUND));

        mockMvc.perform(get("/api/counselors/consultations/{id}", CONSULTATION_ID))
                .andExpect(status().isNotFound());
    }

    @Test
    void getConsultationDetail_실패_담당_역이_아님() throws Exception {
        given(consultationSessionService.getConsultationDetailForCounselor(eq(CONSULTATION_ID), any()))
                .willThrow(new BusinessException(ErrorCode.CONSULTATION_STATION_MISMATCH));

        mockMvc.perform(get("/api/counselors/consultations/{id}", CONSULTATION_ID))
                .andExpect(status().isForbidden());
    }
}
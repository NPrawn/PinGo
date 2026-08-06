package com.pingo.backend.consultation.controller;

import com.pingo.backend.consultation.domain.ConsultationScope;
import com.pingo.backend.consultation.domain.ConsultationStatus;
import com.pingo.backend.consultation.domain.ProblemType;
import com.pingo.backend.consultation.domain.SummaryStatus;
import com.pingo.backend.consultation.dto.response.ConsultationDetailResponse;
import com.pingo.backend.consultation.dto.response.ConsultationListResponse;
import com.pingo.backend.consultation.service.ConsultationSessionService;
import com.pingo.backend.global.exception.BusinessException;
import com.pingo.backend.global.exception.ErrorCode;
import com.pingo.backend.global.response.PageResponse;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.data.domain.Pageable;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
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
                CONSULTATION_ID, 1L, ProblemType.CANNOT_FIND_EXIT, ConsultationStatus.ENDED,
                100L, "김상담", SummaryStatus.COMPLETED, "3번 출구까지 안내함",
                null, null, null, null, null, Instant.now()
        );
        PageResponse<ConsultationListResponse> pageResponse = new PageResponse<>(
                List.of(response), 0, 20, 1, 1, true, true
        );
        given(consultationSessionService.getConsultationsForCounselor(
                any(),
                eq(List.of()),
                eq(ConsultationScope.ALL),
                any(Pageable.class)
        )).willReturn(pageResponse);

        mockMvc.perform(get("/api/counselors/consultations")
                        .param("page", "0")
                        .param("size", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[0].consultationId").value(CONSULTATION_ID))
                .andExpect(jsonPath("$.data.content[0].counselorId").value(100L))
                .andExpect(jsonPath("$.data.content[0].counselorName").value("김상담"))
                .andExpect(jsonPath("$.data.content[0].summaryStatus").value("COMPLETED"))
                .andExpect(jsonPath("$.data.content[0].summaryPreview").value("3번 출구까지 안내함"))
                .andExpect(jsonPath("$.data.page").value(0))
                .andExpect(jsonPath("$.data.size").value(20))
                .andExpect(jsonPath("$.data.totalElements").value(1))
                .andExpect(jsonPath("$.data.totalPages").value(1))
                .andExpect(jsonPath("$.data.first").value(true))
                .andExpect(jsonPath("$.data.last").value(true));
    }

    @Test
    void getConsultations_상태_필터_성공() throws Exception {
        PageResponse<ConsultationListResponse> emptyPage = new PageResponse<>(
                List.of(), 1, 10, 0, 0, false, true
        );
        given(consultationSessionService.getConsultationsForCounselor(
                any(),
                eq(List.of(ConsultationStatus.WAITING)),
                eq(ConsultationScope.ALL),
                any(Pageable.class)
        )).willReturn(emptyPage);

        mockMvc.perform(get("/api/counselors/consultations")
                        .param("status", "WAITING")
                        .param("page", "1")
                        .param("size", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content").isArray())
                .andExpect(jsonPath("$.data.page").value(1))
                .andExpect(jsonPath("$.data.size").value(10));
    }

    @Test
    void getConsultations_내_진행성_상담_필터_성공() throws Exception {
        PageResponse<ConsultationListResponse> emptyPage = new PageResponse<>(
                List.of(), 0, 10, 0, 0, true, true
        );
        given(consultationSessionService.getConsultationsForCounselor(
                any(),
                eq(List.of(ConsultationStatus.ACCEPTED, ConsultationStatus.IN_PROGRESS)),
                eq(ConsultationScope.MINE),
                any(Pageable.class)
        )).willReturn(emptyPage);

        mockMvc.perform(get("/api/counselors/consultations")
                        .param("statuses", "ACCEPTED,IN_PROGRESS")
                        .param("scope", "MINE")
                        .param("page", "0")
                        .param("size", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content").isArray());

        verify(consultationSessionService).getConsultationsForCounselor(
                any(),
                eq(List.of(ConsultationStatus.ACCEPTED, ConsultationStatus.IN_PROGRESS)),
                eq(ConsultationScope.MINE),
                any(Pageable.class)
        );
    }

    @Test
    void getConsultations_실패_비활성_계정() throws Exception {
        given(consultationSessionService.getConsultationsForCounselor(
                any(),
                eq(List.of()),
                eq(ConsultationScope.ALL),
                any(Pageable.class)
        ))
                .willThrow(new BusinessException(ErrorCode.INACTIVE_ACCOUNT));

        mockMvc.perform(get("/api/counselors/consultations"))
                .andExpect(status().isForbidden());
    }

    @Test
    void getConsultationDetail_성공() throws Exception {
        ConsultationDetailResponse response = new ConsultationDetailResponse(
                CONSULTATION_ID, 1L, ProblemType.CANNOT_FIND_EXIT, ConsultationStatus.WAITING,
                null, null, true, true, true, Instant.now(),
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

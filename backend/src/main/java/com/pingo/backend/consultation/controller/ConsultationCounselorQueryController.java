package com.pingo.backend.consultation.controller;

import com.pingo.backend.consultation.domain.ConsultationStatus;
import com.pingo.backend.consultation.dto.response.ConsultationDetailResponse;
import com.pingo.backend.consultation.dto.response.ConsultationListResponse;
import com.pingo.backend.consultation.service.ConsultationSessionService;
import com.pingo.backend.global.response.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/counselor/consultations")
@RequiredArgsConstructor
@Tag(name = "상담자 API", description = "상담자가 담당 역의 상담 요청을 조회하는 API")
public class ConsultationCounselorQueryController {

    private final ConsultationSessionService consultationSessionService;

    @GetMapping
    public ApiResponse<List<ConsultationListResponse>> getConsultations(
            @RequestParam(required = false) ConsultationStatus status,
            @AuthenticationPrincipal Long accountId
    ) {
        return ApiResponse.success(consultationSessionService.getConsultationsForCounselor(accountId, status));
    }

    @GetMapping("/{consultationSessionId}")
    public ApiResponse<ConsultationDetailResponse> getConsultationDetail(
            @PathVariable String consultationSessionId,
            @AuthenticationPrincipal Long accountId
    ) {
        return ApiResponse.success(consultationSessionService.getConsultationDetailForCounselor(consultationSessionId, accountId));
    }
}
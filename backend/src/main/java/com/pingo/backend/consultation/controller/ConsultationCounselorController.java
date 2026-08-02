package com.pingo.backend.consultation.controller;

import com.pingo.backend.consultation.dto.request.ConsultationTranscriptRequest;
import com.pingo.backend.consultation.dto.response.ConsultationAcceptResponse;
import com.pingo.backend.consultation.dto.response.ConsultationRejectResponse;
import com.pingo.backend.consultation.dto.response.ConsultationSummaryResponse;
import com.pingo.backend.consultation.dto.response.ConsultationSummaryStatusResponse;
import com.pingo.backend.consultation.service.ConsultationSessionService;
import com.pingo.backend.consultation.service.ConsultationSummaryService;
import com.pingo.backend.global.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/consultations")
@RequiredArgsConstructor
@Tag(name = "상담자 API", description = "상담자가 상담 요청을 수락·거절하는 API")
public class ConsultationCounselorController {

    private final ConsultationSessionService consultationSessionService;
    private final ConsultationSummaryService consultationSummaryService;

    @PostMapping("/{consultationSessionId}/accept")
    public ApiResponse<ConsultationAcceptResponse> acceptConsultation(
            @PathVariable String consultationSessionId,
            @AuthenticationPrincipal Long accountId
    ) {
        return ApiResponse.success(consultationSessionService.accept(consultationSessionId, accountId));
    }

    @PostMapping("/{consultationSessionId}/reject")
    public ApiResponse<ConsultationRejectResponse> rejectConsultation(
            @PathVariable String consultationSessionId,
            @AuthenticationPrincipal Long accountId
    ) {
        return ApiResponse.success(consultationSessionService.reject(consultationSessionId, accountId));
    }

    @PostMapping("/{consultationId}/transcript")
    @Operation(summary = "상담 전문 저장")
    public ApiResponse<ConsultationSummaryStatusResponse> submitTranscript(
            @PathVariable String consultationId,
            @AuthenticationPrincipal Long accountId,
            @Valid @RequestBody ConsultationTranscriptRequest request) {

        return ApiResponse.success(
                consultationSummaryService.submitTranscript(consultationId, accountId, request));
    }

    @GetMapping("/{consultationId}/summary")
    @Operation(summary = "상담 요약 조회")
    public ApiResponse<ConsultationSummaryResponse> getSummary(
            @PathVariable String consultationId,
            @AuthenticationPrincipal Long accountId) {

        return ApiResponse.success(
                consultationSummaryService.find(consultationId, accountId));
    }
}
package com.pingo.backend.consultation.controller;

import com.pingo.backend.consultation.dto.response.ConsultationAcceptResponse;
import com.pingo.backend.consultation.dto.response.ConsultationEndResponse;
import com.pingo.backend.consultation.dto.response.ConsultationRejectResponse;
import com.pingo.backend.consultation.service.ConsultationSessionService;
import com.pingo.backend.global.response.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/consultations")
@RequiredArgsConstructor
@Tag(name = "상담자 API", description = "상담자가 상담 요청을 수락·거절하는 API")
public class ConsultationCounselorController {

    private final ConsultationSessionService consultationSessionService;

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

    @PostMapping("/{consultationSessionId}/end")
    public ApiResponse<ConsultationEndResponse> endConsultation(
            @PathVariable String consultationSessionId,
            @AuthenticationPrincipal Long accountId
    ) {
        return ApiResponse.success(consultationSessionService.end(consultationSessionId, accountId));
    }
}

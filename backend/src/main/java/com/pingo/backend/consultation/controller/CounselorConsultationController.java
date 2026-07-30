package com.pingo.backend.consultation.controller;

import com.pingo.backend.consultation.domain.ConsultationStatus;
import com.pingo.backend.consultation.dto.response.CounselorConsultationResponse;
import com.pingo.backend.consultation.service.ConsultationSessionService;
import com.pingo.backend.global.response.ApiResponse;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/counselor/consultations")
@RequiredArgsConstructor
public class CounselorConsultationController {

    private final ConsultationSessionService consultationSessionService;

    @GetMapping
    public ApiResponse<List<CounselorConsultationResponse>> listConsultations(
            @AuthenticationPrincipal Long counselorId,
            @RequestParam(required = false) ConsultationStatus status
    ) {
        return ApiResponse.success(consultationSessionService.listForCounselor(counselorId, status));
    }
}

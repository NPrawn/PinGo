package com.pingo.backend.consultation.controller;

import com.pingo.backend.consultation.dto.request.ConsultationCreateRequest;
import com.pingo.backend.consultation.dto.response.ConsultationCancelResponse;
import com.pingo.backend.consultation.dto.response.ConsultationCreateResponse;
import com.pingo.backend.consultation.dto.response.ConsultationResponse;
import com.pingo.backend.consultation.service.ConsultationSessionService;
import com.pingo.backend.global.response.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/consultations")
@RequiredArgsConstructor
@Tag(name = "상담 API", description = "사용자가 상담을 요청·조회·취소하는 API")
public class ConsultationSessionController {

    private final ConsultationSessionService consultationSessionService;

    @PostMapping
    public ApiResponse<ConsultationCreateResponse> createConsultation(
            @Valid @RequestBody ConsultationCreateRequest request
            ){
        return ApiResponse.success(consultationSessionService.create(request));
    }

    @GetMapping("/{consultationSessionId}")
    public ApiResponse<ConsultationResponse> getConsultation(
            @PathVariable String consultationSessionId,
            @RequestParam String userSessionId
    ){
        return ApiResponse.success(consultationSessionService.get(consultationSessionId, userSessionId));
    }

    @DeleteMapping("/{consultationSessionId}")
    public ApiResponse<ConsultationCancelResponse> cancelConsultation(
            @PathVariable String consultationSessionId,
            @RequestParam String userSessionId
    ){
        return ApiResponse.success(consultationSessionService.cancel(consultationSessionId, userSessionId));
    }
}

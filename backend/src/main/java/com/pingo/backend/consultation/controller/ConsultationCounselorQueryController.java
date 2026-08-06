package com.pingo.backend.consultation.controller;

import com.pingo.backend.consultation.domain.ConsultationScope;
import com.pingo.backend.consultation.domain.ConsultationStatus;
import com.pingo.backend.consultation.dto.response.ConsultationDetailResponse;
import com.pingo.backend.consultation.dto.response.ConsultationListResponse;
import com.pingo.backend.consultation.service.ConsultationSessionService;
import com.pingo.backend.global.response.ApiResponse;
import com.pingo.backend.global.response.PageResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import static org.springframework.data.domain.Sort.Direction.ASC;

@RestController
@RequestMapping("/api/counselors/consultations")
@RequiredArgsConstructor
@Tag(name = "상담자 API", description = "상담자가 담당 역의 상담 요청을 조회하는 API")
public class ConsultationCounselorQueryController {

    private final ConsultationSessionService consultationSessionService;

    @GetMapping
    public ApiResponse<PageResponse<ConsultationListResponse>> getConsultations(
            @RequestParam(required = false) ConsultationStatus status,
            @RequestParam(required = false) List<ConsultationStatus> statuses,
            @RequestParam(defaultValue = "ALL") ConsultationScope scope,
            @PageableDefault(
                    page = 0,
                    size = 20,
                    sort = {"requestedAt", "consultationId"},
                    direction = ASC
            ) Pageable pageable,
            @AuthenticationPrincipal Long accountId
    ) {
        return ApiResponse.success(
                consultationSessionService.getConsultationsForCounselor(
                        accountId,
                        mergeStatuses(status, statuses),
                        scope,
                        pageable
                )
        );
    }

    private List<ConsultationStatus> mergeStatuses(
            ConsultationStatus status,
            List<ConsultationStatus> statuses
    ) {
        Set<ConsultationStatus> merged = new LinkedHashSet<>();
        if (status != null) {
            merged.add(status);
        }
        if (statuses != null) {
            merged.addAll(statuses);
        }
        return List.copyOf(merged);
    }

    @GetMapping("/{consultationSessionId}")
    public ApiResponse<ConsultationDetailResponse> getConsultationDetail(
            @PathVariable String consultationSessionId,
            @AuthenticationPrincipal Long accountId
    ) {
        return ApiResponse.success(consultationSessionService.getConsultationDetailForCounselor(consultationSessionId, accountId));
    }
}

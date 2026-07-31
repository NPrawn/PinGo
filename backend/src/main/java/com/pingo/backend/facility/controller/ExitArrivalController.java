package com.pingo.backend.facility.controller;

import com.pingo.backend.facility.dto.request.ExitArrivalCheckRequest;
import com.pingo.backend.facility.dto.response.ExitArrivalResponse;
import com.pingo.backend.facility.service.ExitArrivalService;
import com.pingo.backend.global.response.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 출구 도착 판정 (FR-U-011).
 *
 * <p>대상이 {@code facility} 이므로 경로도 {@code /api/facilities} 아래에 둔다.
 * 비로그인 사용자가 쓰는 API 인데 이 경로는 이미 공개로 열려 있어
 * 여러 사람이 함께 고치는 {@code SecurityConfig} 를 건드릴 필요가 없다.
 */
@RestController
@RequestMapping("/api/facilities")
@RequiredArgsConstructor
public class ExitArrivalController {

    private final ExitArrivalService exitArrivalService;

    /**
     * 사용자가 해당 출구에 도착했는지 판정한다.
     * 조회성 요청이지만 현재 위치를 본문으로 받으므로 POST 를 쓴다.
     */
    @PostMapping("/{facilityId}/arrival-check")
    public ApiResponse<ExitArrivalResponse> checkArrival(
            @PathVariable Long facilityId,
            @Valid @RequestBody ExitArrivalCheckRequest request
    ) {
        return ApiResponse.success(exitArrivalService.checkArrival(facilityId, request));
    }
}

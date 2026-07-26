package com.pingo.backend.auth.controller;

import com.pingo.backend.auth.dto.request.CounselorSelfUpdateRequest;
import com.pingo.backend.auth.dto.response.AccountDetailResponse;
import com.pingo.backend.auth.service.CounselorSelfService;
import com.pingo.backend.global.response.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/counselors")
@RequiredArgsConstructor
@Tag(name = "상담자 - 본인 계정 관리 API", description = "상담자 본인이 로그인 후 자신의 계정을 조회·수정하는 API")
public class CounselorSelfController {

    private final CounselorSelfService counselorSelfService;

    @GetMapping("/me")
    public ApiResponse<AccountDetailResponse> getMe(
            @AuthenticationPrincipal Long accountId
    ) {
        return ApiResponse.success(counselorSelfService.getMe(accountId));
    }

    @PatchMapping("/me")
    public ApiResponse<AccountDetailResponse> updateMe(
            @AuthenticationPrincipal Long accountId,
            @RequestBody @Valid CounselorSelfUpdateRequest request
            ) {
        return ApiResponse.success(counselorSelfService.updateMe(accountId,request));
    }
}
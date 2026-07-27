package com.pingo.backend.auth.controller;

import com.pingo.backend.auth.dto.request.AccountUpdateRequest;
import com.pingo.backend.auth.dto.response.AccountDetailResponse;
import com.pingo.backend.auth.dto.response.AccountListResponse;
import com.pingo.backend.auth.service.AdminAccountService;
import com.pingo.backend.global.response.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/counselors")
@RequiredArgsConstructor
@Tag(name = "관리자 - 상담자 계정 관리 API", description = "관리자가 상담자 계정을 조회하고 담당 역·활성화 여부를 관리하는 API")
public class AdminAccountController {

    private final AdminAccountService adminAccountService;

    @GetMapping
    public ApiResponse<List<AccountListResponse>> list(
            @RequestParam(required = false) Long stationId,
            @RequestParam(required = false) Boolean isActive){
        return ApiResponse.success(adminAccountService.listCounselors(stationId, isActive));
    }

    @PatchMapping("/{accountId}")
    public ApiResponse<AccountDetailResponse> update(
            @PathVariable Long accountId,
            @RequestBody AccountUpdateRequest request){
        return ApiResponse.success(adminAccountService.updateCounselor(accountId, request));
    }

    @DeleteMapping("/{accountId}")
    public ApiResponse<Void> deactivate(
            @PathVariable Long accountId){
        adminAccountService.deactivateCounselor(accountId);
        return ApiResponse.success();
    }
}
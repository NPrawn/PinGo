package com.pingo.backend.auth.controller;

import com.pingo.backend.auth.dto.request.AccountUpdateRequest;
import com.pingo.backend.auth.dto.response.AccountDetailResponse;
import com.pingo.backend.auth.dto.response.AccountListResponse;
import com.pingo.backend.auth.service.AdminAccountService;
import com.pingo.backend.global.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/counselors")
@RequiredArgsConstructor
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
        adminAccountService.deactiveCounselor(accountId);
        return ApiResponse.success();
    }
}
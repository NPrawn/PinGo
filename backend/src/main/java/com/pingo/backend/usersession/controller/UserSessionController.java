package com.pingo.backend.usersession.controller;

import com.pingo.backend.global.response.ApiResponse;
import com.pingo.backend.usersession.dto.request.UserSessionCreateRequest;
import com.pingo.backend.usersession.dto.request.UserSessionUpdateRequest;
import com.pingo.backend.usersession.dto.response.UserSessionCreateResponse;
import com.pingo.backend.usersession.dto.response.UserSessionResponse;
import com.pingo.backend.usersession.service.UserSessionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/user-sessions")
@RequiredArgsConstructor
public class UserSessionController {

    private final UserSessionService userSessionService;

    @PostMapping
    public ApiResponse<UserSessionCreateResponse> createUserSession(
            @Valid @RequestBody UserSessionCreateRequest request
            ){
        return ApiResponse.success(userSessionService.create(request.language()));
    }

    @GetMapping("/{userSessionId}")
    public ApiResponse<UserSessionResponse> getUserSession(
            @PathVariable String userSessionId
    ){
        return ApiResponse.success(userSessionService.get(userSessionId));
    }

    @PatchMapping("/{userSessionId}")
    public ApiResponse<UserSessionResponse> updateUserSession(
            @PathVariable String userSessionId,
            @Valid @RequestBody UserSessionUpdateRequest request
            ){
        return ApiResponse.success(userSessionService.update(userSessionId,request));
    }

    @DeleteMapping("/{userSessionId}")
    public ApiResponse<Boolean> deleteUserSession(
            @PathVariable String userSessionId
    ){
        boolean ended = userSessionService.end(userSessionId);
        String message = ended ? "세션이 종료되었습니다." : "이미 종료된 세션입니다.";
        return ApiResponse.success(ended, message);
    }

}

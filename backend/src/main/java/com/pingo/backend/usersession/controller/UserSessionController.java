package com.pingo.backend.usersession.controller;

import com.pingo.backend.global.response.ApiResponse;
import com.pingo.backend.usersession.dto.request.UserSessionCreateRequest;
import com.pingo.backend.usersession.dto.request.UserSessionUpdateRequest;
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
    public ApiResponse<UserSessionResponse> createUserSession(
            @Valid @RequestBody UserSessionCreateRequest request
            ){
        return ApiResponse.success(userSessionService.create(request.language()));
    }

    @PatchMapping("/{userSessionId}")
    public ApiResponse<UserSessionResponse> updateUserSession(
            @PathVariable String userSessionId,
            @Valid @RequestBody UserSessionUpdateRequest request
            ){
        return ApiResponse.success(userSessionService.update(userSessionId,request));
    }

}

package com.pingo.backend.auth.controller;

import com.pingo.backend.auth.dto.request.LoginRequest;
import com.pingo.backend.auth.dto.request.SignupRequest;
import com.pingo.backend.auth.dto.response.LoginResponse;
import com.pingo.backend.auth.dto.response.SignupResponse;
import com.pingo.backend.auth.service.AuthService;
import com.pingo.backend.global.response.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Tag(name="계정 관리 API",description = "상담자(역무원), 관리자 로그인/회원가입 API")
public class AuthController {
    private final AuthService authService;

    @PostMapping("/login")
    public ApiResponse<LoginResponse> login(@Valid @RequestBody LoginRequest request){
        return ApiResponse.success(authService.login(request));
    }

    @PostMapping("/signup")
    public ApiResponse<SignupResponse> signup(@Valid @RequestBody SignupRequest request){
        return ApiResponse.success(authService.signup(request));
    }

    @GetMapping("/check-login-id")
    public ApiResponse<Boolean> checkLoginId(@RequestParam String loginId){
        boolean available = authService.isLoginIdAvailable(loginId);
        return ApiResponse.success(available);
    }
}

package com.pingo.backend.auth.controller;

import com.pingo.backend.auth.dto.request.LoginRequest;
import com.pingo.backend.auth.dto.request.SignupRequest;
import com.pingo.backend.auth.dto.response.LoginResponse;
import com.pingo.backend.auth.dto.response.SignupResponse;
import com.pingo.backend.auth.service.AuthService;
import com.pingo.backend.global.response.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@Validated
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
    public ApiResponse<Boolean> checkLoginId(
            @NotBlank
            @Pattern(regexp = "^[a-zA-Z0-9_]{4,20}$",
                    message = "아이디는 영문·숫자·밑줄 4~20자여야 합니다.")
            @RequestParam String loginId){
        boolean available = authService.isLoginIdAvailable(loginId);
        String message = available ? "사용 가능한 아이디입니다." : "이미 사용 중인 아이디입니다.";
        return ApiResponse.success(available, message);
    }
}

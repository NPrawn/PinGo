package com.pingo.backend.auth.dto.request;

import jakarta.validation.constraints.*;

public record SignupRequest (
    @NotBlank
    @Pattern(regexp = "^[a-zA-Z0-9_]{4,20}$",
            message = "아이디는 영문·숫자·밑줄 4~20자여야 합니다.")
    String loginId,
    @NotBlank
    @Pattern(
            regexp = "^(?=.*[A-Za-z])(?=.*\\d)(?=.*[!@#$%^&*()_+\\-=\\[\\]{};':\"\\\\|,.<>/?]).{8,20}$",
            message = "비밀번호는 영문·숫자·특수문자를 포함해 8~20자여야 합니다."
    )
    String password,
    @NotBlank @Size(max=100) String name,
    @NotNull Long stationId
){}
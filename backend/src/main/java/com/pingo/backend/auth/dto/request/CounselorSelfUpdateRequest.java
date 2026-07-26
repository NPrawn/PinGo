package com.pingo.backend.auth.dto.request;

import com.pingo.backend.auth.domain.CounselorStatus;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CounselorSelfUpdateRequest (
    @Size(max = 100) String name,
    String currentPassword,
    @Pattern(
            regexp = "^(?=.*[A-Za-z])(?=.*\\d)(?=.*[!@#$%^&*()_+\\-=\\[\\]{};':\"\\\\|,.<>/?]).{8,20}$",
            message = "비밀번호는 영문·숫자·특수문자를 포함해 8~20자여야 합니다."
    )
    String newPassword,
    CounselorStatus status
){}

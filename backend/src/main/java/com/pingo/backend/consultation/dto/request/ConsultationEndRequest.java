package com.pingo.backend.consultation.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record ConsultationEndRequest(
        @NotBlank
        @Pattern(regexp = "user|counselor", message = "endedBy는 user 또는 counselor여야 합니다.")
        String endedBy,

        String userSessionId
) {
}
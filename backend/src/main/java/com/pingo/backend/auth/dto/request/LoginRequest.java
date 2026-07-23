package com.pingo.backend.auth.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record LoginRequest (
    @NotBlank String loginId,
    @NotBlank @Size(max=72) String password
){}

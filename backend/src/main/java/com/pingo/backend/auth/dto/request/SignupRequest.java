package com.pingo.backend.auth.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record SignupRequest (
    @NotBlank @Size(max=100) String loginId,
    @NotBlank @Size(min=8, max=72) String password,
    @NotBlank @Size(max=100) String name,
    @NotNull Long stationId
){}
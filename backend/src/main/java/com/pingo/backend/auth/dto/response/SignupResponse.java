package com.pingo.backend.auth.dto.response;

public record SignupResponse(
        Long accountId,
        String loginId,
        String name,
        Long stationId
) { }

package com.pingo.backend.auth.dto.response;

public record LoginResponse (
    String accessToken,
    String accountType,
    Long accountId,
    String name,
    Long stationId,
    String status
){}

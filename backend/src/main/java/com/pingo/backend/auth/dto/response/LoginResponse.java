package com.pingo.backend.auth.dto.response;

import com.pingo.backend.auth.domain.CounselorStatus;

public record LoginResponse (
    String accessToken,
    String accountType,
    Long accountId,
    String name,
    Long stationId,
    CounselorStatus status
){}

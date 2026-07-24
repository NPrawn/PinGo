package com.pingo.backend.auth.dto.response;

import com.pingo.backend.auth.domain.CounselorStatus;

import java.time.LocalDateTime;

public record AccountDetailResponse(
        Long accountId,
        String loginId,
        String name,
        Long stationId,
        boolean isActive,
        CounselorStatus status,
        LocalDateTime createdAt
) {
}

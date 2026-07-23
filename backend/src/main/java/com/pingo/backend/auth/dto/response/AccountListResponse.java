package com.pingo.backend.auth.dto.response;

import com.pingo.backend.auth.domain.CounselorStatus;

public record AccountListResponse(
        Long accountId,
        String loginId,
        String name,
        Long stationId,
        boolean isActive,
        CounselorStatus status
) {
}

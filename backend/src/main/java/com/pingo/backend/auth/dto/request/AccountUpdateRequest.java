package com.pingo.backend.auth.dto.request;

public record AccountUpdateRequest(
        Long stationId,
        Boolean isActive
) {
}

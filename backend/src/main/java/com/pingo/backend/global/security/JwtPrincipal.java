package com.pingo.backend.global.security;

import com.pingo.backend.auth.domain.AccountType;

public record JwtPrincipal(
        Long accountId,
        AccountType accountType,
        Long stationId
) {
}

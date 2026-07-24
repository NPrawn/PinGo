package com.pingo.backend.auth.dto.response;

import com.pingo.backend.auth.domain.Account;

public record SignupResponse(
        Long accountId,
        String loginId,
        String name,
        Long stationId
) {

    public static SignupResponse from(Account saved) {
       return new SignupResponse(saved.getAccountId(),saved.getLoginId(),saved.getName(),saved.getStationId());
    }
}

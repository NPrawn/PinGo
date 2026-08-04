package com.pingo.backend.usersession.dto.response;

import com.pingo.backend.usersession.domain.Language;
import com.pingo.backend.usersession.domain.UserSession;

import java.time.Instant;
import java.time.ZoneOffset;

public record UserSessionCreateResponse (
        String userSessionId,
        Language language,
        Instant expiresAt
){
    public static UserSessionCreateResponse from(UserSession session) {
    return new UserSessionCreateResponse(
            session.getUserSessionId(),
            session.getLanguage(),
            session.getExpiresAt() == null ? null : session.getExpiresAt().toInstant(ZoneOffset.UTC)
    );
}
}

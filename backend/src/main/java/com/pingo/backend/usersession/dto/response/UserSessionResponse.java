package com.pingo.backend.usersession.dto.response;

import com.pingo.backend.usersession.domain.Language;

import java.time.LocalDateTime;

public record UserSessionResponse (
        String userSessionId,
        Language language,
        LocalDateTime expiresAt
){
}

package com.pingo.backend.usersession.dto.response;

import com.pingo.backend.usersession.domain.Language;
import com.pingo.backend.usersession.domain.UserSession;

import java.time.Instant;
import java.time.ZoneOffset;

public record UserSessionResponse(

        String userSessionId,

        Language language,

        Long selectedStationId,

        Long currentNodeId,

        String destinationType,

        Long destinationId,

        Instant expiresAt
){

    public static UserSessionResponse from(UserSession session) {

        return new UserSessionResponse(

                session.getUserSessionId(),

                session.getLanguage(),

                session.getSelectedStationId(),

                session.getCurrentNodeId(),

                session.getDestinationType(),

                session.getDestinationId(),

                session.getExpiresAt() == null ? null : session.getExpiresAt().toInstant(ZoneOffset.UTC)

        );
    }
}

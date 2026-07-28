package com.pingo.backend.usersession.dto.response;

import com.pingo.backend.usersession.domain.Language;
import com.pingo.backend.usersession.domain.UserSession;

import java.time.LocalDateTime;

public record UserSessionResponse(

        String userSessionId,

        Language language,

        Long selectedStationId,

        Long currentNodeId,

        String destinationType,

        Long destinationId,

        LocalDateTime expiresAt
){

    public static UserSessionResponse from(UserSession session) {

        return new UserSessionResponse(

                session.getUserSessionId(),

                session.getLanguage(),

                session.getSelectedStationId(),

                session.getCurrentNodeId(),

                session.getDestinationType(),

                session.getDestinationId(),

                session.getExpiresAt()

        );
    }
}

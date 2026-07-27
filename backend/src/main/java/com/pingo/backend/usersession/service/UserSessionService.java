package com.pingo.backend.usersession.service;

import com.pingo.backend.global.exception.BusinessException;
import com.pingo.backend.global.exception.ErrorCode;
import com.pingo.backend.usersession.domain.Language;
import com.pingo.backend.usersession.domain.UserSession;
import com.pingo.backend.usersession.dto.request.UserSessionUpdateRequest;
import com.pingo.backend.usersession.dto.response.UserSessionResponse;
import com.pingo.backend.usersession.repository.UserSessionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UserSessionService {

    private final UserSessionRepository userSessionRepository;

    @Transactional
    public UserSessionResponse create(Language language){
        Language resolved = (language != null) ? language : Language.DEFAULT;
        UserSession session = userSessionRepository.save(UserSession.create(resolved));
        return new UserSessionResponse(session.getUserSessionId(),session.getLanguage(), session.getExpiresAt());
    }

    @Transactional
    public UserSessionResponse update(String userSessionId, UserSessionUpdateRequest request){
        UserSession session = userSessionRepository.findById(userSessionId)
                .orElseThrow(()-> new BusinessException(ErrorCode.USER_SESSION_NOT_FOUND));
        if(request.language() != null){
            session.changeLanguage(request.language());
        }
        if(request.selectedStationId() != null){
            session.changeSelectedStation(request.selectedStationId());
        }
        if(request.currentNodeId() != null){
            session.changeCurrentNode(request.currentNodeId());
        }
        // 타입/아이디 따로 바꾸는 시나리오 있는 경우
        if (request.destinationType() != null) {
            session.changeDestinationType(request.destinationType());
        }
        if (request.destinationId() != null) {
            session.changeDestinationId(request.destinationId());
        }
        // 따로 바꾸는 시나리오 없는 경우
//        if (request.destinationType() != null ^ request.destinationId() != null) {
//            throw new BusinessException(ErrorCode.INVALID_DESTINATION); // 하나만 온 경우 명시적으로 막기
//        }
//        if (request.destinationType() != null) {
//            session.changeDestination(request.destinationType(), request.destinationId());
//        }
        if(request.lastGpsLatitude() != null && request.lastGpsLongitude() != null){
            session.updateGpsLocation(request.lastGpsLatitude(), request.lastGpsLongitude());
        }
        session.renewActivity();
        return new UserSessionResponse(session.getUserSessionId(), session.getLanguage(),session.getExpiresAt());
    }
}

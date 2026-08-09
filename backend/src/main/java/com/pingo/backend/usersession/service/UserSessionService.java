package com.pingo.backend.usersession.service;

import com.pingo.backend.global.exception.BusinessException;
import com.pingo.backend.global.exception.ErrorCode;
import com.pingo.backend.route.repository.RouteNodeRepository;
import com.pingo.backend.station.repository.StationRepository;
import com.pingo.backend.usersession.domain.Language;
import com.pingo.backend.usersession.domain.UserSession;
import com.pingo.backend.usersession.dto.request.UserSessionUpdateRequest;
import com.pingo.backend.usersession.dto.response.UserSessionCreateResponse;
import com.pingo.backend.usersession.dto.response.UserSessionResponse;
import com.pingo.backend.usersession.repository.UserSessionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UserSessionService {

    private final UserSessionRepository userSessionRepository;
    private final StationRepository stationRepository;
    private final RouteNodeRepository routeNodeRepository;

    @Transactional
    public UserSessionCreateResponse create(Language language){
        Language resolved = (language != null) ? language : Language.DEFAULT;
        UserSession session = userSessionRepository.save(UserSession.create(resolved));
        return UserSessionCreateResponse.from(session);
    }

    @Transactional(readOnly = true)
    public UserSessionResponse get(String userSessionId){
        return UserSessionResponse.from(findActiveSession(userSessionId));
    }

    @Transactional
    public UserSessionResponse update(String userSessionId, UserSessionUpdateRequest request){
        UserSession session = findActiveSession(userSessionId);

        if(request.language() != null){
            session.changeLanguage(request.language());
        }
        if(request.selectedStationId() != null){
            if(!stationRepository.existsById(request.selectedStationId())){
                throw new BusinessException(ErrorCode.STATION_NOT_FOUND);
            }
            session.changeSelectedStation(request.selectedStationId());
        }
        if(request.currentNodeId() != null){
            if(!routeNodeRepository.existsById(request.currentNodeId())){
                throw new BusinessException(ErrorCode.ROUTE_NODE_NOT_FOUND);
            }
            session.changeCurrentNode(request.currentNodeId());
        }
        if ((request.destinationType() != null) ^ (request.destinationId() != null)) {
            throw new BusinessException(ErrorCode.INVALID_DESTINATION); // 하나만 온 경우 명시적으로 막기
        }
        if (request.destinationType() != null) {
            session.changeDestination(request.destinationType(), request.destinationId());
        }
        if(request.lastGpsLatitude() != null && request.lastGpsLongitude() != null){
            session.updateGpsLocation(request.lastGpsLatitude(), request.lastGpsLongitude());
        }
        session.recordActivity();
        return UserSessionResponse.from(session);
    }

    @Transactional
    public boolean end(String userSessionId){
        UserSession session = userSessionRepository.findById(userSessionId)
                .orElseThrow(()-> new BusinessException(ErrorCode.USER_SESSION_NOT_FOUND));

        if(session.isExpired()){
            throw new BusinessException(ErrorCode.USER_SESSION_ALREADY_ENDED);
        }

        // [TODO] OO 진행 중 상담 상태 확인 후 USER_SESSION_IN_CONSULTATION 처리
        session.expireNow();
        return true;
    }

    private UserSession findActiveSession(String userSessionId){
        UserSession session = userSessionRepository.findById(userSessionId)
                .orElseThrow(()-> new BusinessException(ErrorCode.USER_SESSION_NOT_FOUND));
        if(session.isExpired()){
            throw new BusinessException(ErrorCode.USER_SESSION_NOT_FOUND);
        }
        return session;
    }
}

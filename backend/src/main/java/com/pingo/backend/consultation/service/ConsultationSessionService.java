package com.pingo.backend.consultation.service;

import com.pingo.backend.consultation.domain.ConsultationSession;
import com.pingo.backend.consultation.domain.ConsultationStatus;
import com.pingo.backend.consultation.dto.request.ConsultationCreateRequest;
import com.pingo.backend.consultation.dto.response.ConsultationCancelResponse;
import com.pingo.backend.consultation.dto.response.ConsultationCreateResponse;
import com.pingo.backend.consultation.dto.response.ConsultationResponse;
import com.pingo.backend.consultation.repository.ConsultationSessionRepository;
import com.pingo.backend.global.exception.BusinessException;
import com.pingo.backend.global.exception.ErrorCode;
import com.pingo.backend.station.repository.StationRepository;
import com.pingo.backend.usersession.domain.UserSession;
import com.pingo.backend.usersession.repository.UserSessionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ConsultationSessionService {

    private final ConsultationSessionRepository consultationSessionRepository;
    private final UserSessionRepository userSessionRepository;
    private final StationRepository stationRepository;
    private static final List<ConsultationStatus> ACTIVE_STATUSES =
            List.of(ConsultationStatus.WAITING, ConsultationStatus.ACCEPTED, ConsultationStatus.IN_PROGRESS);

    @Transactional
    public ConsultationCreateResponse create(ConsultationCreateRequest request){
        validateDestination(request.destinationType(), request.destinationId());

        UserSession userSession = userSessionRepository.findById(request.userSessionId())
                .orElseThrow(()-> new BusinessException(ErrorCode.USER_SESSION_NOT_FOUND));

        if(userSession.isExpired()){
            throw new BusinessException(ErrorCode.USER_SESSION_ALREADY_ENDED);
        }

        if(consultationSessionRepository.existsByUserSessionIdAndStatusIn(
                request.userSessionId(), ACTIVE_STATUSES)){
            throw new BusinessException(ErrorCode.CONSULTATION_ALREADY_IN_PROGRESS);
        }

        stationRepository.findById(request.stationId())
                .orElseThrow(()->new BusinessException(ErrorCode.STATION_NOT_FOUND));

        ConsultationSession session = ConsultationSession.create(
                request.userSessionId(),
                request.stationId(),
                request.problemType(),
                request.currentNodeId(),
                request.destinationType(),
                request.destinationId(),
                request.videoConsent(),
                request.audioConsent()
        );
        consultationSessionRepository.save(session);
        return ConsultationCreateResponse.from(session);
    }

    @Transactional(readOnly = true)
    public ConsultationResponse get(String consultationSessionId, String userSessionId){
        ConsultationSession session = consultationSessionRepository.findById(consultationSessionId)
                .orElseThrow(() -> new BusinessException(ErrorCode.CONSULTATION_NOT_FOUND));
        validateOwner(session, userSessionId);
        return ConsultationResponse.from(session);
    }

    @Transactional
    public ConsultationCancelResponse cancel(String consultationSessionId, String userSessionId){
        ConsultationSession session = consultationSessionRepository.findById(consultationSessionId)
                .orElseThrow(()-> new BusinessException(ErrorCode.CONSULTATION_NOT_FOUND));
        validateOwner(session, userSessionId);
        if(session.getStatus() != ConsultationStatus.WAITING){
            throw new BusinessException(ErrorCode.CONSULTATION_NOT_CANCELABLE);
        }
        session.cancel();
        return ConsultationCancelResponse.from(session);
    }

    private void validateDestination(String destinationType, Long destinationId){
        boolean hasType = destinationType != null;
        boolean hasId = destinationId != null;
        if(hasType != hasId){
            throw new BusinessException(ErrorCode.INVALID_DESTINATION);
        }
    }

    private void validateOwner(ConsultationSession session, String userSessionId) {
        if (!session.getUserSessionId().equals(userSessionId)) {
            throw new BusinessException(ErrorCode.CONSULTATION_NOT_FOUND);
        }
    }
}

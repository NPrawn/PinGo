package com.pingo.backend.consultation.service;

import com.pingo.backend.auth.domain.Account;
import com.pingo.backend.auth.domain.AccountType;
import com.pingo.backend.auth.repository.AccountRepository;
import com.pingo.backend.consultation.domain.ConsultationSession;
import com.pingo.backend.consultation.domain.ConsultationStatus;
import com.pingo.backend.consultation.dto.request.ConsultationCreateRequest;
import com.pingo.backend.consultation.dto.response.*;
import com.pingo.backend.consultation.realtime.ConsultationWaitingEventPublisher;
import com.pingo.backend.consultation.repository.ConsultationSessionRepository;
import com.pingo.backend.global.exception.BusinessException;
import com.pingo.backend.global.exception.ErrorCode;
import com.pingo.backend.signaling.room.SignalingRoomRegistry;
import com.pingo.backend.station.repository.StationRepository;
import com.pingo.backend.usersession.domain.UserSession;
import com.pingo.backend.usersession.repository.UserSessionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.List;

@Service
@Slf4j
@RequiredArgsConstructor
public class ConsultationSessionService {

    private final ConsultationSessionRepository consultationSessionRepository;
    private final UserSessionRepository userSessionRepository;
    private final StationRepository stationRepository;
    private final AccountRepository accountRepository;
    private final ConsultationWaitingEventPublisher consultationWaitingEventPublisher;
    private final SignalingRoomRegistry signalingRoomRegistry;
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

    @Transactional
    public ConsultationAcceptResponse accept(String consultationSessionId, Long counselorAccountId){
        ConsultationSession existingSession = consultationSessionRepository.findById(consultationSessionId)
                .orElseThrow(() -> new BusinessException(ErrorCode.CONSULTATION_NOT_FOUND));

        Account counselor = findStationCounselor(counselorAccountId, existingSession.getStationId());

        ConsultationSession session = consultationSessionRepository.findByIdForUpdate(consultationSessionId)
                .orElseThrow(() -> new BusinessException(ErrorCode.CONSULTATION_NOT_FOUND));

        if(session.getStatus() != ConsultationStatus.WAITING){
            throw new BusinessException(ErrorCode.CONSULTATION_NOT_ACCEPTABLE);
        }

        session.accept(counselor.getAccountId());
        consultationWaitingEventPublisher.publishAccepted(session.getConsultationId(), session.getSignalingRoomId());
        return ConsultationAcceptResponse.from(session);
    }

    @Transactional
    public ConsultationRejectResponse reject(String consultationSessionId, Long counselorAccountId){
        ConsultationSession existingSession = consultationSessionRepository.findById(consultationSessionId)
                .orElseThrow(() -> new BusinessException(ErrorCode.CONSULTATION_NOT_FOUND));

        Account counselor = findStationCounselor(counselorAccountId, existingSession.getStationId());

        ConsultationSession session = consultationSessionRepository.findByIdForUpdate(consultationSessionId)
                .orElseThrow(() -> new BusinessException(ErrorCode.CONSULTATION_NOT_FOUND));

        if(session.getStatus() != ConsultationStatus.WAITING){
            throw new BusinessException(ErrorCode.CONSULTATION_NOT_REJECTABLE);
        }

        session.reject();
        log.info("상담 거절 처리 - consultationId={}, rejectedBy={}", session.getConsultationId(), counselor.getAccountId());
        consultationWaitingEventPublisher.publishRejected(session.getConsultationId());
        return ConsultationRejectResponse.from(session);
    }

    @Transactional
    public ConsultationEndResponse end(String consultationSessionId, Long counselorAccountId){
        ConsultationSession existingSession = consultationSessionRepository.findById(consultationSessionId)
                .orElseThrow(() -> new BusinessException(ErrorCode.CONSULTATION_NOT_FOUND));

        Account counselor = findStationCounselor(counselorAccountId, existingSession.getStationId());

        ConsultationSession session = consultationSessionRepository.findByIdForUpdate(consultationSessionId)
                .orElseThrow(() -> new BusinessException(ErrorCode.CONSULTATION_NOT_FOUND));

        if(session.getStatus() != ConsultationStatus.ACCEPTED
                && session.getStatus() != ConsultationStatus.IN_PROGRESS){
            throw new BusinessException(ErrorCode.CONSULTATION_NOT_ENDABLE);
        }

        if(!counselor.getAccountId().equals(session.getCounselorId())){
            throw new BusinessException(ErrorCode.CONSULTATION_COUNSELOR_MISMATCH);
        }

        String signalingRoomId = session.getSignalingRoomId();
        session.end();
        removeSignalingRoomAfterCommit(signalingRoomId);
        log.info("상담 종료 처리 - consultationId={}, endedBy={}", session.getConsultationId(), counselor.getAccountId());
        return ConsultationEndResponse.from(session);
    }

    private void removeSignalingRoomAfterCommit(String signalingRoomId) {
        if (signalingRoomId == null) {
            return;
        }

        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            signalingRoomRegistry.removeRoom(signalingRoomId);
            return;
        }

        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                signalingRoomRegistry.removeRoom(signalingRoomId);
            }
        });
    }

    private Account findStationCounselor(Long counselorAccountId, Long stationId){
        Account counselor = accountRepository.findById(counselorAccountId)
                .filter(account -> account.getAccountType() == AccountType.COUNSELOR)
                .orElseThrow(() -> new BusinessException(ErrorCode.ACCOUNT_NOT_FOUND));

        if(!counselor.isActive()){
            throw new BusinessException(ErrorCode.INACTIVE_ACCOUNT);
        }

        if(!stationId.equals(counselor.getStationId())){
            throw new BusinessException(ErrorCode.CONSULTATION_STATION_MISMATCH);
        }
        return counselor;
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

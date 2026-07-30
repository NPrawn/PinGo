package com.pingo.backend.consultation.service;

import com.pingo.backend.auth.domain.Account;
import com.pingo.backend.auth.domain.AccountType;
import com.pingo.backend.auth.repository.AccountRepository;
import com.pingo.backend.consultation.domain.ConsultationSession;
import com.pingo.backend.consultation.domain.ConsultationStatus;
import com.pingo.backend.consultation.dto.request.ConsultationCreateRequest;
import com.pingo.backend.consultation.dto.response.ConsultationCancelResponse;
import com.pingo.backend.consultation.dto.response.ConsultationCreateResponse;
import com.pingo.backend.consultation.dto.response.ConsultationResponse;
import com.pingo.backend.consultation.dto.response.CounselorConsultationResponse;
import com.pingo.backend.consultation.realtime.ConsultationWaitingEventPublisher;
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
import java.util.Arrays;

@Service
@RequiredArgsConstructor
public class ConsultationSessionService {

    private final ConsultationSessionRepository consultationSessionRepository;
    private final UserSessionRepository userSessionRepository;
    private final StationRepository stationRepository;
    private final AccountRepository accountRepository;
    private final ConsultationWaitingEventPublisher waitingEventPublisher;
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
        waitingEventPublisher.publishWaiting(session.getConsultationId());
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
        waitingEventPublisher.publishCanceled(session.getConsultationId());
        return ConsultationCancelResponse.from(session);
    }

    @Transactional(readOnly = true)
    public List<CounselorConsultationResponse> listForCounselor(
            Long counselorId,
            ConsultationStatus status
    ) {
        Account counselor = findCounselor(counselorId);
        List<ConsultationStatus> statuses = status == null
                ? Arrays.asList(ConsultationStatus.values())
                : List.of(status);
        return consultationSessionRepository
                .findAllByStationIdAndStatusInOrderByRequestedAtAsc(counselor.getStationId(), statuses)
                .stream()
                .map(CounselorConsultationResponse::from)
                .toList();
    }

    @Transactional
    public ConsultationResponse accept(String consultationId, Long counselorId) {
        Account counselor = findCounselor(counselorId);
        ConsultationSession session = findWaitingForUpdate(consultationId);
        validateCounselorStation(counselor, session);
        session.accept(counselorId);
        ConsultationResponse response = ConsultationResponse.from(session);
        waitingEventPublisher.publishAccepted(consultationId, response.signalingRoomId());
        return response;
    }

    @Transactional
    public ConsultationResponse reject(String consultationId, Long counselorId) {
        Account counselor = findCounselor(counselorId);
        ConsultationSession session = findWaitingForUpdate(consultationId);
        validateCounselorStation(counselor, session);
        session.reject();
        waitingEventPublisher.publishRejected(consultationId);
        return ConsultationResponse.from(session);
    }

    @Transactional
    public ConsultationResponse end(String consultationId, Long counselorId) {
        Account counselor = findCounselor(counselorId);
        ConsultationSession session = consultationSessionRepository.findByIdForUpdate(consultationId)
                .orElseThrow(() -> new BusinessException(ErrorCode.CONSULTATION_NOT_FOUND));
        validateCounselorStation(counselor, session);
        if (session.getCounselorId() == null
                || !session.getCounselorId().equals(counselorId)
                || (session.getStatus() != ConsultationStatus.ACCEPTED
                && session.getStatus() != ConsultationStatus.IN_PROGRESS)) {
            throw new BusinessException(ErrorCode.CONSULTATION_NOT_ACTIVE);
        }
        session.end();
        return ConsultationResponse.from(session);
    }

    private Account findCounselor(Long counselorId) {
        Account account = accountRepository.findById(counselorId)
                .orElseThrow(() -> new BusinessException(ErrorCode.ACCOUNT_NOT_FOUND));
        if (account.getAccountType() != AccountType.COUNSELOR || !account.isActive()) {
            throw new BusinessException(ErrorCode.ACCESS_DENIED);
        }
        return account;
    }

    private ConsultationSession findWaitingForUpdate(String consultationId) {
        ConsultationSession session = consultationSessionRepository.findByIdForUpdate(consultationId)
                .orElseThrow(() -> new BusinessException(ErrorCode.CONSULTATION_NOT_FOUND));
        if (session.getStatus() != ConsultationStatus.WAITING) {
            throw new BusinessException(ErrorCode.CONSULTATION_NOT_WAITING);
        }
        return session;
    }

    private void validateCounselorStation(Account counselor, ConsultationSession session) {
        if (counselor.getStationId() == null || !counselor.getStationId().equals(session.getStationId())) {
            throw new BusinessException(ErrorCode.ACCESS_DENIED);
        }
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

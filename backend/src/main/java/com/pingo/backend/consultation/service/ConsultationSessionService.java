package com.pingo.backend.consultation.service;

import com.pingo.backend.auth.domain.Account;
import com.pingo.backend.auth.domain.AccountType;
import com.pingo.backend.auth.domain.CounselorStatus;
import com.pingo.backend.auth.repository.AccountRepository;
import com.pingo.backend.consultation.domain.ConsultationScope;
import com.pingo.backend.consultation.domain.ConsultationSession;
import com.pingo.backend.consultation.domain.ConsultationStatus;
import com.pingo.backend.consultation.domain.ConsultationSummary;
import com.pingo.backend.consultation.dto.request.ConsultationCreateRequest;
import com.pingo.backend.consultation.dto.request.ConsultationEndRequest;
import com.pingo.backend.consultation.dto.response.*;
import com.pingo.backend.consultation.event.ConsultationAcceptedEvent;
import com.pingo.backend.consultation.event.ConsultationCanceledEvent;
import com.pingo.backend.consultation.event.ConsultationEndedEvent;
import com.pingo.backend.consultation.realtime.ConsultationWaitingEventPublisher;
import com.pingo.backend.consultation.repository.ConsultationSessionRepository;
import com.pingo.backend.consultation.repository.ConsultationSummaryRepository;
import com.pingo.backend.global.exception.BusinessException;
import com.pingo.backend.global.exception.ErrorCode;
import com.pingo.backend.global.response.PageResponse;
import com.pingo.backend.signaling.auth.SignalingAccessTokenProvider;
import com.pingo.backend.station.repository.StationRepository;
import com.pingo.backend.usersession.domain.UserSession;
import com.pingo.backend.usersession.repository.UserSessionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@Slf4j
@RequiredArgsConstructor
public class ConsultationSessionService {

    private final ConsultationSessionRepository consultationSessionRepository;
    private final ConsultationSummaryRepository consultationSummaryRepository;
    private final UserSessionRepository userSessionRepository;
    private final StationRepository stationRepository;
    private final AccountRepository accountRepository;
    private final ConsultationWaitingEventPublisher consultationWaitingEventPublisher;
    private final ApplicationEventPublisher applicationEventPublisher;
    private final SignalingAccessTokenProvider signalingAccessTokenProvider;
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
            ConsultationSession activeSession = consultationSessionRepository
                    .findFirstByUserSessionIdAndStatusInOrderByRequestedAtDesc(
                            request.userSessionId(), ACTIVE_STATUSES)
                    .orElseThrow(() -> new BusinessException(ErrorCode.CONSULTATION_ALREADY_IN_PROGRESS));
            return ConsultationCreateResponse.from(activeSession);
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
                request.audioConsent(),
                request.locationConsent()
        );
        consultationSessionRepository.save(session);
        consultationWaitingEventPublisher.publishWaiting(session.getConsultationId());
        return ConsultationCreateResponse.from(session);
    }

    @Transactional(readOnly = true)
    public ConsultationResponse get(String consultationSessionId, String userSessionId){
        ConsultationSession session = consultationSessionRepository.findById(consultationSessionId)
                .orElseThrow(() -> new BusinessException(ErrorCode.CONSULTATION_NOT_FOUND));
        validateOwner(session, userSessionId);
        return ConsultationResponse.from(session, createUserSignalingAccessToken(session));
    }

    @Transactional
    public ConsultationCancelResponse cancel(String consultationSessionId, String userSessionId){
        ConsultationSession session = findSessionForUpdate(consultationSessionId);
        validateOwner(session, userSessionId);
        if(session.getStatus() != ConsultationStatus.WAITING
                && session.getStatus() != ConsultationStatus.ACCEPTED){
            throw new BusinessException(ErrorCode.CONSULTATION_NOT_CANCELABLE);
        }

        String signalingRoomId = session.getSignalingRoomId();
        if (session.getStatus() == ConsultationStatus.ACCEPTED && session.getCounselorId() != null) {
            accountRepository.findByIdForUpdate(session.getCounselorId())
                    .ifPresent(counselor -> counselor.changeStatus(CounselorStatus.AVAILABLE));
        }
        session.cancel();
        consultationWaitingEventPublisher.publishCanceled(session.getConsultationId());
        if (signalingRoomId != null) {
            applicationEventPublisher.publishEvent(
                    new ConsultationCanceledEvent(session.getConsultationId(), signalingRoomId));
        }
        return ConsultationCancelResponse.from(session);
    }

    @Transactional
    public ConsultationAcceptResponse accept(String consultationSessionId, Long counselorAccountId){
        ConsultationSession session = findSessionForUpdate(consultationSessionId);

        if(session.getStatus() != ConsultationStatus.WAITING){
            throw new BusinessException(ErrorCode.CONSULTATION_NOT_ACCEPTABLE);
        }

        Account counselor = findStationCounselorForUpdate(counselorAccountId, session.getStationId());
        if(counselor.getStatus() != CounselorStatus.AVAILABLE){
            throw new BusinessException(ErrorCode.COUNSELOR_NOT_AVAILABLE);
        }

        session.accept(counselor.getAccountId());
        counselor.changeStatus(CounselorStatus.BUSY);
        /*
         * 커밋된 뒤에 알린다.
         *
         * SSE 를 여기서 바로 보내면, 그 알림을 받은 사용자가 곧바로 상담 조회를 호출했을 때
         * 아직 커밋되지 않은 이 트랜잭션의 변경을 볼 수 없다. 상담은 WAITING 인 채로 읽히고,
         * signaling room 은 ACCEPTED 상태에서만 만들어지므로 토큰이 null 로 나간다.
         * 사용자 화면이 "상담 연결 정보를 받지 못했습니다" 로 멈추고, 새로고침해야만 넘어간다.
         */
        applicationEventPublisher.publishEvent(
                new ConsultationAcceptedEvent(session.getConsultationId(), session.getSignalingRoomId()));
        return ConsultationAcceptResponse.from(session, createCounselorSignalingAccessToken(session));
    }

    @Transactional
    public ConsultationRejectResponse reject(String consultationSessionId, Long counselorAccountId){
        ConsultationSession session = findSessionForUpdate(consultationSessionId);

        if(session.getStatus() != ConsultationStatus.WAITING){
            throw new BusinessException(ErrorCode.CONSULTATION_NOT_REJECTABLE);
        }

        Account counselor = findStationCounselor(counselorAccountId, session.getStationId());

        session.reject();
        log.info("상담 거절 처리 - consultationId={}, rejectedBy={}", session.getConsultationId(), counselor.getAccountId());
        consultationWaitingEventPublisher.publishRejected(session.getConsultationId());
        return ConsultationRejectResponse.from(session);
    }

    @Transactional(readOnly = true)
    public PageResponse<ConsultationListResponse> getConsultationsForCounselor(
            Long counselorAccountId,
            List<ConsultationStatus> statuses,
            ConsultationScope scope,
            Pageable pageable
    ) {
        Account counselor = findActiveCounselor(counselorAccountId);
        List<ConsultationStatus> requestedStatuses = statuses == null ? List.of() : statuses;
        ConsultationScope requestedScope = scope == null ? ConsultationScope.ALL : scope;
        Page<ConsultationSession> consultations = findConsultations(
                counselor,
                requestedStatuses,
                requestedScope,
                pageable
        );

        Map<Long, String> counselorNames = findCounselorNames(consultations.getContent());
        Map<String, ConsultationSummary> summaries = findSummaries(consultations.getContent());

        return PageResponse.from(
                consultations,
                session -> ConsultationListResponse.from(
                        session,
                        session.getCounselorId() == null
                                ? null
                                : counselorNames.get(session.getCounselorId()),
                        summaries.get(session.getConsultationId())
                )
        );
    }

    private Page<ConsultationSession> findConsultations(
            Account counselor,
            List<ConsultationStatus> statuses,
            ConsultationScope scope,
            Pageable pageable
    ) {
        boolean hasStatusFilter = !statuses.isEmpty();
        if (scope == ConsultationScope.MINE) {
            return hasStatusFilter
                    ? consultationSessionRepository.findByStationIdAndCounselorIdAndStatusIn(
                            counselor.getStationId(),
                            counselor.getAccountId(),
                            statuses,
                            pageable
                    )
                    : consultationSessionRepository.findByStationIdAndCounselorId(
                            counselor.getStationId(),
                            counselor.getAccountId(),
                            pageable
                    );
        }

        return hasStatusFilter
                ? consultationSessionRepository.findByStationIdAndStatusIn(
                        counselor.getStationId(),
                        statuses,
                        pageable
                )
                : consultationSessionRepository.findByStationId(counselor.getStationId(), pageable);
    }

    private Map<Long, String> findCounselorNames(List<ConsultationSession> consultations) {
        Set<Long> counselorIds = consultations.stream()
                .map(ConsultationSession::getCounselorId)
                .filter(id -> id != null)
                .collect(Collectors.toSet());
        if (counselorIds.isEmpty()) {
            return Map.of();
        }

        return accountRepository.findAllById(counselorIds).stream()
                .collect(Collectors.toMap(Account::getAccountId, Account::getName));
    }

    private Map<String, ConsultationSummary> findSummaries(List<ConsultationSession> consultations) {
        if (consultations.isEmpty()) {
            return Map.of();
        }

        List<String> consultationIds = consultations.stream()
                .map(ConsultationSession::getConsultationId)
                .toList();

        return consultationSummaryRepository.findAllByConsultationIdIn(consultationIds).stream()
                .collect(Collectors.toMap(ConsultationSummary::getConsultationId, Function.identity()));
    }

    @Transactional(readOnly = true)
    public ConsultationDetailResponse getConsultationDetailForCounselor(String consultationSessionId, Long counselorAccountId){
        ConsultationSession session = consultationSessionRepository.findById(consultationSessionId)
                .orElseThrow(() -> new BusinessException(ErrorCode.CONSULTATION_NOT_FOUND));
        findStationCounselor(counselorAccountId, session.getStationId());

        boolean isAssignedCounselor = counselorAccountId.equals(session.getCounselorId());
        String token = isAssignedCounselor ? createCounselorSignalingAccessToken(session) : null;
        return ConsultationDetailResponse.from(session, token);
    }

    @Transactional
    public ConsultationEndResponse end(String consultationSessionId, ConsultationEndRequest request, Long accountId){
        if ("user".equals(request.endedBy()) && (request.userSessionId() == null || request.userSessionId().isBlank())) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST);
        }

        ConsultationSession session = findSessionForUpdate(consultationSessionId);

        if (session.getStatus() != ConsultationStatus.ACCEPTED && session.getStatus() != ConsultationStatus.IN_PROGRESS) {
            throw new BusinessException(ErrorCode.CONSULTATION_NOT_ENDABLE);
        }

        if ("counselor".equals(request.endedBy())) {
            Account counselor = findStationCounselorForUpdate(accountId, session.getStationId());
            if (!counselor.getAccountId().equals(session.getCounselorId())) {
                throw new BusinessException(ErrorCode.CONSULTATION_COUNSELOR_MISMATCH);
            }
            counselor.changeStatus(CounselorStatus.AVAILABLE);
        } else {
            validateOwner(session, request.userSessionId());
            accountRepository.findByIdForUpdate(session.getCounselorId())
                    .ifPresent(counselor -> counselor.changeStatus(CounselorStatus.AVAILABLE));
        }

        String signalingRoomId = session.getSignalingRoomId();
        session.end();
        applicationEventPublisher.publishEvent(new ConsultationEndedEvent(session.getConsultationId(), signalingRoomId));
        log.info("상담 종료 처리 - consultationId={}, endedBy={}", session.getConsultationId(), request.endedBy());
        return ConsultationEndResponse.from(session);
    }

    private Account findActiveCounselor(Long counselorAccountId){
        if (counselorAccountId == null) {
            throw new BusinessException(ErrorCode.UNAUTHENTICATED);
        }

        Account counselor = accountRepository.findById(counselorAccountId)
                .filter(account -> account.getAccountType() == AccountType.COUNSELOR)
                .orElseThrow(() -> new BusinessException(ErrorCode.ACCOUNT_NOT_FOUND));

        if(!counselor.isActive()){
            throw new BusinessException(ErrorCode.INACTIVE_ACCOUNT);
        }
        return counselor;
    }

    /**
     * 상담 상태를 변경하는 흐름의 잠금 순서를 상담 세션 -> 상담원 계정으로 고정한다.
     * 상담원 상태를 함께 변경하는 흐름도 반드시 세션을 먼저 잠가 데드락을 방지한다.
     */
    private ConsultationSession findSessionForUpdate(String consultationSessionId) {
        return consultationSessionRepository.findByIdForUpdate(consultationSessionId)
                .orElseThrow(() -> new BusinessException(ErrorCode.CONSULTATION_NOT_FOUND));
    }

    private Account findStationCounselor(Long counselorAccountId, Long stationId){
        Account counselor = findActiveCounselor(counselorAccountId);
        if(!stationId.equals(counselor.getStationId())){
            throw new BusinessException(ErrorCode.CONSULTATION_STATION_MISMATCH);
        }
        return counselor;
    }

    private Account findStationCounselorForUpdate(Long counselorAccountId, Long stationId){
        Account counselor = accountRepository.findByIdForUpdate(counselorAccountId)
                .filter(account -> account.getAccountType() == AccountType.COUNSELOR)
                .orElseThrow(() -> new BusinessException(ErrorCode.ACCOUNT_NOT_FOUND));

        validateStationCounselor(counselor, stationId);
        return counselor;
    }

    private void validateStationCounselor(Account counselor, Long stationId){
        if(!counselor.isActive()){
            throw new BusinessException(ErrorCode.INACTIVE_ACCOUNT);
        }
        if(!stationId.equals(counselor.getStationId())){
            throw new BusinessException(ErrorCode.CONSULTATION_STATION_MISMATCH);
        }
    }

    private String createUserSignalingAccessToken(ConsultationSession session) {
        if (session.getSignalingRoomId() == null) {
            return null;
        }

        return signalingAccessTokenProvider.createUserToken(
                session.getConsultationId(),
                session.getUserSessionId()
        );
    }

    private String createCounselorSignalingAccessToken(ConsultationSession session) {
        if (session.getSignalingRoomId() == null || session.getCounselorId() == null) {
            return null;
        }

        return signalingAccessTokenProvider.createCounselorToken(
                session.getConsultationId(),
                session.getCounselorId()
        );
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

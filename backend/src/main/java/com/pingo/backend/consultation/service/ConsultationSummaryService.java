package com.pingo.backend.consultation.service;

import com.pingo.backend.auth.domain.Account;
import com.pingo.backend.auth.domain.AccountType;
import com.pingo.backend.auth.repository.AccountRepository;
import com.pingo.backend.consultation.domain.*;
import com.pingo.backend.consultation.dto.request.ConsultationTranscriptRequest;
import com.pingo.backend.consultation.dto.request.TranscriptSegmentRequest;
import com.pingo.backend.consultation.dto.response.ConsultationSummaryResponse;
import com.pingo.backend.consultation.dto.response.ConsultationSummaryStatusResponse;
import com.pingo.backend.consultation.dto.response.TranscriptSegmentResponse;
import com.pingo.backend.consultation.event.TranscriptSavedEvent;
import com.pingo.backend.consultation.repository.*;
import com.pingo.backend.global.exception.BusinessException;
import com.pingo.backend.global.exception.ErrorCode;
import com.pingo.backend.route.domain.RouteType;
import com.pingo.backend.usersession.domain.Language;
import com.pingo.backend.usersession.domain.UserSession;
import com.pingo.backend.usersession.repository.UserSessionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.*;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ConsultationSummaryService {

    private static final int MAX_TRANSCRIPT_SIZE = 500;

    private final ConsultationSessionRepository consultationSessionRepository;
    private final ConsultationSummaryRepository consultationSummaryRepository;
    private final ConsultationTranscriptRepository consultationTranscriptRepository;
    private final AccountRepository accountRepository;
    private final UserSessionRepository userSessionRepository;
    private final ApplicationEventPublisher eventPublisher;

    @Transactional
    public ConsultationSummaryStatusResponse submitTranscript(String consultationId, Long accountId,
                                                              ConsultationTranscriptRequest request) {

        ConsultationSession session = consultationSessionRepository.findByIdForUpdate(consultationId)
                .orElseThrow(() -> new BusinessException(ErrorCode.CONSULTATION_NOT_FOUND));

        validateStationCounselor(accountId, session.getStationId());

        if (!Objects.equals(session.getCounselorId(), accountId)) {
            throw new BusinessException(ErrorCode.CONSULTATION_COUNSELOR_MISMATCH);
        }
        if (session.getStatus() != ConsultationStatus.ENDED) {
            throw new BusinessException(ErrorCode.CONSULTATION_NOT_ENDED);
        }

        Optional<ConsultationSummary> existing =
                consultationSummaryRepository.findByConsultationId(consultationId);

        if (existing.isPresent()) {
            ConsultationSummary summary = existing.get();
            if (!summary.isRetryable()) {
                throw new BusinessException(ErrorCode.CONSULTATION_SUMMARY_ALREADY_EXISTS);
            }
            summary.retry();
            eventPublisher.publishEvent(new TranscriptSavedEvent(consultationId));
            return new ConsultationSummaryStatusResponse(consultationId, summary.getStatus());
        }

        validateTranscript(request.transcript());

        ConsultationSummary summary = consultationSummaryRepository.save(
                ConsultationSummary.pending(
                        consultationId,
                        request.startLocationLabel(),
                        request.guidedExitFacilityId(),
                        request.guidedExitLabel(),
                        toRouteTypeCode(request.routeType())
                ));

        consultationTranscriptRepository.saveAll(
                request.transcript().stream()
                        .sorted(Comparator.comparingInt(TranscriptSegmentRequest::seq))
                        .map(s -> ConsultationTranscript.of(
                                consultationId, s.seq(), s.speaker(), s.content(), s.translatedContent()))
                        .toList());

        eventPublisher.publishEvent(new TranscriptSavedEvent(consultationId));

        return new ConsultationSummaryStatusResponse(consultationId, summary.getStatus());
    }

    public ConsultationSummaryResponse find(String consultationId, Long accountId) {

        ConsultationSession session = consultationSessionRepository.findById(consultationId)
                .orElseThrow(() -> new BusinessException(ErrorCode.CONSULTATION_NOT_FOUND));

        validateStationCounselor(accountId, session.getStationId());

        ConsultationSummary summary = consultationSummaryRepository.findByConsultationId(consultationId)
                .orElseThrow(() -> new BusinessException(ErrorCode.CONSULTATION_SUMMARY_NOT_FOUND));

        List<ConsultationTranscript> transcripts =
                consultationTranscriptRepository.findByConsultationIdOrderBySeqAsc(consultationId);

        return ConsultationSummaryResponse.of(
                summary,
                findCounselorName(session.getCounselorId()),
                ConsultationSession.toInstant(session.getEndedAt()),
                findLanguage(session.getUserSessionId()),
                transcripts.stream().map(TranscriptSegmentResponse::from).toList());
    }

    private void validateTranscript(List<TranscriptSegmentRequest> segments) {
        if (segments == null || segments.isEmpty()) {
            throw new BusinessException(ErrorCode.EMPTY_TRANSCRIPT);
        }
        if (segments.size() > MAX_TRANSCRIPT_SIZE) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST);
        }
        Set<Integer> seen = new HashSet<>();
        for (TranscriptSegmentRequest segment : segments) {
            if (!seen.add(segment.seq())) {
                throw new BusinessException(ErrorCode.INVALID_REQUEST);
            }
        }
    }

    private String toRouteTypeCode(String rawRouteType) {
        if (!StringUtils.hasText(rawRouteType)) {
            return null;
        }
        return RouteType.fromCode(rawRouteType)
                .map(RouteType::getCode)
                .orElseThrow(() -> new BusinessException(ErrorCode.UNSUPPORTED_ROUTE_TYPE));
    }

    private String findCounselorName(Long counselorId) {
        if (counselorId == null) {
            return null;
        }
        return accountRepository.findById(counselorId).map(Account::getName).orElse(null);
    }

    private Language findLanguage(String userSessionId) {
        return userSessionRepository.findById(userSessionId)
                .map(UserSession::getLanguage)
                .orElse(null);
    }

    private void validateStationCounselor(Long accountId, Long stationId) {
        Account account = accountRepository.findById(accountId)
                .orElseThrow(() -> new BusinessException(ErrorCode.ACCOUNT_NOT_FOUND));

        if (!account.isActive()) {
            throw new BusinessException(ErrorCode.INACTIVE_ACCOUNT);
        }
        if (account.getAccountType() != AccountType.COUNSELOR
                || !Objects.equals(account.getStationId(), stationId)) {
            throw new BusinessException(ErrorCode.CONSULTATION_STATION_MISMATCH);
        }
    }
}

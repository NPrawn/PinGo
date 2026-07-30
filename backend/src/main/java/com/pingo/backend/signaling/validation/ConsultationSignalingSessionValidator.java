package com.pingo.backend.signaling.validation;

import com.pingo.backend.consultation.domain.ConsultationSession;
import com.pingo.backend.consultation.domain.ConsultationStatus;
import com.pingo.backend.consultation.repository.ConsultationSessionRepository;
import com.pingo.backend.signaling.auth.SignalingPrincipal;
import com.pingo.backend.signaling.dto.SignalingSenderType;
import lombok.RequiredArgsConstructor;
import org.springframework.transaction.annotation.Transactional;

import java.util.Set;

@RequiredArgsConstructor
public class ConsultationSignalingSessionValidator implements SignalingSessionValidator {

    private static final Set<ConsultationStatus> JOINABLE_STATUSES =
            Set.of(ConsultationStatus.ACCEPTED, ConsultationStatus.IN_PROGRESS);
    private static final Set<ConsultationStatus> CLOSED_STATUSES =
            Set.of(
                    ConsultationStatus.ENDED,
                    ConsultationStatus.CANCELED,
                    ConsultationStatus.REJECTED,
                    ConsultationStatus.FAILED
            );

    private final ConsultationSessionRepository consultationSessionRepository;
    private final SignalingSessionIdParser signalingSessionIdParser;

    @Override
    @Transactional(readOnly = true)
    public SignalingSessionValidationResult validateJoin(
            String signalingSessionId,
            SignalingSenderType senderType,
            SignalingPrincipal signalingPrincipal
    ) {
        if (senderType == null || senderType == SignalingSenderType.SYSTEM) {
            return SignalingSessionValidationResult.UNAUTHORIZED_PARTICIPANT;
        }

        String consultationId = signalingSessionIdParser.parseConsultationId(signalingSessionId)
                .orElse(null);
        if (consultationId == null) {
            return SignalingSessionValidationResult.SESSION_NOT_FOUND;
        }

        ConsultationSession session = consultationSessionRepository.findById(consultationId)
                .orElse(null);
        if (session == null) {
            return SignalingSessionValidationResult.SESSION_NOT_FOUND;
        }

        if (!isAuthorizedParticipant(session, consultationId, senderType, signalingPrincipal)) {
            return SignalingSessionValidationResult.UNAUTHORIZED_PARTICIPANT;
        }

        if (JOINABLE_STATUSES.contains(session.getStatus())) {
            return SignalingSessionValidationResult.VALID;
        }

        if (CLOSED_STATUSES.contains(session.getStatus())) {
            return SignalingSessionValidationResult.SESSION_CLOSED;
        }

        return SignalingSessionValidationResult.SESSION_NOT_ACCEPTED;
    }

    private boolean isAuthorizedParticipant(
            ConsultationSession session,
            String consultationId,
            SignalingSenderType senderType,
            SignalingPrincipal signalingPrincipal
    ) {
        if (signalingPrincipal == null
                || !consultationId.equals(signalingPrincipal.consultationId())
                || senderType != signalingPrincipal.senderType()) {
            return false;
        }

        return switch (senderType) {
            case USER -> session.getUserSessionId().equals(signalingPrincipal.userSessionId());
            case COUNSELOR -> session.getCounselorId() != null
                    && session.getCounselorId().equals(signalingPrincipal.accountId());
            case SYSTEM -> false;
        };
    }
}

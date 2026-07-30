package com.pingo.backend.webrtc.service;

import com.pingo.backend.consultation.domain.ConsultationSession;
import com.pingo.backend.consultation.domain.ConsultationStatus;
import com.pingo.backend.consultation.repository.ConsultationSessionRepository;
import com.pingo.backend.global.exception.BusinessException;
import com.pingo.backend.global.exception.ErrorCode;
import com.pingo.backend.signaling.auth.SignalingAccessTokenProvider;
import com.pingo.backend.signaling.auth.SignalingPrincipal;
import com.pingo.backend.signaling.dto.SignalingSenderType;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.Set;

@Component
@RequiredArgsConstructor
public class IceServerAccessValidator {

    private static final Set<ConsultationStatus> ICE_SERVER_ACCESSIBLE_STATUSES =
            Set.of(ConsultationStatus.ACCEPTED, ConsultationStatus.IN_PROGRESS);

    private final SignalingAccessTokenProvider signalingAccessTokenProvider;
    private final ConsultationSessionRepository consultationSessionRepository;

    @Transactional(readOnly = true)
    public void validate(String token) {
        if (!StringUtils.hasText(token)) {
            throw new BusinessException(ErrorCode.UNAUTHENTICATED);
        }

        SignalingPrincipal principal = parsePrincipal(token);
        ConsultationSession session = consultationSessionRepository.findById(principal.consultationId())
                .orElseThrow(() -> new BusinessException(ErrorCode.UNAUTHENTICATED));

        if (!ICE_SERVER_ACCESSIBLE_STATUSES.contains(session.getStatus())) {
            throw new BusinessException(ErrorCode.UNAUTHENTICATED);
        }

        if (!isAuthorizedParticipant(session, principal)) {
            throw new BusinessException(ErrorCode.UNAUTHENTICATED);
        }
    }

    private SignalingPrincipal parsePrincipal(String token) {
        try {
            return signalingAccessTokenProvider.parseToken(token);
        } catch (RuntimeException exception) {
            throw new BusinessException(ErrorCode.UNAUTHENTICATED);
        }
    }

    private boolean isAuthorizedParticipant(ConsultationSession session, SignalingPrincipal principal) {
        if (principal.senderType() == null || principal.senderType() == SignalingSenderType.SYSTEM) {
            return false;
        }

        return switch (principal.senderType()) {
            case USER -> session.getUserSessionId().equals(principal.userSessionId());
            case COUNSELOR -> session.getCounselorId() != null
                    && session.getCounselorId().equals(principal.accountId());
            case SYSTEM -> false;
        };
    }
}

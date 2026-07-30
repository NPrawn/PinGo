package com.pingo.backend.signaling.validation;

import com.pingo.backend.consultation.domain.ConsultationStatus;
import com.pingo.backend.consultation.repository.ConsultationSessionRepository;
import com.pingo.backend.signaling.dto.SignalingSenderType;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class ConsultationSignalingSessionValidator implements SignalingSessionValidator {

    private static final String ROOM_PREFIX = "room_";
    private final ConsultationSessionRepository consultationSessionRepository;

    @Override
    public SignalingSessionValidationResult validateJoin(
            String signalingSessionId,
            SignalingSenderType senderType
    ) {
        if (senderType == null || senderType == SignalingSenderType.SYSTEM) {
            return SignalingSessionValidationResult.UNAUTHORIZED_PARTICIPANT;
        }
        if (signalingSessionId == null || !signalingSessionId.startsWith(ROOM_PREFIX)) {
            return SignalingSessionValidationResult.SESSION_NOT_FOUND;
        }
        String consultationId = signalingSessionId.substring(ROOM_PREFIX.length());
        return consultationSessionRepository.findById(consultationId)
                .map(session -> {
                    if (session.getStatus() == ConsultationStatus.ACCEPTED
                            || session.getStatus() == ConsultationStatus.IN_PROGRESS) {
                        return SignalingSessionValidationResult.VALID;
                    }
                    if (session.getStatus() == ConsultationStatus.WAITING) {
                        return SignalingSessionValidationResult.SESSION_NOT_ACCEPTED;
                    }
                    return SignalingSessionValidationResult.SESSION_CLOSED;
                })
                .orElse(SignalingSessionValidationResult.SESSION_NOT_FOUND);
    }
}

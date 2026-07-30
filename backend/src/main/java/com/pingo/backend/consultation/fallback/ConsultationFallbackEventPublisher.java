package com.pingo.backend.consultation.fallback;

import java.time.Clock;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ConsultationFallbackEventPublisher {

    private final ApplicationEventPublisher applicationEventPublisher;
    private final Clock clock;

    public void publishVideoFailed(String consultationRequestId, String reason) {
        publish(consultationRequestId, ConsultationFallbackEventType.VIDEO_FAILED, reason);
    }

    public void publishAudioOnlyRequested(String consultationRequestId, String reason) {
        publish(consultationRequestId, ConsultationFallbackEventType.AUDIO_ONLY_REQUESTED, reason);
    }

    public void publishAudioFailed(String consultationRequestId, String reason) {
        publish(consultationRequestId, ConsultationFallbackEventType.AUDIO_FAILED, reason);
    }

    public void publishChatOnlyRequested(String consultationRequestId, String reason) {
        publish(consultationRequestId, ConsultationFallbackEventType.CHAT_ONLY_REQUESTED, reason);
    }

    public void publishFallbackConfirmed(String consultationRequestId, String reason) {
        publish(consultationRequestId, ConsultationFallbackEventType.FALLBACK_CONFIRMED, reason);
    }

    private void publish(String consultationRequestId, ConsultationFallbackEventType type, String reason) {
        applicationEventPublisher.publishEvent(new ConsultationFallbackEventResponse(
                consultationRequestId,
                type,
                reason,
                Instant.now(clock)
        ));
    }
}

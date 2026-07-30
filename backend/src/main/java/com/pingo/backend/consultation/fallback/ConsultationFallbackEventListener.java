package com.pingo.backend.consultation.fallback;

import com.pingo.backend.consultation.realtime.ConsultationWaitingEmitterRegistry;
import com.pingo.backend.consultation.realtime.ConsultationWaitingEventResponse;
import com.pingo.backend.consultation.realtime.ConsultationWaitingEventType;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class ConsultationFallbackEventListener {

    private final ConsultationWaitingEmitterRegistry emitterRegistry;

    @EventListener
    public void handleFallbackEvent(ConsultationFallbackEventResponse event) {
        emitterRegistry.publish(new ConsultationWaitingEventResponse(
                event.consultationRequestId(),
                toWaitingEventType(event.type()),
                null,
                messageOf(event),
                event.timestamp()
        ));
    }

    private ConsultationWaitingEventType toWaitingEventType(ConsultationFallbackEventType type) {
        return switch (type) {
            case VIDEO_FAILED -> ConsultationWaitingEventType.WAITING;
            case AUDIO_ONLY_REQUESTED -> ConsultationWaitingEventType.WAITING;
            case AUDIO_FAILED -> ConsultationWaitingEventType.WAITING;
            case CHAT_ONLY_REQUESTED -> ConsultationWaitingEventType.WAITING;
            case FALLBACK_CONFIRMED -> ConsultationWaitingEventType.WAITING;
        };
    }

    private String messageOf(ConsultationFallbackEventResponse event) {
        return switch (event.type()) {
            case VIDEO_FAILED -> "영상 연결에 실패했습니다. 음성 상담으로 전환을 시도합니다.";
            case AUDIO_ONLY_REQUESTED -> "음성 상담으로 전환을 요청했습니다.";
            case AUDIO_FAILED -> "음성 연결에 실패했습니다. 채팅 상담으로 전환을 시도합니다.";
            case CHAT_ONLY_REQUESTED -> "채팅 상담으로 전환을 요청했습니다.";
            case FALLBACK_CONFIRMED -> "상담 방식 전환이 확정되었습니다.";
        };
    }
}

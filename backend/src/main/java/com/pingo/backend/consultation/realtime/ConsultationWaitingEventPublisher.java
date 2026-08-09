package com.pingo.backend.consultation.realtime;

import java.time.Clock;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ConsultationWaitingEventPublisher {

    private final ConsultationWaitingEmitterRegistry emitterRegistry;
    private final Clock clock;

    public void publishWaiting(String consultationRequestId) {
        publish(
                consultationRequestId,
                ConsultationWaitingEventType.WAITING,
                null,
                "상담자를 기다리는 중입니다."
        );
    }

    public void publishAccepted(String consultationRequestId, String signalingRoomId) {
        publish(
                consultationRequestId,
                ConsultationWaitingEventType.ACCEPTED,
                signalingRoomId,
                "상담자가 요청을 수락했습니다."
        );
    }

    public void publishRejected(String consultationRequestId) {
        publish(
                consultationRequestId,
                ConsultationWaitingEventType.REJECTED,
                null,
                "상담 요청이 거절되었습니다."
        );
    }

    public void publishCanceled(String consultationRequestId) {
        publish(
                consultationRequestId,
                ConsultationWaitingEventType.CANCELED,
                null,
                "상담 요청이 취소되었습니다."
        );
    }

    public void publishNoCounselor(String consultationRequestId) {
        publish(
                consultationRequestId,
                ConsultationWaitingEventType.NO_COUNSELOR,
                null,
                "상담 가능한 상담자가 없습니다."
        );
    }

    private void publish(
            String consultationRequestId,
            ConsultationWaitingEventType type,
            String signalingRoomId,
            String message
    ) {
        Instant now = Instant.now(clock);
        emitterRegistry.publish(new ConsultationWaitingEventResponse(
                consultationRequestId,
                type,
                signalingRoomId,
                message,
                now
        ));
    }
}

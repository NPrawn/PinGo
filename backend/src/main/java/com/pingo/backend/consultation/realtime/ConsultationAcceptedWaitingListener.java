package com.pingo.backend.consultation.realtime;

import com.pingo.backend.consultation.event.ConsultationAcceptedEvent;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * 수락 사실을 대기 중인 사용자에게 알린다.
 *
 * 커밋된 다음에 보내야 한다. 알림을 받은 사용자는 곧바로 상담을 다시 조회해 signaling
 * 토큰을 받아 가는데, 커밋 전에 알리면 그 조회가 아직 WAITING 인 상담을 읽어 토큰 없이
 * 돌아온다.
 */
@Component
@RequiredArgsConstructor
public class ConsultationAcceptedWaitingListener {

    private final ConsultationWaitingEventPublisher consultationWaitingEventPublisher;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleConsultationAccepted(ConsultationAcceptedEvent event) {
        consultationWaitingEventPublisher.publishAccepted(event.consultationId(), event.signalingRoomId());
    }
}

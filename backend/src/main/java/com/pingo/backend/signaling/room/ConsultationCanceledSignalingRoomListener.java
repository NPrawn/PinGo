package com.pingo.backend.signaling.room;

import com.pingo.backend.consultation.event.ConsultationCanceledEvent;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
@RequiredArgsConstructor
public class ConsultationCanceledSignalingRoomListener {

    private final SignalingRoomRegistry signalingRoomRegistry;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleConsultationCanceled(ConsultationCanceledEvent event) {
        if (event.signalingRoomId() == null) {
            return;
        }

        signalingRoomRegistry.removeRoom(event.signalingRoomId());
    }
}

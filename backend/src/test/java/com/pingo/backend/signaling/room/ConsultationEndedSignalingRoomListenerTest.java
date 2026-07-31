package com.pingo.backend.signaling.room;

import com.pingo.backend.consultation.event.ConsultationEndedEvent;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.lang.reflect.Method;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

class ConsultationEndedSignalingRoomListenerTest {

    private SignalingRoomRegistry signalingRoomRegistry;
    private ConsultationEndedSignalingRoomListener listener;

    @BeforeEach
    void setUp() {
        signalingRoomRegistry = mock(SignalingRoomRegistry.class);
        listener = new ConsultationEndedSignalingRoomListener(signalingRoomRegistry);
    }

    @Test
    void handleConsultationEndedRemovesSignalingRoom() {
        listener.handleConsultationEnded(new ConsultationEndedEvent("consultation-1", "room_consultation-1"));

        verify(signalingRoomRegistry).removeRoom("room_consultation-1");
    }

    @Test
    void handleConsultationEndedDoesNothingWhenSignalingRoomIdIsNull() {
        listener.handleConsultationEnded(new ConsultationEndedEvent("consultation-1", null));

        verify(signalingRoomRegistry, never()).removeRoom(null);
    }

    @Test
    void handleConsultationEndedRunsAfterCommit() throws NoSuchMethodException {
        Method method = ConsultationEndedSignalingRoomListener.class.getDeclaredMethod(
                "handleConsultationEnded",
                ConsultationEndedEvent.class
        );

        TransactionalEventListener annotation = method.getAnnotation(TransactionalEventListener.class);

        assertThat(annotation).isNotNull();
        assertThat(annotation.phase()).isEqualTo(TransactionPhase.AFTER_COMMIT);
    }
}

package com.pingo.backend.consultation.datachannel;

import com.pingo.backend.consultation.datachannel.dto.ConsultationDataChannelEventResponse;
import com.pingo.backend.consultation.realtime.ConsultationWaitingEmitterRegistry;
import com.pingo.backend.global.config.AsyncConfig;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class ConsultationDataChannelEventListener {

    private static final String DATA_CHANNEL_EVENT_NAME = "DATA_CHANNEL";

    private final ConsultationWaitingEmitterRegistry emitterRegistry;

    @Async(AsyncConfig.CONSULTATION_EVENT_TASK_EXECUTOR)
    @EventListener
    public void handleDataChannelEvent(ConsultationDataChannelEventResponse event) {
        emitterRegistry.publish(
                event.consultationRequestId(),
                DATA_CHANNEL_EVENT_NAME,
                event
        );
    }
}

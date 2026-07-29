package com.pingo.backend.consultation.realtime;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@Component
public class ConsultationWaitingEmitterRegistry {

    private static final long TIMEOUT_MILLIS = 60L * 1000L * 5L;

    private final Map<String, SseEmitter> emitters = new ConcurrentHashMap<>();

    public SseEmitter register(String consultationRequestId) {
        SseEmitter emitter = new SseEmitter(TIMEOUT_MILLIS);
        emitters.put(consultationRequestId, emitter);

        emitter.onCompletion(() -> emitters.remove(consultationRequestId, emitter));
        emitter.onTimeout(() -> emitters.remove(consultationRequestId, emitter));
        emitter.onError(error -> emitters.remove(consultationRequestId, emitter));

        return emitter;
    }

    public void publish(ConsultationWaitingEventResponse event) {
        SseEmitter emitter = emitters.get(event.consultationRequestId());
        if (emitter == null) {
            return;
        }

        try {
            emitter.send(SseEmitter.event()
                    .name(event.type().name())
                    .data(event));
        } catch (IOException exception) {
            emitters.remove(event.consultationRequestId(), emitter);
        }
    }

    boolean contains(String consultationRequestId) {
        return emitters.containsKey(consultationRequestId);
    }
}

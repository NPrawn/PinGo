package com.pingo.backend.consultation.realtime;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@Component
public class ConsultationWaitingEmitterRegistry {

    private static final long TIMEOUT_MILLIS = 60L * 1000L * 5L;
    private static final String INIT_EVENT_NAME = "INIT";
    private static final String INIT_EVENT_DATA = "connected";

    private final Map<String, SseEmitter> emitters = new ConcurrentHashMap<>();
    private final Function<Long, SseEmitter> emitterFactory;

    public ConsultationWaitingEmitterRegistry() {
        this(SseEmitter::new);
    }

    ConsultationWaitingEmitterRegistry(Function<Long, SseEmitter> emitterFactory) {
        this.emitterFactory = emitterFactory;
    }

    public SseEmitter register(String consultationRequestId) {
        SseEmitter emitter = emitterFactory.apply(TIMEOUT_MILLIS);
        SseEmitter previousEmitter = emitters.put(consultationRequestId, emitter);
        if (previousEmitter != null) {
            previousEmitter.complete();
        }

        emitter.onCompletion(() -> emitters.remove(consultationRequestId, emitter));
        emitter.onTimeout(() -> emitters.remove(consultationRequestId, emitter));
        emitter.onError(error -> emitters.remove(consultationRequestId, emitter));

        try {
            emitter.send(SseEmitter.event()
                    .name(INIT_EVENT_NAME)
                    .data(INIT_EVENT_DATA));
        } catch (IOException | IllegalStateException exception) {
            emitters.remove(consultationRequestId, emitter);
            emitter.completeWithError(exception);
        }

        return emitter;
    }

    public void publish(ConsultationWaitingEventResponse event) {
        publish(event.consultationRequestId(), event.type().name(), event);
    }

    public void publish(String consultationRequestId, String eventName, Object data) {
        SseEmitter emitter = emitters.get(consultationRequestId);
        if (emitter == null) {
            return;
        }

        try {
            emitter.send(SseEmitter.event()
                    .name(eventName)
                    .data(data));
        } catch (IOException | IllegalStateException exception) {
            emitters.remove(consultationRequestId, emitter);
            emitter.completeWithError(exception);
        }
    }

    boolean contains(String consultationRequestId) {
        return emitters.containsKey(consultationRequestId);
    }
}

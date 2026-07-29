package com.pingo.backend.consultation.realtime;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

public class ConsultationWaitingEmitterRegistryTest {

    private ConsultationWaitingEmitterRegistry registry;

    @BeforeEach
    void setUp() {
        registry = new ConsultationWaitingEmitterRegistry();
    }

    @Test
    void registerStoresEmitter() {
        SseEmitter emitter = registry.register("consultation-1");

        assertThat(emitter).isNotNull();
        assertThat(registry.contains("consultation-1")).isTrue();
    }

    @Test
    void publishDoesNothingWhenEmitterDoesNotExist() {
        ConsultationWaitingEventResponse event = new ConsultationWaitingEventResponse(
                "consultation-1",
                ConsultationWaitingEventType.WAITING,
                null,
                "상담자를 기다리는 중입니다",
                Instant.parse("2026-07-29T00:00:00Z")
        );

        registry.publish(event);

        assertThat(registry.contains("consultation-1")).isFalse();
    }
}

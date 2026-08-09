package com.pingo.backend.signaling.room;

import java.time.Duration;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
@EnableConfigurationProperties(SignalingRoomCleanupProperties.class)
public class SignalingRoomCleanupScheduler {

    private final SignalingRoomRegistry signalingRoomRegistry;
    private final SignalingRoomCleanupProperties properties;

    @Scheduled(fixedDelayString = "${signaling.room.cleanup.fixed-delay-ms}")
    public void removeExpiredRooms() {
        int removedCount = signalingRoomRegistry.removeExpiredRooms(Duration.ofMinutes(properties.expirationMinutes()));
        if (removedCount > 0) {
            log.info("Expired signaling rooms removed. count={}", removedCount);
        }
    }
}

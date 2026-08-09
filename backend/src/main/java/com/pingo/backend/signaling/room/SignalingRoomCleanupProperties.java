package com.pingo.backend.signaling.room;

import jakarta.validation.constraints.Min;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "signaling.room.cleanup")
public record SignalingRoomCleanupProperties(
        @Min(1)
        long expirationMinutes,

        @Min(1)
        long fixedDelayMs
) {
}

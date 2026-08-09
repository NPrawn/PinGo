package com.pingo.backend.signaling.room;

import java.time.Duration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class SignalingRoomCleanupSchedulerTest {

    private SignalingRoomRegistry signalingRoomRegistry;
    private SignalingRoomCleanupScheduler scheduler;

    @BeforeEach
    void setUp() {
        signalingRoomRegistry = mock(SignalingRoomRegistry.class);
        scheduler = new SignalingRoomCleanupScheduler(
                signalingRoomRegistry,
                new SignalingRoomCleanupProperties(30, 60_000)
        );
    }

    @Test
    void removeExpiredRoomsRemovesExpiredRoomsWithConfiguredExpiration() {
        scheduler.removeExpiredRooms();

        verify(signalingRoomRegistry).removeExpiredRooms(Duration.ofMinutes(30));
    }
}

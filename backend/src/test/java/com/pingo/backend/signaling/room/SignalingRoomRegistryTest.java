package com.pingo.backend.signaling.room;

import com.pingo.backend.signaling.dto.SignalingSenderType;
import java.io.IOException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.concurrent.ConcurrentHashMap;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SignalingRoomRegistryTest {

    private SignalingRoomRegistry registry;
    private MutableClock clock;
    private static final CloseStatus SIGNALING_ROOM_EXPIRED =
            new CloseStatus(4408, "Signaling Room Expired");
    private static final CloseStatus SIGNALING_ROOM_CLOSED =
            new CloseStatus(4400, "Signaling Room Closed");

    @BeforeEach
    void setUp() {
        clock = new MutableClock(Instant.parse("2026-07-30T00:00:00Z"));
        registry = new SignalingRoomRegistry(clock);
    }

    @Test
    void registerStoresUserAndCounselorInSameRoom() {
        WebSocketSession userSession = webSocketSession("user-session");
        WebSocketSession counselorSession = webSocketSession("counselor-session");

        registry.register("consultation-1", SignalingSenderType.USER, userSession);
        registry.register("consultation-1", SignalingSenderType.COUNSELOR, counselorSession);

        assertThat(registry.findPeer("consultation-1", SignalingSenderType.USER))
                .contains(counselorSession);
        assertThat(registry.findPeer("consultation-1", SignalingSenderType.COUNSELOR))
                .contains(userSession);
    }

    @Test
    void findPeerReturnsEmptyWhenPeerDoesNotExist() {
        WebSocketSession userSession = webSocketSession("user-session");

        registry.register("consultation-1", SignalingSenderType.USER, userSession);

        assertThat(registry.findPeer("consultation-1", SignalingSenderType.USER))
                .isEmpty();
    }

    @Test
    void removeDeletesSessionAndCleansEmptyRoom() {
        WebSocketSession userSession = webSocketSession("user-session");

        registry.register("consultation-1", SignalingSenderType.USER, userSession);

        registry.remove(userSession);

        assertThat(registry.containsRoom("consultation-1")).isFalse();
    }

    @Test
    void removeDeletesOnlyTargetSession() {
        WebSocketSession userSession = webSocketSession("user-session");
        WebSocketSession counselorSession = webSocketSession("counselor-session");

        registry.register("consultation-1", SignalingSenderType.USER, userSession);
        registry.register("consultation-1", SignalingSenderType.COUNSELOR, counselorSession);

        registry.remove(userSession);

        assertThat(registry.containsRoom("consultation-1")).isTrue();
        assertThat(registry.findPeer("consultation-1", SignalingSenderType.USER))
                .contains(counselorSession);
        assertThat(registry.findPeer("consultation-1", SignalingSenderType.COUNSELOR))
                .isEmpty();
    }

    @Test
    void registerMovesExistingSessionToNewRoom() {
        WebSocketSession userSession = webSocketSession("user-session");

        registry.register("consultation-1", SignalingSenderType.USER, userSession);
        registry.register("consultation-2", SignalingSenderType.USER, userSession);

        assertThat(registry.containsRoom("consultation-1")).isFalse();
        assertThat(registry.containsRoom("consultation-2")).isTrue();
    }

    @Test
    void removeDoesNothingWhenSessionIsNotRegistered() {
        WebSocketSession userSession = webSocketSession("user-session");
        WebSocketSession counselorSession = webSocketSession("counselor-session");

        registry.register("consultation-1", SignalingSenderType.COUNSELOR, counselorSession);

        registry.remove(userSession);

        assertThat(registry.containsRoom("consultation-1")).isTrue();
        assertThat(registry.findPeer("consultation-1", SignalingSenderType.USER))
                .contains(counselorSession);
    }

    @Test
    void registerSkipsClosedSession() {
        WebSocketSession userSession = webSocketSession("user-session");
        when(userSession.isOpen()).thenReturn(false);

        registry.register("consultation-1", SignalingSenderType.USER, userSession);

        assertThat(registry.containsRoom("consultation-1")).isFalse();
    }

    @Test
    void registerThrowsForSystemSenderType() {
        WebSocketSession systemSession = webSocketSession("system-session");

        assertThatThrownBy(() ->
                registry.register("consultation-1", SignalingSenderType.SYSTEM, systemSession)
        ).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void isRegisteredReturnsTrueForRegisteredSession() {
        WebSocketSession userSession = webSocketSession("user-session");

        registry.register("consultation-1", SignalingSenderType.USER, userSession);

        assertThat(registry.isRegistered("consultation-1", SignalingSenderType.USER, userSession))
                .isTrue();
    }

    @Test
    void isRegisteredReturnsFalseForDifferentSession() {
        WebSocketSession registeredSession = webSocketSession("registered-session");
        WebSocketSession otherSession = webSocketSession("other-session");

        registry.register("consultation-1", SignalingSenderType.USER, registeredSession);

        assertThat(registry.isRegistered("consultation-1", SignalingSenderType.USER, otherSession))
                .isFalse();
    }

    @Test
    void isRegisteredReturnsFalseForSystemSenderType() {
        WebSocketSession systemSession = webSocketSession("system-session");

        assertThat(registry.isRegistered("consultation-1", SignalingSenderType.SYSTEM, systemSession))
                .isFalse();
    }

    @Test
    void registerUpdatesLastTouchedAt() {
        WebSocketSession userSession = webSocketSession("user-session");

        registry.register("consultation-1", SignalingSenderType.USER, userSession);

        assertThat(registry.lastTouchedAt("consultation-1"))
                .contains(Instant.parse("2026-07-30T00:00:00Z"));
    }

    @Test
    void findPeerUpdatesLastTouchedAt() {
        WebSocketSession userSession = webSocketSession("user-session");
        WebSocketSession counselorSession = webSocketSession("counselor-session");
        registry.register("consultation-1", SignalingSenderType.USER, userSession);
        registry.register("consultation-1", SignalingSenderType.COUNSELOR, counselorSession);
        clock.setInstant(Instant.parse("2026-07-30T00:01:00Z"));

        registry.findPeer("consultation-1", SignalingSenderType.USER);

        assertThat(registry.lastTouchedAt("consultation-1"))
                .contains(Instant.parse("2026-07-30T00:01:00Z"));
    }

    @Test
    void removeExpiredRoomsRemovesOldRoomAndClosesParticipants() throws IOException {
        WebSocketSession userSession = webSocketSession("user-session");
        WebSocketSession counselorSession = webSocketSession("counselor-session");
        registry.register("consultation-1", SignalingSenderType.USER, userSession);
        registry.register("consultation-1", SignalingSenderType.COUNSELOR, counselorSession);
        clock.setInstant(Instant.parse("2026-07-30T00:31:00Z"));

        int removedCount = registry.removeExpiredRooms(Duration.ofMinutes(30));

        assertThat(removedCount).isEqualTo(1);
        assertThat(registry.containsRoom("consultation-1")).isFalse();
        assertThat(registry.isRegistered("consultation-1", SignalingSenderType.USER, userSession))
                .isFalse();
        assertThat(registry.isRegistered("consultation-1", SignalingSenderType.COUNSELOR, counselorSession))
                .isFalse();
        verify(userSession).close(SIGNALING_ROOM_EXPIRED);
        verify(counselorSession).close(SIGNALING_ROOM_EXPIRED);
    }

    @Test
    void removeExpiredRoomsKeepsRecentlyTouchedRoom() throws IOException {
        WebSocketSession userSession = webSocketSession("user-session");
        registry.register("consultation-1", SignalingSenderType.USER, userSession);
        clock.setInstant(Instant.parse("2026-07-30T00:29:00Z"));

        int removedCount = registry.removeExpiredRooms(Duration.ofMinutes(30));

        assertThat(removedCount).isZero();
        assertThat(registry.containsRoom("consultation-1")).isTrue();
        verify(userSession, never()).close();
    }

    @Test
    void removeExpiredRoomsKeepsRoomTouchedByPeerLookup() throws IOException {
        WebSocketSession userSession = webSocketSession("user-session");
        WebSocketSession counselorSession = webSocketSession("counselor-session");
        registry.register("consultation-1", SignalingSenderType.USER, userSession);
        registry.register("consultation-1", SignalingSenderType.COUNSELOR, counselorSession);
        clock.setInstant(Instant.parse("2026-07-30T00:31:00Z"));

        registry.findPeer("consultation-1", SignalingSenderType.USER);
        int removedCount = registry.removeExpiredRooms(Duration.ofMinutes(30));

        assertThat(removedCount).isZero();
        assertThat(registry.containsRoom("consultation-1")).isTrue();
        verify(userSession, never()).close();
        verify(counselorSession, never()).close();
    }

    @Test
    void removeRoomRemovesRoomAndClosesParticipants() throws IOException {
        WebSocketSession userSession = webSocketSession("user-session");
        WebSocketSession counselorSession = webSocketSession("counselor-session");
        registry.register("consultation-1", SignalingSenderType.USER, userSession);
        registry.register("consultation-1", SignalingSenderType.COUNSELOR, counselorSession);

        boolean removed = registry.removeRoom("consultation-1");

        assertThat(removed).isTrue();
        assertThat(registry.containsRoom("consultation-1")).isFalse();
        assertThat(registry.isRegistered("consultation-1", SignalingSenderType.USER, userSession))
                .isFalse();
        assertThat(registry.isRegistered("consultation-1", SignalingSenderType.COUNSELOR, counselorSession))
                .isFalse();
        verify(userSession).close(SIGNALING_ROOM_CLOSED);
        verify(counselorSession).close(SIGNALING_ROOM_CLOSED);
    }

    @Test
    void removeRoomReturnsFalseWhenRoomDoesNotExist() {
        assertThat(registry.removeRoom("unknown-room")).isFalse();
    }

    private WebSocketSession webSocketSession(String id) {
        WebSocketSession session = mock(WebSocketSession.class);
        when(session.getId()).thenReturn(id);
        when(session.isOpen()).thenReturn(true);
        when(session.getAttributes()).thenReturn(new ConcurrentHashMap<>());
        return session;
    }

    private static class MutableClock extends Clock {

        private Instant instant;

        private MutableClock(Instant instant) {
            this.instant = instant;
        }

        private void setInstant(Instant instant) {
            this.instant = instant;
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return instant;
        }
    }
}

package com.pingo.backend.signaling.room;

import com.pingo.backend.signaling.dto.SignalingSenderType;
import java.util.concurrent.ConcurrentHashMap;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.WebSocketSession;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class SignalingRoomRegistryTest {

    private SignalingRoomRegistry registry;

    @BeforeEach
    void setUp() {
        registry = new SignalingRoomRegistry();
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
    void registerThrowsForSystemSenderType() {
        WebSocketSession systemSession = webSocketSession("system-session");

        assertThatThrownBy(() ->
                registry.register("consultation-1", SignalingSenderType.SYSTEM, systemSession)
        ).isInstanceOf(IllegalArgumentException.class);
    }

    private WebSocketSession webSocketSession(String id) {
        WebSocketSession session = mock(WebSocketSession.class);
        when(session.getId()).thenReturn(id);
        when(session.getAttributes()).thenReturn(new ConcurrentHashMap<>());
        return session;
    }
}

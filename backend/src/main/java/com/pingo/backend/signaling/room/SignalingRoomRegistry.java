package com.pingo.backend.signaling.room;

import com.pingo.backend.signaling.dto.SignalingSenderType;
import java.time.Clock;
import java.time.Instant;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketSession;

@Component
@RequiredArgsConstructor
public class SignalingRoomRegistry {

    private static final String SIGNALING_SESSION_ID_ATTRIBUTE = "signalingSessionId";
    private static final String SENDER_TYPE_ATTRIBUTE = "signalingSenderType";

    private final Clock clock;
    private final Map<String, SignalingRoom> rooms = new ConcurrentHashMap<>();

    public void register(String signalingSessionId, SignalingSenderType senderType, WebSocketSession webSocketSession) {
        validateParticipant(senderType);
        remove(webSocketSession);

        Instant now = clock.instant();
        rooms.compute(signalingSessionId, (sessionId, room) -> {
            if (!webSocketSession.isOpen()) {
                return room;
            }

            SignalingRoom currentRoom = room == null ? new SignalingRoom(now) : room;

            webSocketSession.getAttributes().put(SIGNALING_SESSION_ID_ATTRIBUTE, signalingSessionId);
            webSocketSession.getAttributes().put(SENDER_TYPE_ATTRIBUTE, senderType);
            currentRoom.participants.put(senderType, webSocketSession);
            currentRoom.touch(now);
            return currentRoom;
        });
    }

    public Optional<WebSocketSession> findPeer(String signalingSessionId, SignalingSenderType senderType) {
        validateParticipant(senderType);

        SignalingRoom room = rooms.get(signalingSessionId);
        if (room == null) {
            return Optional.empty();
        }

        room.touch(clock.instant());
        return Optional.ofNullable(room.participants.get(peerType(senderType)));
    }

    public void remove(WebSocketSession webSocketSession) {
        Object signalingSessionId = webSocketSession.getAttributes().get(SIGNALING_SESSION_ID_ATTRIBUTE);
        Object senderType = webSocketSession.getAttributes().get(SENDER_TYPE_ATTRIBUTE);

        if (!(signalingSessionId instanceof String sessionId)
                || !(senderType instanceof SignalingSenderType signalingSenderType)) {
            return;
        }

        rooms.computeIfPresent(sessionId, (id, room) -> {
            WebSocketSession registeredSession = room.participants.get(signalingSenderType);
            if (isSameSession(registeredSession, webSocketSession)) {
                room.participants.remove(signalingSenderType);
            }

            return room.participants.isEmpty() ? null : room;
        });

        webSocketSession.getAttributes().remove(SIGNALING_SESSION_ID_ATTRIBUTE);
        webSocketSession.getAttributes().remove(SENDER_TYPE_ATTRIBUTE);
    }

    public boolean isRegistered(String signalingSessionId, SignalingSenderType senderType, WebSocketSession webSocketSession) {
        Object registeredSessionId = webSocketSession.getAttributes().get(SIGNALING_SESSION_ID_ATTRIBUTE);
        Object registeredSenderType = webSocketSession.getAttributes().get(SENDER_TYPE_ATTRIBUTE);

        return Objects.equals(registeredSessionId, signalingSessionId)
                && registeredSenderType == senderType;
    }

    boolean containsRoom(String signalingSessionId) {
        return rooms.containsKey(signalingSessionId);
    }

    Optional<Instant> lastTouchedAt(String signalingSessionId) {
        SignalingRoom room = rooms.get(signalingSessionId);
        return room == null ? Optional.empty() : Optional.of(room.lastTouchedAt);
    }

    private SignalingSenderType peerType(SignalingSenderType senderType) {
        return switch (senderType) {
            case USER -> SignalingSenderType.COUNSELOR;
            case COUNSELOR -> SignalingSenderType.USER;
            case SYSTEM -> throw new IllegalArgumentException("SYSTEM cannot have signaling peer.");
        };
    }

    private void validateParticipant(SignalingSenderType senderType) {
        if (senderType == null || senderType == SignalingSenderType.SYSTEM) {
            throw new IllegalArgumentException("Only USER and COUNSELOR can join signaling room.");
        }
    }

    private boolean isSameSession(WebSocketSession left, WebSocketSession right) {
        if (left == right) {
            return true;
        }

        return left != null && right != null && left.getId().equals(right.getId());
    }

    private static class SignalingRoom {

        private final Map<SignalingSenderType, WebSocketSession> participants = new ConcurrentHashMap<>();
        private volatile Instant lastTouchedAt;

        private SignalingRoom(Instant lastTouchedAt) {
            this.lastTouchedAt = lastTouchedAt;
        }

        private void touch(Instant touchedAt) {
            this.lastTouchedAt = touchedAt;
        }
    }
}

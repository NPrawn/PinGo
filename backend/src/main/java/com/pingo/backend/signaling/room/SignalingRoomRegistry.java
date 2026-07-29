package com.pingo.backend.signaling.room;

import com.pingo.backend.signaling.dto.SignalingSenderType;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketSession;

@Component
public class SignalingRoomRegistry {

    private final Map<String, Map<SignalingSenderType, WebSocketSession>> rooms = new ConcurrentHashMap<>();

    public void register(String signalingSessionId, SignalingSenderType senderType, WebSocketSession webSocketSession) {
        validateParticipant(senderType);

        rooms.compute(signalingSessionId, (sessionId, participants) -> {
            Map<SignalingSenderType, WebSocketSession> room = participants;
            if (room == null) {
                room = new ConcurrentHashMap<>();
            }

            room.put(senderType, webSocketSession);
            return room;
        });
    }

    public Optional<WebSocketSession> findPeer(String signalingSessionId, SignalingSenderType senderType) {
        validateParticipant(senderType);

        Map<SignalingSenderType, WebSocketSession> room = rooms.get(signalingSessionId);
        if (room == null) {
            return Optional.empty();
        }

        return Optional.ofNullable(room.get(peerType(senderType)));
    }

    public void remove(WebSocketSession webSocketSession) {
        rooms.entrySet().removeIf(entry -> {
            entry.getValue().entrySet().removeIf(participant ->
                    isSameSession(participant.getValue(), webSocketSession));

            return entry.getValue().isEmpty();
        });
    }

    boolean containsRoom(String signalingSessionId) {
        return rooms.containsKey(signalingSessionId);
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
}

package com.pingo.backend.signaling.room;

import com.pingo.backend.signaling.dto.SignalingSenderType;
import java.io.IOException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;

@Slf4j
@Component
@RequiredArgsConstructor
public class SignalingRoomRegistry {

    private static final String SIGNALING_SESSION_ID_ATTRIBUTE = "signalingSessionId";
    private static final String SENDER_TYPE_ATTRIBUTE = "signalingSenderType";
    private static final CloseStatus SIGNALING_ROOM_EXPIRED =
            new CloseStatus(4408, "Signaling Room Expired");
    private static final CloseStatus SIGNALING_ROOM_CLOSED =
            new CloseStatus(4400, "Signaling Room Closed");

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

        SignalingSenderType peerType = peerType(senderType);
        AtomicReference<WebSocketSession> peerSession = new AtomicReference<>();
        rooms.computeIfPresent(signalingSessionId, (sessionId, room) -> {
            room.touch(clock.instant());
            peerSession.set(room.participants.get(peerType));
            return room;
        });

        return Optional.ofNullable(peerSession.get());
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

    public int removeExpiredRooms(Duration expiration) {
        Instant expiredBefore = clock.instant().minus(expiration);
        AtomicInteger removedRoomCount = new AtomicInteger();
        List<RegisteredParticipant> expiredParticipants = new ArrayList<>();
        List<String> expiredSessionIds = rooms.entrySet().stream()
                .filter(entry -> entry.getValue().lastTouchedAt.isBefore(expiredBefore))
                .map(Map.Entry::getKey)
                .toList();

        expiredSessionIds.forEach(signalingSessionId -> {
            rooms.computeIfPresent(signalingSessionId, (id, currentRoom) -> {
                if (currentRoom.lastTouchedAt.isBefore(expiredBefore)) {
                    removedRoomCount.incrementAndGet();
                    currentRoom.participants.forEach((senderType, session) ->
                            expiredParticipants.add(new RegisteredParticipant(id, senderType, session)));
                    return null;
                }

                return currentRoom;
            });
        });

        expiredParticipants.forEach(participant -> closeRegisteredParticipant(participant, SIGNALING_ROOM_EXPIRED));
        return removedRoomCount.get();
    }

    public boolean removeRoom(String signalingSessionId) {
        SignalingRoom removedRoom = rooms.remove(signalingSessionId);
        if (removedRoom == null) {
            return false;
        }

        removedRoom.participants.forEach((senderType, session) ->
                closeRegisteredParticipant(
                        new RegisteredParticipant(signalingSessionId, senderType, session),
                        SIGNALING_ROOM_CLOSED
                ));
        return true;
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

    private void closeRegisteredParticipant(RegisteredParticipant participant, CloseStatus closeStatus) {
        WebSocketSession session = participant.session();
        if (!isSameRegistration(session, participant.signalingSessionId(), participant.senderType())) {
            return;
        }

        session.getAttributes().remove(SIGNALING_SESSION_ID_ATTRIBUTE);
        session.getAttributes().remove(SENDER_TYPE_ATTRIBUTE);
        if (!session.isOpen()) {
            return;
        }

        try {
            session.close(closeStatus);
        } catch (IOException exception) {
            log.warn("Failed to close signaling session. websocketSessionId={}, signalingSessionId={}",
                    session.getId(),
                    participant.signalingSessionId(),
                    exception);
        }
    }

    private boolean isSameRegistration(
            WebSocketSession session,
            String signalingSessionId,
            SignalingSenderType senderType
    ) {
        return Objects.equals(session.getAttributes().get(SIGNALING_SESSION_ID_ATTRIBUTE), signalingSessionId)
                && session.getAttributes().get(SENDER_TYPE_ATTRIBUTE) == senderType;
    }

    private record RegisteredParticipant(
            String signalingSessionId,
            SignalingSenderType senderType,
            WebSocketSession session
    ) {
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

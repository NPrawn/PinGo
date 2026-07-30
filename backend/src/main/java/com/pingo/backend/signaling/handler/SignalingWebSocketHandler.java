package com.pingo.backend.signaling.handler;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pingo.backend.signaling.dto.SignalingErrorCode;
import com.pingo.backend.signaling.dto.SignalingErrorPayload;
import com.pingo.backend.signaling.dto.SignalingMessage;
import com.pingo.backend.signaling.dto.SignalingMessageType;
import com.pingo.backend.signaling.dto.SignalingSenderType;
import com.pingo.backend.signaling.room.SignalingRoomRegistry;
import com.pingo.backend.signaling.validation.SignalingSessionValidationResult;
import com.pingo.backend.signaling.validation.SignalingSessionValidator;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.time.Instant;
import java.util.Set;

@Slf4j
@Component
@RequiredArgsConstructor
public class SignalingWebSocketHandler extends TextWebSocketHandler {

    private final SignalingRoomRegistry signalingRoomRegistry;
    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();
    private final Validator validator;
    private final SignalingSessionValidator signalingSessionValidator;

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        log.info("WebSocket connected. sessionId={}", session.getId());
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws IOException {
        String signalingSessionId = null;

        try {
            SignalingMessage signalingMessage = objectMapper.readValue(message.getPayload(), SignalingMessage.class);
            signalingSessionId = signalingMessage.sessionId();
            Set<ConstraintViolation<SignalingMessage>> violations = validator.validate(signalingMessage);

            if (!violations.isEmpty()) {
                log.warn("Invalid signaling message. websocketSessionId={}, violations={}", session.getId(), violations);
                sendError(
                        session,
                        signalingMessage.sessionId(),
                        SignalingErrorCode.INVALID_SIGNALING_MESSAGE,
                        "Required signaling fields are missing or invalid.",
                        false
                );
                return;
            }

            log.info("Signaling message received. websocketSessionId={}, sessionId={}, senderType={}, type={}",
                    session.getId(),
                    signalingMessage.sessionId(),
                    signalingMessage.senderType(),
                    signalingMessage.type());

            handleValidMessage(session, signalingMessage);
        } catch (JsonProcessingException exception) {
            log.warn("Failed to parse signaling message. websocketSessionId={}, payload={}",
                    session.getId(),
                    message.getPayload(),
                    exception);
            sendError(
                    session,
                    null,
                    SignalingErrorCode.INVALID_SIGNALING_MESSAGE,
                    "Invalid signaling message format.",
                    false
            );
        } catch (RuntimeException exception) {
            log.error("Failed to handle signaling message. websocketSessionId={}, sessionId={}",
                    session.getId(),
                    signalingSessionId,
                    exception);
            sendError(
                    session,
                    signalingSessionId,
                    SignalingErrorCode.SIGNALING_INTERNAL_ERROR,
                    "Internal signaling error.",
                    true
            );
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        signalingRoomRegistry.remove(session);

        log.info("WebSocket disconnected. sessionId={}, code={}, reason={}",
                session.getId(),
                status.getCode(),
                status.getReason());
    }

    private void handleValidMessage(WebSocketSession session, SignalingMessage signalingMessage) throws IOException {
        if (signalingMessage.senderType() == SignalingSenderType.SYSTEM) {
            sendError(
                    session,
                    signalingMessage.sessionId(),
                    SignalingErrorCode.INVALID_SIGNALING_MESSAGE,
                    "SYSTEM senderType cannot be sent by client.",
                    false
            );
            return;
        }

        switch (signalingMessage.type()) {
            case JOIN -> handleJoin(session, signalingMessage);
            case LEAVE -> signalingRoomRegistry.remove(session);
            case OFFER, ANSWER, ICE_CANDIDATE, CAPTION -> relayToPeer(session, signalingMessage);
            case ERROR -> log.warn("Client sent signaling ERROR message. websocketSessionId={}, sessionId={}",
                    session.getId(),
                    signalingMessage.sessionId());
        }
    }

    private void relayToPeer(WebSocketSession session, SignalingMessage signalingMessage) throws IOException {
        if (!signalingRoomRegistry.isRegistered(
                signalingMessage.sessionId(),
                signalingMessage.senderType(),
                session
        )) {
            sendError(
                    session,
                    signalingMessage.sessionId(),
                    SignalingErrorCode.SIGNALING_SESSION_NOT_JOINED,
                    "Signaling session is not joined.",
                    false
            );
            return;
        }
        WebSocketSession peerSession = signalingRoomRegistry
                .findPeer(signalingMessage.sessionId(), signalingMessage.senderType())
                .filter(WebSocketSession::isOpen)
                .orElse(null);

        if (peerSession == null) {
            sendError(
                    session,
                    signalingMessage.sessionId(),
                    SignalingErrorCode.SIGNALING_PEER_NOT_CONNECTED,
                    "Signaling peer is not connected.",
                    true
            );
            return;
        }

        peerSession.sendMessage(new TextMessage(objectMapper.writeValueAsString(signalingMessage)));
    }

    private void sendError(
            WebSocketSession session,
            String signalingSessionId,
            SignalingErrorCode errorCode,
            String message,
            boolean retryable
    ) throws IOException {
        SignalingMessage errorMessage = new SignalingMessage(
                signalingSessionId == null ? session.getId() : signalingSessionId,
                SignalingSenderType.SYSTEM,
                SignalingMessageType.ERROR,
                objectMapper.valueToTree(new SignalingErrorPayload(
                        errorCode.name(),
                        message,
                        retryable
                )),
                Instant.now()
        );

        session.sendMessage(new TextMessage(objectMapper.writeValueAsString(errorMessage)));
    }

    private void handleJoin(WebSocketSession session, SignalingMessage signalingMessage) throws IOException {
        SignalingSessionValidationResult validationResult = signalingSessionValidator.validateJoin(
                signalingMessage.sessionId(),
                signalingMessage.senderType()
        );

        if (validationResult != SignalingSessionValidationResult.VALID) {
            sendError(
                    session,
                    signalingMessage.sessionId(),
                    SignalingErrorCode.INVALID_SIGNALING_SESSION,
                    "Invalid signaling session.",
                    false
            );
            return;
        }

        signalingRoomRegistry.register(
                signalingMessage.sessionId(),
                signalingMessage.senderType(),
                session
        );
    }
}

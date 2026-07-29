package com.pingo.backend.signaling.handler;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pingo.backend.signaling.dto.SignalingMessage;
import com.pingo.backend.signaling.dto.SignalingMessageType;
import com.pingo.backend.signaling.dto.SignalingSenderType;
import com.pingo.backend.signaling.room.SignalingRoomRegistry;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.time.Instant;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SignalingWebSocketHandlerTest {

    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();

    private SignalingRoomRegistry signalingRoomRegistry;
    private SignalingWebSocketHandler handler;

    @BeforeEach
    void setUp() {
        Validator validator = Validation.buildDefaultValidatorFactory().getValidator();
        signalingRoomRegistry = mock(SignalingRoomRegistry.class);
        handler = new SignalingWebSocketHandler(signalingRoomRegistry, validator);    }

    @Test
    void handleJoinRegistersSession() throws Exception {
        WebSocketSession webSocketSession = webSocketSession("ws-user");

        handler.handleTextMessage(webSocketSession, textMessage(SignalingMessageType.JOIN, SignalingSenderType.USER));

        verify(signalingRoomRegistry).register("consultation-1", SignalingSenderType.USER, webSocketSession);
    }

    @Test
    void handleLeaveRemovesSession() throws Exception {
        WebSocketSession webSocketSession = webSocketSession("ws-user");

        handler.handleTextMessage(webSocketSession, textMessage(SignalingMessageType.LEAVE, SignalingSenderType.USER));

        verify(signalingRoomRegistry).remove(webSocketSession);
    }

    @Test
    void afterConnectionClosedRemovesSession() {
        WebSocketSession webSocketSession = webSocketSession("ws-user");

        handler.afterConnectionClosed(webSocketSession, CloseStatus.NORMAL);

        verify(signalingRoomRegistry).remove(webSocketSession);
    }

    private TextMessage textMessage(SignalingMessageType type, SignalingSenderType senderType) throws Exception {
        SignalingMessage message = new SignalingMessage(
                "consultation-1",
                senderType,
                type,
                objectMapper.createObjectNode(),
                Instant.parse("2026-07-29T00:00:00Z")
        );

        return new TextMessage(objectMapper.writeValueAsString(message));
    }

    private WebSocketSession webSocketSession(String id) {
        WebSocketSession session = mock(WebSocketSession.class);
        when(session.getId()).thenReturn(id);
        return session;
    }
}
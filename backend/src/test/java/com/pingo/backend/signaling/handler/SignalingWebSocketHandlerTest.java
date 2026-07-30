package com.pingo.backend.signaling.handler;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pingo.backend.signaling.dto.SignalingMessage;
import com.pingo.backend.signaling.dto.SignalingMessageType;
import com.pingo.backend.signaling.dto.SignalingSenderType;
import com.pingo.backend.signaling.room.SignalingRoomRegistry;
import com.pingo.backend.signaling.validation.SignalingSessionValidationResult;
import com.pingo.backend.signaling.validation.SignalingSessionValidator;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.time.Instant;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;

class SignalingWebSocketHandlerTest {

    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();

    private SignalingRoomRegistry signalingRoomRegistry;
    private SignalingWebSocketHandler handler;
    private SignalingSessionValidator signalingSessionValidator;

    @BeforeEach
    void setUp() {
        Validator validator = Validation.buildDefaultValidatorFactory().getValidator();
        signalingRoomRegistry = mock(SignalingRoomRegistry.class);
        signalingSessionValidator = mock(SignalingSessionValidator.class);
        when(signalingSessionValidator.validateJoin(any(), any()))
                .thenReturn(SignalingSessionValidationResult.VALID);

        handler = new SignalingWebSocketHandler(signalingRoomRegistry, validator, signalingSessionValidator);
    }

    @Test
    void handleJoinRegistersSession() throws Exception {
        WebSocketSession webSocketSession = webSocketSession("ws-user");

        handler.handleTextMessage(webSocketSession, textMessage(SignalingMessageType.JOIN, SignalingSenderType.USER));

        verify(signalingSessionValidator).validateJoin("consultation-1", SignalingSenderType.USER);
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

    @Test
    void handleOfferRelaysMessageToPeer() throws Exception {
        WebSocketSession userSession = webSocketSession("ws-user");
        WebSocketSession counselorSession = webSocketSession("ws-counselor");
        when(counselorSession.isOpen()).thenReturn(true);
        when(signalingRoomRegistry.findPeer("consultation-1", SignalingSenderType.USER))
                .thenReturn(Optional.of(counselorSession));
        when(signalingRoomRegistry.isRegistered("consultation-1", SignalingSenderType.USER, userSession))
                .thenReturn(true);

        handler.handleTextMessage(userSession, textMessage(SignalingMessageType.OFFER, SignalingSenderType.USER));

        ArgumentCaptor<TextMessage> messageCaptor = ArgumentCaptor.forClass(TextMessage.class);
        verify(counselorSession).sendMessage(messageCaptor.capture());

        SignalingMessage relayedMessage = objectMapper.readValue(
                messageCaptor.getValue().getPayload(),
                SignalingMessage.class
        );

        assertThat(relayedMessage.sessionId()).isEqualTo("consultation-1");
        assertThat(relayedMessage.senderType()).isEqualTo(SignalingSenderType.USER);
        assertThat(relayedMessage.type()).isEqualTo(SignalingMessageType.OFFER);
    }

    @Test
    void handleIceCandidateRelaysMessageToPeer() throws Exception {
        WebSocketSession counselorSession = webSocketSession("ws-counselor");
        WebSocketSession userSession = webSocketSession("ws-user");
        when(userSession.isOpen()).thenReturn(true);
        when(signalingRoomRegistry.findPeer("consultation-1", SignalingSenderType.COUNSELOR))
                .thenReturn(Optional.of(userSession));
        when(signalingRoomRegistry.isRegistered("consultation-1", SignalingSenderType.COUNSELOR, counselorSession))
                .thenReturn(true);

        handler.handleTextMessage(
                counselorSession,
                textMessage(SignalingMessageType.ICE_CANDIDATE, SignalingSenderType.COUNSELOR)
        );

        ArgumentCaptor<TextMessage> messageCaptor = ArgumentCaptor.forClass(TextMessage.class);
        verify(userSession).sendMessage(messageCaptor.capture());

        SignalingMessage relayedMessage = objectMapper.readValue(
                messageCaptor.getValue().getPayload(),
                SignalingMessage.class
        );

        assertThat(relayedMessage.sessionId()).isEqualTo("consultation-1");
        assertThat(relayedMessage.senderType()).isEqualTo(SignalingSenderType.COUNSELOR);
        assertThat(relayedMessage.type()).isEqualTo(SignalingMessageType.ICE_CANDIDATE);
    }

    @Test
    void handleRelayMessageReturnsErrorWhenPeerDoesNotExist() throws Exception {
        WebSocketSession userSession = webSocketSession("ws-user");
        when(signalingRoomRegistry.findPeer("consultation-1", SignalingSenderType.USER))
                .thenReturn(Optional.empty());
        when(signalingRoomRegistry.isRegistered("consultation-1", SignalingSenderType.USER, userSession))
                .thenReturn(true);

        handler.handleTextMessage(userSession, textMessage(SignalingMessageType.OFFER, SignalingSenderType.USER));

        ArgumentCaptor<TextMessage> messageCaptor = ArgumentCaptor.forClass(TextMessage.class);
        verify(userSession).sendMessage(messageCaptor.capture());
        verify(signalingRoomRegistry).findPeer("consultation-1", SignalingSenderType.USER);

        SignalingMessage errorMessage = objectMapper.readValue(
                messageCaptor.getValue().getPayload(),
                SignalingMessage.class
        );

        assertThat(errorMessage.sessionId()).isEqualTo("consultation-1");
        assertThat(errorMessage.senderType()).isEqualTo(SignalingSenderType.SYSTEM);
        assertThat(errorMessage.type()).isEqualTo(SignalingMessageType.ERROR);
        assertThat(errorMessage.payload().get("code").asText()).isEqualTo("SIGNALING_PEER_NOT_CONNECTED");
        assertThat(errorMessage.payload().get("retryable").asBoolean()).isTrue();
    }

    @Test
    void handleInvalidJsonReturnsError() throws Exception {
        WebSocketSession userSession = webSocketSession("ws-user");

        handler.handleTextMessage(userSession, new TextMessage("{invalid-json"));

        ArgumentCaptor<TextMessage> messageCaptor = ArgumentCaptor.forClass(TextMessage.class);
        verify(userSession).sendMessage(messageCaptor.capture());
        verify(signalingRoomRegistry, never()).register(any(), any(), any());
        verify(signalingRoomRegistry, never()).findPeer(any(), any());

        SignalingMessage errorMessage = objectMapper.readValue(
                messageCaptor.getValue().getPayload(),
                SignalingMessage.class
        );

        assertThat(errorMessage.sessionId()).isEqualTo("ws-user");
        assertThat(errorMessage.senderType()).isEqualTo(SignalingSenderType.SYSTEM);
        assertThat(errorMessage.type()).isEqualTo(SignalingMessageType.ERROR);
        assertThat(errorMessage.payload().get("code").asText()).isEqualTo("INVALID_SIGNALING_MESSAGE");
    }

    @Test
    void handleMissingRequiredFieldReturnsError() throws Exception {
        WebSocketSession userSession = webSocketSession("ws-user");
        String payload = """
                {
                  "sessionId": "consultation-1",
                  "senderType": "USER",
                  "payload": {},
                  "timestamp": "2026-07-29T00:00:00Z"
                }
                """;

        handler.handleTextMessage(userSession, new TextMessage(payload));

        ArgumentCaptor<TextMessage> messageCaptor = ArgumentCaptor.forClass(TextMessage.class);
        verify(userSession).sendMessage(messageCaptor.capture());
        verify(signalingRoomRegistry, never()).register(any(), any(), any());
        verify(signalingRoomRegistry, never()).findPeer(any(), any());

        SignalingMessage errorMessage = objectMapper.readValue(
                messageCaptor.getValue().getPayload(),
                SignalingMessage.class
        );

        assertThat(errorMessage.sessionId()).isEqualTo("consultation-1");
        assertThat(errorMessage.senderType()).isEqualTo(SignalingSenderType.SYSTEM);
        assertThat(errorMessage.type()).isEqualTo(SignalingMessageType.ERROR);
        assertThat(errorMessage.payload().get("code").asText()).isEqualTo("INVALID_SIGNALING_MESSAGE");
    }

    @Test
    void handleClosedPeerReturnsErrorToSender() throws Exception {
        WebSocketSession userSession = webSocketSession("ws-user");
        WebSocketSession counselorSession = webSocketSession("ws-counselor");
        when(counselorSession.isOpen()).thenReturn(false);
        when(signalingRoomRegistry.findPeer("consultation-1", SignalingSenderType.USER))
                .thenReturn(Optional.of(counselorSession));
        when(signalingRoomRegistry.isRegistered("consultation-1", SignalingSenderType.USER, userSession))
                .thenReturn(true);

        handler.handleTextMessage(userSession, textMessage(SignalingMessageType.ANSWER, SignalingSenderType.USER));

        ArgumentCaptor<TextMessage> messageCaptor = ArgumentCaptor.forClass(TextMessage.class);
        verify(userSession).sendMessage(messageCaptor.capture());
        verify(counselorSession, never()).sendMessage(any());

        SignalingMessage errorMessage = objectMapper.readValue(
                messageCaptor.getValue().getPayload(),
                SignalingMessage.class
        );

        assertThat(errorMessage.sessionId()).isEqualTo("consultation-1");
        assertThat(errorMessage.senderType()).isEqualTo(SignalingSenderType.SYSTEM);
        assertThat(errorMessage.type()).isEqualTo(SignalingMessageType.ERROR);
        assertThat(errorMessage.payload().get("code").asText()).isEqualTo("SIGNALING_PEER_NOT_CONNECTED");
        assertThat(errorMessage.payload().get("message").asText()).isEqualTo("Signaling peer is not connected.");
        assertThat(errorMessage.payload().get("retryable").asBoolean()).isTrue();
    }

    @Test
    void handleJoinReturnsErrorWhenSignalingSessionIsInvalid() throws Exception {
        when(signalingSessionValidator.validateJoin("consultation-1", SignalingSenderType.USER))
                .thenReturn(SignalingSessionValidationResult.SESSION_NOT_FOUND);

        WebSocketSession webSocketSession = webSocketSession("ws-user");

        handler.handleTextMessage(webSocketSession, textMessage(SignalingMessageType.JOIN, SignalingSenderType.USER));

        ArgumentCaptor<TextMessage> messageCaptor = ArgumentCaptor.forClass(TextMessage.class);
        verify(webSocketSession).sendMessage(messageCaptor.capture());
        verify(signalingRoomRegistry, never()).register(any(), any(), any());

        SignalingMessage errorMessage = objectMapper.readValue(
                messageCaptor.getValue().getPayload(),
                SignalingMessage.class
        );

        assertThat(errorMessage.sessionId()).isEqualTo("consultation-1");
        assertThat(errorMessage.senderType()).isEqualTo(SignalingSenderType.SYSTEM);
        assertThat(errorMessage.type()).isEqualTo(SignalingMessageType.ERROR);
        assertThat(errorMessage.payload().get("code").asText()).isEqualTo("INVALID_SIGNALING_SESSION");
        assertThat(errorMessage.payload().get("message").asText()).isEqualTo("Signaling session does not exist.");
        assertThat(errorMessage.payload().get("retryable").asBoolean()).isFalse();
    }

    @Test
    void handleJoinReturnsRetryableErrorWhenConsultationIsNotAcceptedYet() throws Exception {
        when(signalingSessionValidator.validateJoin("consultation-1", SignalingSenderType.USER))
                .thenReturn(SignalingSessionValidationResult.SESSION_NOT_ACCEPTED);

        WebSocketSession webSocketSession = webSocketSession("ws-user");

        handler.handleTextMessage(webSocketSession, textMessage(SignalingMessageType.JOIN, SignalingSenderType.USER));

        ArgumentCaptor<TextMessage> messageCaptor = ArgumentCaptor.forClass(TextMessage.class);
        verify(webSocketSession).sendMessage(messageCaptor.capture());
        verify(signalingRoomRegistry, never()).register(any(), any(), any());

        SignalingMessage errorMessage = objectMapper.readValue(
                messageCaptor.getValue().getPayload(),
                SignalingMessage.class
        );

        assertThat(errorMessage.payload().get("code").asText()).isEqualTo("INVALID_SIGNALING_SESSION");
        assertThat(errorMessage.payload().get("message").asText()).isEqualTo("Consultation is not accepted yet.");
        assertThat(errorMessage.payload().get("retryable").asBoolean()).isTrue();
    }

    @Test
    void handleJoinReturnsNonRetryableErrorWhenConsultationIsClosed() throws Exception {
        when(signalingSessionValidator.validateJoin("consultation-1", SignalingSenderType.USER))
                .thenReturn(SignalingSessionValidationResult.SESSION_CLOSED);

        WebSocketSession webSocketSession = webSocketSession("ws-user");

        handler.handleTextMessage(webSocketSession, textMessage(SignalingMessageType.JOIN, SignalingSenderType.USER));

        ArgumentCaptor<TextMessage> messageCaptor = ArgumentCaptor.forClass(TextMessage.class);
        verify(webSocketSession).sendMessage(messageCaptor.capture());
        verify(signalingRoomRegistry, never()).register(any(), any(), any());

        SignalingMessage errorMessage = objectMapper.readValue(
                messageCaptor.getValue().getPayload(),
                SignalingMessage.class
        );

        assertThat(errorMessage.payload().get("code").asText()).isEqualTo("INVALID_SIGNALING_SESSION");
        assertThat(errorMessage.payload().get("message").asText()).isEqualTo("Consultation signaling session is closed.");
        assertThat(errorMessage.payload().get("retryable").asBoolean()).isFalse();
    }

    @Test
    void handleJoinReturnsInternalErrorWhenValidatorThrowsException() throws Exception {
        when(signalingSessionValidator.validateJoin("consultation-1", SignalingSenderType.USER))
                .thenThrow(new IllegalStateException("validator failed"));

        WebSocketSession webSocketSession = webSocketSession("ws-user");

        handler.handleTextMessage(webSocketSession, textMessage(SignalingMessageType.JOIN, SignalingSenderType.USER));

        ArgumentCaptor<TextMessage> messageCaptor = ArgumentCaptor.forClass(TextMessage.class);
        verify(webSocketSession).sendMessage(messageCaptor.capture());
        verify(signalingRoomRegistry, never()).register(any(), any(), any());

        SignalingMessage errorMessage = objectMapper.readValue(
                messageCaptor.getValue().getPayload(),
                SignalingMessage.class
        );

        assertThat(errorMessage.sessionId()).isEqualTo("consultation-1");
        assertThat(errorMessage.senderType()).isEqualTo(SignalingSenderType.SYSTEM);
        assertThat(errorMessage.type()).isEqualTo(SignalingMessageType.ERROR);
        assertThat(errorMessage.payload().get("code").asText()).isEqualTo("SIGNALING_INTERNAL_ERROR");
        assertThat(errorMessage.payload().get("retryable").asBoolean()).isTrue();
    }

    @Test
    void handleRelayMessageReturnsErrorWhenSessionIsNotJoined() throws Exception {
        WebSocketSession userSession = webSocketSession("ws-user");
        when(signalingRoomRegistry.isRegistered("consultation-1", SignalingSenderType.USER, userSession))
                .thenReturn(false);

        handler.handleTextMessage(userSession, textMessage(SignalingMessageType.OFFER, SignalingSenderType.USER));

        ArgumentCaptor<TextMessage> messageCaptor = ArgumentCaptor.forClass(TextMessage.class);
        verify(userSession).sendMessage(messageCaptor.capture());
        verify(signalingRoomRegistry, never()).findPeer(any(), any());

        SignalingMessage errorMessage = objectMapper.readValue(
                messageCaptor.getValue().getPayload(),
                SignalingMessage.class
        );

        assertThat(errorMessage.sessionId()).isEqualTo("consultation-1");
        assertThat(errorMessage.senderType()).isEqualTo(SignalingSenderType.SYSTEM);
        assertThat(errorMessage.type()).isEqualTo(SignalingMessageType.ERROR);
        assertThat(errorMessage.payload().get("code").asText()).isEqualTo("SIGNALING_SESSION_NOT_JOINED");
        assertThat(errorMessage.payload().get("retryable").asBoolean()).isFalse();
    }

    @Test
    void handleSystemSenderTypeReturnsError() throws Exception {
        WebSocketSession webSocketSession = webSocketSession("ws-system");

        handler.handleTextMessage(webSocketSession, textMessage(SignalingMessageType.JOIN, SignalingSenderType.SYSTEM));

        ArgumentCaptor<TextMessage> messageCaptor = ArgumentCaptor.forClass(TextMessage.class);
        verify(webSocketSession).sendMessage(messageCaptor.capture());
        verify(signalingSessionValidator, never()).validateJoin(any(), any());
        verify(signalingRoomRegistry, never()).register(any(), any(), any());

        SignalingMessage errorMessage = objectMapper.readValue(
                messageCaptor.getValue().getPayload(),
                SignalingMessage.class
        );

        assertThat(errorMessage.sessionId()).isEqualTo("consultation-1");
        assertThat(errorMessage.senderType()).isEqualTo(SignalingSenderType.SYSTEM);
        assertThat(errorMessage.type()).isEqualTo(SignalingMessageType.ERROR);
        assertThat(errorMessage.payload().get("code").asText()).isEqualTo("INVALID_SIGNALING_MESSAGE");
        assertThat(errorMessage.payload().get("retryable").asBoolean()).isFalse();
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
        when(session.isOpen()).thenReturn(true);
        return session;
    }
}

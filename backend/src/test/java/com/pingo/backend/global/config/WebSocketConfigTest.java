package com.pingo.backend.global.config;

import com.pingo.backend.signaling.auth.SignalingHandshakeInterceptor;
import com.pingo.backend.signaling.handler.SignalingWebSocketHandler;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistration;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

import java.util.List;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class WebSocketConfigTest {

    @Test
    void registerWebSocketHandlersUsesConfiguredAllowedOriginPatterns() {
        SignalingWebSocketHandler signalingWebSocketHandler = mock(SignalingWebSocketHandler.class);
        SignalingHandshakeInterceptor signalingHandshakeInterceptor = mock(SignalingHandshakeInterceptor.class);
        WebSocketHandlerRegistry registry = mock(WebSocketHandlerRegistry.class);
        WebSocketHandlerRegistration registration = mock(WebSocketHandlerRegistration.class);
        when(registry.addHandler(signalingWebSocketHandler, "/ws/signaling"))
                .thenReturn(registration);
        when(registration.addInterceptors(signalingHandshakeInterceptor))
                .thenReturn(registration);

        WebSocketConfig config = new WebSocketConfig(
                signalingWebSocketHandler,
                signalingHandshakeInterceptor,
                List.of("http://localhost:5173", " https://jenkins.example.invalid ")
        );

        config.registerWebSocketHandlers(registry);

        verify(registration).setAllowedOriginPatterns(
                "http://localhost:5173",
                "https://jenkins.example.invalid"
        );
    }
}

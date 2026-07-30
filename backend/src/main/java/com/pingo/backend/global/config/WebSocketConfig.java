package com.pingo.backend.global.config;

import com.pingo.backend.signaling.handler.SignalingWebSocketHandler;
import com.pingo.backend.signaling.auth.SignalingHandshakeInterceptor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.StringUtils;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

import java.util.List;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final SignalingWebSocketHandler signalingWebSocketHandler;
    private final SignalingHandshakeInterceptor signalingHandshakeInterceptor;
    private final List<String> allowedOriginPatterns;

    public WebSocketConfig(
            SignalingWebSocketHandler signalingWebSocketHandler,
            SignalingHandshakeInterceptor signalingHandshakeInterceptor,
            @Value("${signaling.websocket.allowed-origin-patterns}") List<String> allowedOriginPatterns
    ) {
        this.signalingWebSocketHandler = signalingWebSocketHandler;
        this.signalingHandshakeInterceptor = signalingHandshakeInterceptor;
        this.allowedOriginPatterns = allowedOriginPatterns.stream()
                .map(String::trim)
                .filter(StringUtils::hasText)
                .toList();
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(signalingWebSocketHandler, "/ws/signaling")
                .addInterceptors(signalingHandshakeInterceptor)
                .setAllowedOriginPatterns(allowedOriginPatterns.toArray(String[]::new));
    }
}

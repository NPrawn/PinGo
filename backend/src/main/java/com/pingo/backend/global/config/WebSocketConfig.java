package com.pingo.backend.global.config;

import com.pingo.backend.signaling.handler.SignalingWebSocketHandler;
import com.pingo.backend.signaling.auth.SignalingHandshakeInterceptor;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketConfigurer {

    private final SignalingWebSocketHandler signalingWebSocketHandler;
    private final SignalingHandshakeInterceptor signalingHandshakeInterceptor;

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(signalingWebSocketHandler, "/ws/signaling")
                .addInterceptors(signalingHandshakeInterceptor)
                .setAllowedOriginPatterns("*");
    }
}

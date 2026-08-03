package com.pingo.backend.global.config;

import com.pingo.backend.signaling.handler.SignalingWebSocketHandler;
import com.pingo.backend.signaling.auth.SignalingHandshakeInterceptor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Lazy;
import org.springframework.util.StringUtils;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import org.springframework.web.socket.server.standard.ServletServerContainerFactoryBean;

import java.util.List;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final SignalingWebSocketHandler signalingWebSocketHandler;
    private final SignalingHandshakeInterceptor signalingHandshakeInterceptor;
    private final List<String> allowedOriginPatterns;
    private final int maxTextMessageBufferSize;

    public WebSocketConfig(
            SignalingWebSocketHandler signalingWebSocketHandler,
            SignalingHandshakeInterceptor signalingHandshakeInterceptor,
            @Value("${signaling.websocket.allowed-origin-patterns}") List<String> allowedOriginPatterns,
            @Value("${signaling.websocket.max-text-message-buffer-size}") int maxTextMessageBufferSize
    ) {
        this.signalingWebSocketHandler = signalingWebSocketHandler;
        this.signalingHandshakeInterceptor = signalingHandshakeInterceptor;
        this.allowedOriginPatterns = allowedOriginPatterns.stream()
                .map(String::trim)
                .filter(StringUtils::hasText)
                .toList();
        this.maxTextMessageBufferSize = maxTextMessageBufferSize;
    }

    /**
     * WebSocket 한 통에 담을 수 있는 텍스트 크기를 올린다.
     *
     * 컨테이너 기본값은 8KB 인데, WebRTC 의 SDP(offer·answer)는 코덱 목록만으로도 그보다
     * 훨씬 커진다. 넘치는 순간 컨테이너는 메시지를 버리는 게 아니라 연결을 통째로 닫는다
     * (close code 1009). 그래서 상담자가 offer 를 보내는 바로 그 시점에 signaling 이
     * 끊기고, 협상이 시작조차 못 해 사용자 화면이 상담자에게 영영 도착하지 않았다.
     *
     * 버퍼는 세션마다 미리 잡히므로 무작정 키우지 않는다. SDP 는 이 크기에 한참 못 미친다.
     */
    @Bean
    @Lazy
    public ServletServerContainerFactoryBean createWebSocketContainer() {
        ServletServerContainerFactoryBean container = new ServletServerContainerFactoryBean();
        container.setMaxTextMessageBufferSize(maxTextMessageBufferSize);
        return container;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(signalingWebSocketHandler, "/ws/signaling")
                .addInterceptors(signalingHandshakeInterceptor)
                .setAllowedOriginPatterns(allowedOriginPatterns.toArray(String[]::new));
    }
}

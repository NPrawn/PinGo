package com.pingo.backend.global.config;

import com.pingo.backend.signaling.auth.SignalingHandshakeInterceptor;
import com.pingo.backend.signaling.handler.SignalingWebSocketHandler;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistration;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import org.springframework.web.socket.server.standard.ServletServerContainerFactoryBean;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
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
                List.of("http://localhost:5173", " https://jenkins.example.invalid "),
                65536
        );

        config.registerWebSocketHandlers(registry);

        verify(registration).setAllowedOriginPatterns(
                "http://localhost:5173",
                "https://jenkins.example.invalid"
        );
    }

    /**
     * SDP 한 통이 들어갈 자리를 잡아 둬야 한다.
     *
     * 컨테이너 기본값 8KB 는 WebRTC 의 offer 를 담지 못한다. 넘치면 컨테이너가 연결을
     * 1009 로 닫아 버려, 협상이 시작되는 바로 그 순간 signaling 이 끊긴다.
     */
    @Test
    void webSocketContainerHoldsWholeSdpMessage() {
        WebSocketConfig config = new WebSocketConfig(
                mock(SignalingWebSocketHandler.class),
                mock(SignalingHandshakeInterceptor.class),
                List.of("http://localhost:5173"),
                65536
        );

        ServletServerContainerFactoryBean container = config.createWebSocketContainer();

        assertThat(container.getObject()).isNull();
        assertThat(ReflectionTestUtils.getField(container, "maxTextMessageBufferSize"))
                .isEqualTo(65536);
    }
}

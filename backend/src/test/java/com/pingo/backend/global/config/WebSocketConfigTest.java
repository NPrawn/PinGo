package com.pingo.backend.global.config;

import com.pingo.backend.signaling.auth.SignalingHandshakeInterceptor;
import com.pingo.backend.signaling.handler.SignalingWebSocketHandler;
import org.apache.catalina.Context;
import org.junit.jupiter.api.Test;
import org.springframework.boot.tomcat.TomcatContextCustomizer;
import org.springframework.boot.tomcat.servlet.TomcatServletWebServerFactory;
import org.springframework.boot.web.server.WebServerFactoryCustomizer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistration;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

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
     *
     * `ServletServerContainerFactoryBean`으로 직접 검증하지 않는다 — 그 Bean은 실제 내장
     * 톰캣이 떠야만 존재하는 `ServerContainer` 속성을 요구해서, `@SpringBootTest`의
     * MockServletContext 환경(이 프로젝트의 다른 통합 테스트 대부분이 쓰는 방식)에서
     * 컨텍스트 전체를 못 띄운다. 대신 톰캣이 실제로 읽는 context init-param을 커스터마이저가
     * 심어 두는지를 검증한다.
     */
    @Test
    void webSocketContainerHoldsWholeSdpMessage() {
        WebSocketConfig config = new WebSocketConfig(
                mock(SignalingWebSocketHandler.class),
                mock(SignalingHandshakeInterceptor.class),
                List.of("http://localhost:5173"),
                65536
        );

        WebServerFactoryCustomizer<TomcatServletWebServerFactory> customizer =
                config.websocketBufferSizeCustomizer();
        TomcatServletWebServerFactory factory = new TomcatServletWebServerFactory();
        customizer.customize(factory);

        Context context = mock(Context.class);
        for (TomcatContextCustomizer contextCustomizer : factory.getContextCustomizers()) {
            contextCustomizer.customize(context);
        }

        verify(context).addParameter("org.apache.tomcat.websocket.textBufferSize", "65536");
    }
}

package com.pingo.backend.global.config;

import com.pingo.backend.signaling.handler.SignalingWebSocketHandler;
import com.pingo.backend.signaling.auth.SignalingHandshakeInterceptor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.tomcat.servlet.TomcatServletWebServerFactory;
import org.springframework.boot.web.server.WebServerFactoryCustomizer;
import org.springframework.context.annotation.Bean;
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
     *
     * `ServletServerContainerFactoryBean`(JSR-356 API)으로는 만들면 안 된다. 그 Bean은
     * `afterPropertiesSet()`에서 ServletContext에 `jakarta.websocket.server.ServerContainer`
     * 속성이 있어야 한다고 단언하는데, 그 속성은 실제 내장 톰캣이 뜰 때만 채워진다.
     * `@SpringBootTest`(기본 MOCK 웹 환경)는 `MockServletContext`를 쓰므로 이 속성이 없어
     * 컨텍스트 전체가 뜨지 못하고, 그 컨텍스트를 공유하는 테스트가 통째로 실패한다. 대신
     * 톰캣이 자기 WebSocket 초기화(WsSci)에서 직접 읽는 context init-param
     * (`org.apache.tomcat.websocket.textBufferSize`)을 심어 둔다 — 이 커스터마이저는
     * 스프링부트가 실제 `TomcatServletWebServerFactory`로 서버를 띄울 때만 불리므로
     * MOCK 웹 환경에서는 아예 실행되지 않아 테스트에 영향이 없다.
     */
    @Bean
    public WebServerFactoryCustomizer<TomcatServletWebServerFactory> websocketBufferSizeCustomizer() {
        return factory -> factory.addContextCustomizers(context ->
                context.addParameter(
                        "org.apache.tomcat.websocket.textBufferSize",
                        String.valueOf(maxTextMessageBufferSize)));
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(signalingWebSocketHandler, "/ws/signaling")
                .addInterceptors(signalingHandshakeInterceptor)
                .setAllowedOriginPatterns(allowedOriginPatterns.toArray(String[]::new));
    }
}

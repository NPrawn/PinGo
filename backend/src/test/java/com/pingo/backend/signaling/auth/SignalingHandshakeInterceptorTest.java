package com.pingo.backend.signaling.auth;

import com.pingo.backend.signaling.dto.SignalingSenderType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.web.socket.WebSocketHandler;

import java.net.URI;
import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

class SignalingHandshakeInterceptorTest {

    private SignalingAccessTokenProvider signalingAccessTokenProvider;
    private SignalingHandshakeInterceptor interceptor;

    @BeforeEach
    void setUp() {
        signalingAccessTokenProvider = mock(SignalingAccessTokenProvider.class);
        interceptor = new SignalingHandshakeInterceptor(signalingAccessTokenProvider);
    }

    @Test
    void beforeHandshakeStoresPrincipalFromQueryToken() {
        SignalingPrincipal principal = new SignalingPrincipal(
                "cs_abc123",
                SignalingSenderType.USER,
                "usr_abc123",
                null
        );
        given(signalingAccessTokenProvider.parseToken("query-token")).willReturn(principal);
        Map<String, Object> attributes = new HashMap<>();

        boolean result = interceptor.beforeHandshake(
                request("ws://localhost:8080/ws/signaling?token=query-token", new HttpHeaders()),
                mock(ServerHttpResponse.class),
                mock(WebSocketHandler.class),
                attributes
        );

        assertThat(result).isTrue();
        assertThat(attributes)
                .containsEntry(SignalingHandshakeInterceptor.SIGNALING_PRINCIPAL_ATTRIBUTE, principal);
    }

    @Test
    void beforeHandshakeStoresPrincipalFromAuthorizationHeader() {
        SignalingPrincipal principal = new SignalingPrincipal(
                "cs_abc123",
                SignalingSenderType.COUNSELOR,
                null,
                100L
        );
        given(signalingAccessTokenProvider.parseToken("header-token")).willReturn(principal);
        HttpHeaders headers = new HttpHeaders();
        headers.add(HttpHeaders.AUTHORIZATION, "Bearer header-token");
        Map<String, Object> attributes = new HashMap<>();

        boolean result = interceptor.beforeHandshake(
                request("ws://localhost:8080/ws/signaling", headers),
                mock(ServerHttpResponse.class),
                mock(WebSocketHandler.class),
                attributes
        );

        assertThat(result).isTrue();
        assertThat(attributes)
                .containsEntry(SignalingHandshakeInterceptor.SIGNALING_PRINCIPAL_ATTRIBUTE, principal);
    }

    @Test
    void beforeHandshakePrefersQueryTokenOverAuthorizationHeader() {
        SignalingPrincipal principal = new SignalingPrincipal(
                "cs_abc123",
                SignalingSenderType.USER,
                "usr_abc123",
                null
        );
        given(signalingAccessTokenProvider.parseToken("query-token")).willReturn(principal);
        HttpHeaders headers = new HttpHeaders();
        headers.add(HttpHeaders.AUTHORIZATION, "Bearer header-token");
        Map<String, Object> attributes = new HashMap<>();

        interceptor.beforeHandshake(
                request("ws://localhost:8080/ws/signaling?token=query-token", headers),
                mock(ServerHttpResponse.class),
                mock(WebSocketHandler.class),
                attributes
        );

        verify(signalingAccessTokenProvider).parseToken("query-token");
        verify(signalingAccessTokenProvider, never()).parseToken("header-token");
    }

    @Test
    void beforeHandshakeKeepsConnectionWhenTokenIsMissing() {
        Map<String, Object> attributes = new HashMap<>();

        boolean result = interceptor.beforeHandshake(
                request("ws://localhost:8080/ws/signaling", new HttpHeaders()),
                mock(ServerHttpResponse.class),
                mock(WebSocketHandler.class),
                attributes
        );

        assertThat(result).isTrue();
        assertThat(attributes).doesNotContainKey(SignalingHandshakeInterceptor.SIGNALING_PRINCIPAL_ATTRIBUTE);
        verify(signalingAccessTokenProvider, never()).parseToken(org.mockito.ArgumentMatchers.anyString());
    }

    @Test
    void beforeHandshakeKeepsConnectionWhenTokenIsInvalid() {
        given(signalingAccessTokenProvider.parseToken("invalid-token"))
                .willThrow(new IllegalArgumentException("invalid token"));
        Map<String, Object> attributes = new HashMap<>();

        boolean result = interceptor.beforeHandshake(
                request("ws://localhost:8080/ws/signaling?token=invalid-token", new HttpHeaders()),
                mock(ServerHttpResponse.class),
                mock(WebSocketHandler.class),
                attributes
        );

        assertThat(result).isTrue();
        assertThat(attributes).doesNotContainKey(SignalingHandshakeInterceptor.SIGNALING_PRINCIPAL_ATTRIBUTE);
    }

    private ServerHttpRequest request(String uri, HttpHeaders headers) {
        ServerHttpRequest request = mock(ServerHttpRequest.class);
        given(request.getURI()).willReturn(URI.create(uri));
        given(request.getHeaders()).willReturn(headers);
        return request;
    }
}

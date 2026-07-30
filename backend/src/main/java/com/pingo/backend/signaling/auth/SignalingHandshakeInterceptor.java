package com.pingo.backend.signaling.auth;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class SignalingHandshakeInterceptor implements HandshakeInterceptor {

    public static final String SIGNALING_PRINCIPAL_ATTRIBUTE = "signalingPrincipal";
    private static final String TOKEN_QUERY_PARAM = "token";
    private static final String BEARER_PREFIX = "Bearer ";

    private final SignalingAccessTokenProvider signalingAccessTokenProvider;

    @Override
    public boolean beforeHandshake(
            ServerHttpRequest request,
            ServerHttpResponse response,
            WebSocketHandler wsHandler,
            Map<String, Object> attributes
    ) {
        String token = resolveToken(request);
        if (!StringUtils.hasText(token)) {
            return true;
        }

        try {
            SignalingPrincipal principal = signalingAccessTokenProvider.parseToken(token);
            attributes.put(SIGNALING_PRINCIPAL_ATTRIBUTE, principal);
        } catch (RuntimeException exception) {
            log.warn("Invalid signaling access token for WebSocket handshake.", exception);
        }

        return true;
    }

    @Override
    public void afterHandshake(
            ServerHttpRequest request,
            ServerHttpResponse response,
            WebSocketHandler wsHandler,
            Exception exception
    ) {
    }

    private String resolveToken(ServerHttpRequest request) {
        String queryToken = UriComponentsBuilder.fromUri(request.getURI())
                .build()
                .getQueryParams()
                .getFirst(TOKEN_QUERY_PARAM);
        if (StringUtils.hasText(queryToken)) {
            return queryToken;
        }

        String authorization = request.getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
        if (StringUtils.hasText(authorization) && authorization.startsWith(BEARER_PREFIX)) {
            return authorization.substring(BEARER_PREFIX.length());
        }

        return null;
    }
}

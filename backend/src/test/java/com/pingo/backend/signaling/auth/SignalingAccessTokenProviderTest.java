package com.pingo.backend.signaling.auth;

import com.pingo.backend.auth.domain.AccountType;
import com.pingo.backend.global.security.JwtProvider;
import com.pingo.backend.signaling.dto.SignalingSenderType;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.security.SignatureException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SignalingAccessTokenProviderTest {

    private static final String SECRET = "test-secret-key-for-jwt-must-be-long-enough-1234567890";
    private static final long EXPIRATION_MS = 600_000L;

    private SignalingAccessTokenProvider tokenProvider;

    @BeforeEach
    void setUp() {
        tokenProvider = new SignalingAccessTokenProvider(SECRET, EXPIRATION_MS);
    }

    @Test
    void createUserTokenReturnsUserSignalingPrincipal() {
        String token = tokenProvider.createUserToken("cs_abc123", "usr_abc123");

        SignalingPrincipal principal = tokenProvider.parseToken(token);

        assertThat(principal.consultationId()).isEqualTo("cs_abc123");
        assertThat(principal.senderType()).isEqualTo(SignalingSenderType.USER);
        assertThat(principal.userSessionId()).isEqualTo("usr_abc123");
        assertThat(principal.accountId()).isNull();
    }

    @Test
    void createCounselorTokenReturnsCounselorSignalingPrincipal() {
        String token = tokenProvider.createCounselorToken("cs_abc123", 100L);

        SignalingPrincipal principal = tokenProvider.parseToken(token);

        assertThat(principal.consultationId()).isEqualTo("cs_abc123");
        assertThat(principal.senderType()).isEqualTo(SignalingSenderType.COUNSELOR);
        assertThat(principal.userSessionId()).isNull();
        assertThat(principal.accountId()).isEqualTo(100L);
    }

    @Test
    void parseTokenRejectsAccountJwt() {
        JwtProvider jwtProvider = new JwtProvider(SECRET, EXPIRATION_MS);
        String accountToken = jwtProvider.createAccountToken(100L, AccountType.COUNSELOR, 1L);

        assertThatThrownBy(() -> tokenProvider.parseToken(accountToken))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void parseTokenRejectsDifferentSecretToken() {
        SignalingAccessTokenProvider otherProvider = new SignalingAccessTokenProvider(
                "different-secret-key-that-does-not-match-1234567890",
                EXPIRATION_MS
        );
        String token = tokenProvider.createUserToken("cs_abc123", "usr_abc123");

        assertThatThrownBy(() -> otherProvider.parseToken(token))
                .isInstanceOf(SignatureException.class);
    }

    @Test
    void parseTokenRejectsExpiredToken() {
        SignalingAccessTokenProvider expiredProvider = new SignalingAccessTokenProvider(SECRET, -1000L);
        String token = expiredProvider.createUserToken("cs_abc123", "usr_abc123");

        assertThatThrownBy(() -> tokenProvider.parseToken(token))
                .isInstanceOf(ExpiredJwtException.class);
    }
}

package com.pingo.backend.global.security;

import com.pingo.backend.auth.domain.AccountType;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.security.SignatureException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JwtProviderTest {

    private static final String SECRET = "test-secret-key-for-jwt-must-be-long-enough-1234567890";
    private static final long EXPIRATION_MS = 3_600_000L;

    private JwtProvider jwtProvider;

    @BeforeEach
    void setUp() {
        jwtProvider = new JwtProvider(SECRET, EXPIRATION_MS);
    }

    @Test
    void 토큰_발급후_파싱하면_동일한_계정정보를_얻는다() {
        // given
        Long accountId = 1L;
        AccountType accountType = AccountType.COUNSELOR;
        Long stationId = 3L;

        // when
        String token = jwtProvider.createAccountToken(accountId, accountType, stationId);
        JwtPrincipal principal = jwtProvider.parseToken(token);

        // then
        assertThat(principal.accountId()).isEqualTo(accountId);
        assertThat(principal.accountType()).isEqualTo(accountType);
        assertThat(principal.stationId()).isEqualTo(stationId);
    }

    @Test
    void 관리자_토큰은_stationId가_null이다() {
        // given
        String token = jwtProvider.createAccountToken(2L, AccountType.ADMIN, null);

        // when
        JwtPrincipal principal = jwtProvider.parseToken(token);

        // then
        assertThat(principal.accountType()).isEqualTo(AccountType.ADMIN);
        assertThat(principal.stationId()).isNull();
    }

    @Test
    void 다른_시크릿으로_서명된_토큰을_파싱하면_예외가_발생한다() {
        // given
        String token = jwtProvider.createAccountToken(1L, AccountType.COUNSELOR, 1L);
        JwtProvider otherProvider = new JwtProvider(
                "different-secret-key-that-does-not-match-1234567890", EXPIRATION_MS);

        // when & then
        assertThatThrownBy(() -> otherProvider.parseToken(token))
                .isInstanceOf(SignatureException.class);
    }

    @Test
    void 만료된_토큰을_파싱하면_예외가_발생한다() {
        // given
        JwtProvider expiredProvider = new JwtProvider(SECRET, -1000L);
        String token = expiredProvider.createAccountToken(1L, AccountType.COUNSELOR, 1L);

        // when & then
        assertThatThrownBy(() -> jwtProvider.parseToken(token))
                .isInstanceOf(ExpiredJwtException.class);
    }
}
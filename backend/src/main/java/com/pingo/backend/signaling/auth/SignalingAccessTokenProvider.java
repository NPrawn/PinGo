package com.pingo.backend.signaling.auth;

import com.pingo.backend.signaling.dto.SignalingSenderType;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

@Component
public class SignalingAccessTokenProvider {

    private static final String SENDER_TYPE_CLAIM = "senderType";
    private static final String USER_SESSION_ID_CLAIM = "userSessionId";
    private static final String ACCOUNT_ID_CLAIM = "accountId";

    private final SecretKey key;
    private final long expirationMs;

    public SignalingAccessTokenProvider(
            @Value("${jwt.secret}") String secret,
            @Value("${signaling.access-token.expiration-ms}") long expirationMs
    ) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expirationMs = expirationMs;
    }

    public String createUserToken(String consultationId, String userSessionId) {
        Date now = new Date();
        return Jwts.builder()
                .subject(consultationId)
                .claim(SENDER_TYPE_CLAIM, SignalingSenderType.USER.name())
                .claim(USER_SESSION_ID_CLAIM, userSessionId)
                .issuedAt(now)
                .expiration(new Date(now.getTime() + expirationMs))
                .signWith(key)
                .compact();
    }

    public String createCounselorToken(String consultationId, Long accountId) {
        Date now = new Date();
        return Jwts.builder()
                .subject(consultationId)
                .claim(SENDER_TYPE_CLAIM, SignalingSenderType.COUNSELOR.name())
                .claim(ACCOUNT_ID_CLAIM, accountId)
                .issuedAt(now)
                .expiration(new Date(now.getTime() + expirationMs))
                .signWith(key)
                .compact();
    }

    public SignalingPrincipal parseToken(String token) {
        Claims claims = Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();

        String consultationId = claims.getSubject();
        SignalingSenderType senderType = parseSenderType(claims);
        String userSessionId = claims.get(USER_SESSION_ID_CLAIM, String.class);
        Long accountId = parseAccountId(claims);

        return new SignalingPrincipal(consultationId, senderType, userSessionId, accountId);
    }

    private SignalingSenderType parseSenderType(Claims claims) {
        String senderType = claims.get(SENDER_TYPE_CLAIM, String.class);
        if (senderType == null) {
            throw new IllegalArgumentException("Missing signaling senderType claim.");
        }

        return SignalingSenderType.valueOf(senderType);
    }

    private Long parseAccountId(Claims claims) {
        Object accountIdClaim = claims.get(ACCOUNT_ID_CLAIM);
        return accountIdClaim == null ? null : Long.valueOf(accountIdClaim.toString());
    }
}

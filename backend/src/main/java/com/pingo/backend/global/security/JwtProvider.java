package com.pingo.backend.global.security;

import com.pingo.backend.auth.domain.AccountType;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

@Component
public class JwtProvider {

    private final SecretKey key;
    private final long expirationMs;

    public JwtProvider(
            @Value("${jwt.secret}") String secret,
            @Value("${jwt.expiration-ms}") long  expirationMs
    ){
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expirationMs = expirationMs;
    }

    public String createAccountToken(Long accountId, AccountType accountType, Long stationId){
        Date now = new Date();
        return Jwts.builder()
                .subject(String.valueOf(accountId))
                .claim("role",accountType.name())
                .claim("stationId",stationId)
                .issuedAt(now)
                .expiration(new Date(now.getTime() + expirationMs))
                .signWith(key)
                .compact();
    }

    public JwtPrincipal parseToken(String token){
        Claims claims = Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();

        Long accountId = Long.valueOf(claims.getSubject());
        AccountType accountType = AccountType.valueOf(claims.get("role", String.class));
        Object stationIdClaim = claims.get("stationId");
        Long stationId = stationIdClaim == null ? null : Long.valueOf(stationIdClaim.toString());

        return new JwtPrincipal(accountId,accountType,stationId);
    }
}

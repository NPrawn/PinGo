package com.pingo.backend.global.security;

import com.pingo.backend.auth.domain.Account;
import com.pingo.backend.auth.domain.AccountType;
import com.pingo.backend.auth.repository.AccountRepository;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@org.springframework.test.context.ActiveProfiles("local")
@Transactional
class SecurityFilterChainTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtProvider jwtProvider;

    @Autowired
    private AccountRepository accountRepository;

    @Value("${jwt.secret}")
    private String jwtSecret;

    private Long adminAccountId;

    @BeforeEach
    void setUp() {
        Account admin = Account.signUpAdmin("test-admin", "test-password-hash", "테스트 관리자");
        adminAccountId = accountRepository.save(admin).getAccountId();
    }

    // ---- 비로그인 사용자 ----

    @Test
    void 비로그인_공개조회API_200() throws Exception {
        mockMvc.perform(get("/api/stations/1"))
                .andExpect(status().isOk());
    }

    @Test
    void 비로그인_관리자API_401() throws Exception {
        mockMvc.perform(get("/api/admin/stations"))
                .andExpect(status().isUnauthorized());
    }

    // ---- ADMIN ----

    @Test
    void ADMIN_관리자API_200() throws Exception {
        String token = jwtProvider.createAccountToken(adminAccountId, AccountType.ADMIN, null);

        mockMvc.perform(get("/api/admin/stations")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
    }

    // ---- COUNSELOR ----
    // ROLE_COUNSELOR 전용 엔드포인트가 아직 없어서(consultation 패키지 .gitkeep 상태) 보류.

    @Disabled("ROLE_COUNSELOR 전용 엔드포인트 미구현 - ConsultationController 구현 후 활성화")
    @Test
    void COUNSELOR_상담자API_200() throws Exception {
    }

    // ---- 토큰 이상 ----

    @Test
    void 변조된토큰_401() throws Exception {
        mockMvc.perform(get("/api/admin/stations")
                        .header("Authorization", "Bearer invalid.jwt.token"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void 만료된토큰_401() throws Exception {
        SecretKey key = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
        Date past = new Date(System.currentTimeMillis() - 1000);

        String expiredToken = Jwts.builder()
                .subject(String.valueOf(adminAccountId))
                .claim("role", AccountType.ADMIN.name())
                .issuedAt(new Date(past.getTime() - 1000))
                .expiration(past)
                .signWith(key)
                .compact();

        mockMvc.perform(get("/api/admin/stations")
                        .header("Authorization", "Bearer " + expiredToken))
                .andExpect(status().isUnauthorized());
    }
}
package com.pingo.backend.global.security;

import com.pingo.backend.auth.domain.Account;
import com.pingo.backend.auth.domain.AccountType;
import com.pingo.backend.auth.repository.AccountRepository;
import com.pingo.backend.station.domain.Station;
import com.pingo.backend.station.repository.StationRepository;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.MediaType;

import javax.crypto.SecretKey;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.Date;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

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

    @Autowired
    private StationRepository stationRepository;

    @Value("${jwt.secret}")
    private String jwtSecret;

    private Long adminAccountId;
    private Long stationId;

    private Long counselorAccountId;

    @BeforeEach
    void setUp() {
        Account admin = Account.signUpAdmin("test-admin", "test-password-hash", "테스트 관리자");
        adminAccountId = accountRepository.save(admin).getAccountId();

        Station station = Station.create(
                "강남역",
                "Gangnam Station",
                "2호선",
                new BigDecimal("37.4979"),
                new BigDecimal("127.0276")
        );
        stationId = stationRepository.save(station).getId();

        Account counselor = Account.signUpCounselor("test-counselor", "test-password-hash", "테스트 상담자", stationId);
        counselor.approve();
        counselorAccountId = accountRepository.save(counselor).getAccountId();

    }

    // ---- 비로그인 사용자 ----

    @Test
    void 비로그인_공개조회API_200() throws Exception {
        mockMvc.perform(get("/api/stations/" + stationId))
                .andExpect(status().isOk());
    }


    @Test
    void 비로그인_관리자API_401() throws Exception {
        mockMvc.perform(get("/api/admin/stations"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void 비로그인_외부지도API_200() throws Exception {
        String body = """
            {
              "provider": "kakao",
              "origin": {
                "latitude": 37.4982,
                "longitude": 127.0281
              },
              "destination": {
                "placeId": 3,
                "name": "COEX Mall",
                "latitude": 37.5118,
                "longitude": 127.0592,
                "address": "서울특별시 강남구 영동대로 513"
              },
              "mode": "walking"
            }
            """;

        mockMvc.perform(post("/api/external-maps/directions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk());
    }

    // ---- ADMIN ----

    @Test
    void ADMIN_관리자API_200() throws Exception {
        String token = jwtProvider.createAccountToken(adminAccountId, AccountType.ADMIN, null);

        mockMvc.perform(get("/api/admin/stations")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
    }

    @Test
    void ADMIN_상담자API_403() throws Exception {
        String token = jwtProvider.createAccountToken(adminAccountId, AccountType.ADMIN, null);

        mockMvc.perform(get("/api/counselors/me")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    // ---- COUNSELOR ----

    @Test
    void COUNSELOR_상담자API_200() throws Exception {
        String token = jwtProvider.createAccountToken(counselorAccountId, AccountType.COUNSELOR, stationId);

        mockMvc.perform(get("/api/counselors/me")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());

    }

    @Test
    void COUNSELOR_관리자API_403() throws Exception {
        String token = jwtProvider.createAccountToken(counselorAccountId, AccountType.COUNSELOR, stationId);

        mockMvc.perform(get("/api/admin/stations")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
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
package com.pingo.backend.global.security;

import com.pingo.backend.auth.domain.Account;
import com.pingo.backend.auth.domain.AccountType;
import com.pingo.backend.auth.repository.AccountRepository;
import com.pingo.backend.consultation.domain.ConsultationSession;
import com.pingo.backend.consultation.domain.ProblemType;
import com.pingo.backend.consultation.repository.ConsultationSessionRepository;
import com.pingo.backend.station.domain.Station;
import com.pingo.backend.station.repository.StationRepository;
import com.pingo.backend.signaling.auth.SignalingAccessTokenProvider;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;

import javax.crypto.SecretKey;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.Date;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
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

    @Autowired
    private StationRepository stationRepository;

    @Autowired
    private ConsultationSessionRepository consultationSessionRepository;

    @Autowired
    private SignalingAccessTokenProvider signalingAccessTokenProvider;

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
    void 로컬_상담자_프론트_5174_CORS_허용() throws Exception {
        mockMvc.perform(options("/api/auth/check-login-id")
                        .header(HttpHeaders.ORIGIN, "http://localhost:5174")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "GET"))
                .andExpect(status().isOk())
                .andExpect(header().string(
                        HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN,
                        "http://localhost:5174"
                ));
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

    @Test
    void 비로그인_위치추정API_200() throws Exception {
        MockMultipartFile image = new MockMultipartFile(
                "image",
                "query.jpg",
                "image/jpeg",
                "image".getBytes(StandardCharsets.UTF_8)
        );

        MockMultipartFile metadata = new MockMultipartFile(
                "metadata",
                "",
                MediaType.APPLICATION_JSON_VALUE,
                """
                {
                  "userSessionId": "usr_sess_01JABC",
                  "stationId": 1,
                  "mapVersion": "YS-2026-07-23.1"
                }
                """.getBytes(StandardCharsets.UTF_8)
        );

        mockMvc.perform(multipart("/api/vps/localize")
                        .file(image)
                        .file(metadata))
                .andExpect(status().isOk());
    }

    @Test
    void 비로그인_userSession_생성_200() throws Exception {
        mockMvc.perform(post("/api/user-sessions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                        {"language":"ko"}
                        """))
                .andExpect(status().isOk());
    }

    @Test
    void 비로그인_상담생성SSE_200() throws Exception {
        mockMvc.perform(get("/api/consultations/consultation-1/waiting-events"))
                .andExpect(status().isOk());
    }

    @Test
    void 비로그인_WebRTC_Fallback_API_200() throws Exception {
        mockMvc.perform(post("/api/consultations/consultation-1/fallback-events")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                    {
                      "type": "VIDEO_FAILED",
                      "reason": "camera permission denied"
                    }
                    """))
                .andExpect(status().isOk());
    }

    @Test
    void 비로그인_DataChannel_Fallback_API_200() throws Exception {
        mockMvc.perform(post("/api/consultations/consultation-1/data-channel-events")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                    {
                      "type": "GUIDE_MESSAGE_SENT",
                      "payload": {
                        "message": "왼쪽으로 이동하세요."
                      }
                    }
                    """))
                .andExpect(status().isOk());
    }

    @Test
    void 비로그인_WebRTC_ICEServer_API_200() throws Exception {
        ConsultationSession session = ConsultationSession.create(
                "usr_abc123",
                stationId,
                ProblemType.CANNOT_FIND_EXIT,
                15L,
                "place",
                3L,
                true,
                true
        );
        session.accept(counselorAccountId);
        consultationSessionRepository.save(session);
        String token = signalingAccessTokenProvider.createUserToken(session.getConsultationId(), "usr_abc123");

        mockMvc.perform(get("/api/webrtc/ice-servers")
                        .param("token", token))
                .andExpect(status().isOk());
    }

    @Test
    void 비로그인_상담수락API_401() throws Exception {
        mockMvc.perform(post("/api/consultations/consultation-1/accept"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void 비로그인_상담거절API_401() throws Exception {
        mockMvc.perform(post("/api/consultations/consultation-1/reject"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void 비로그인_상담종료API_401() throws Exception {
        mockMvc.perform(post("/api/consultations/consultation-1/end"))
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

    @Test
    void ADMIN_상담자API_403() throws Exception {
        String token = jwtProvider.createAccountToken(adminAccountId, AccountType.ADMIN, null);

        mockMvc.perform(get("/api/counselors/me")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }
    @Test
    void ADMIN_상담수락API_403() throws Exception {
        String token = jwtProvider.createAccountToken(adminAccountId, AccountType.ADMIN, null);

        mockMvc.perform(post("/api/consultations/consultation-1/accept")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    @Test
    void ADMIN_상담거절API_403() throws Exception {
        String token = jwtProvider.createAccountToken(adminAccountId, AccountType.ADMIN, null);

        mockMvc.perform(post("/api/consultations/consultation-1/reject")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    @Test
    void ADMIN_상담종료API_403() throws Exception {
        String token = jwtProvider.createAccountToken(adminAccountId, AccountType.ADMIN, null);

        mockMvc.perform(post("/api/consultations/consultation-1/end")
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
    @Test
    void COUNSELOR_상담수락API_인가통과_404() throws Exception {
        String token = jwtProvider.createAccountToken(counselorAccountId, AccountType.COUNSELOR, stationId);

        // 인가(Security)는 통과하고, 존재하지 않는 상담이라 서비스 단에서 404가 나는지 확인
        // (401/403이 아니라는 것 자체가 COUNSELOR 권한으로 필터를 통과했다는 증거)
        mockMvc.perform(post("/api/consultations/consultation-1/accept")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());
    }

    @Test
    void COUNSELOR_상담거절API_인가통과_404() throws Exception {
        String token = jwtProvider.createAccountToken(counselorAccountId, AccountType.COUNSELOR, stationId);

        mockMvc.perform(post("/api/consultations/consultation-1/reject")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());
    }

    @Test
    void COUNSELOR_상담종료API_인가통과_404() throws Exception {
        String token = jwtProvider.createAccountToken(counselorAccountId, AccountType.COUNSELOR, stationId);

        mockMvc.perform(post("/api/consultations/consultation-1/end")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());
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

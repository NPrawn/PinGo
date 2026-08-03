package com.pingo.backend.usersession.service;

import com.pingo.backend.global.exception.BusinessException;
import com.pingo.backend.global.exception.ErrorCode;
import com.pingo.backend.station.domain.Station;
import com.pingo.backend.station.repository.StationRepository;
import com.pingo.backend.usersession.domain.Language;
import com.pingo.backend.usersession.domain.UserSession;
import com.pingo.backend.usersession.dto.request.UserSessionUpdateRequest;
import com.pingo.backend.usersession.dto.response.UserSessionCreateResponse;
import com.pingo.backend.usersession.dto.response.UserSessionResponse;
import com.pingo.backend.usersession.repository.UserSessionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("local")
@Transactional
public class UserSessionServiceTest {

    @Autowired
    private UserSessionService userSessionService;

    @Autowired
    private UserSessionRepository userSessionRepository;

    @Autowired
    private StationRepository stationRepository;

    private Long stationId;

    @BeforeEach
    void setUp() {
        Station station = stationRepository.save(
                Station.create("테스트역", "TestStation", "1호선", BigDecimal.ZERO, BigDecimal.ZERO)
        );
        stationId = station.getId();
    }

    private String createSession() {
        return userSessionService.create(Language.KO).userSessionId();
    }

    // ---------- 생성 ----------

    @Test
    void language를_지정하면_해당_언어로_세션이_생성된다() {
        UserSessionCreateResponse response = userSessionService.create(Language.EN);

        assertNotNull(response.userSessionId());
        assertEquals(Language.EN, response.language());
        assertNotNull(response.expiresAt());

        UserSession saved = userSessionRepository.findById(response.userSessionId()).orElseThrow();
        assertEquals(Language.EN, saved.getLanguage());
        assertNotNull(saved.getCreatedAt());
        assertNotNull(saved.getLastActiveAt());
    }

    @Test
    void language가_null이면_기본값_영어로_생성된다() {
        assertEquals(Language.EN, userSessionService.create(null).language());
    }

    @Test
    void expiresAt은_생성_시점_기준_6시간_뒤로_설정된다() {
        LocalDateTime before = LocalDateTime.now();
        UserSessionCreateResponse response = userSessionService.create(Language.KO);
        LocalDateTime after = LocalDateTime.now();

        assertTrue(response.expiresAt().isAfter(before.plusHours(6).minusSeconds(5)));
        assertTrue(response.expiresAt().isBefore(after.plusHours(6).plusSeconds(5)));
    }

    // ---------- 조회 ----------

    @Test
    void 세션을_조회하면_현재_상태가_반환된다() {
        String userSessionId = userSessionService.create(Language.EN).userSessionId();
        userSessionService.update(userSessionId, new UserSessionUpdateRequest(
                null, stationId, null, null, null, null, null
        ));

        UserSessionResponse found = userSessionService.get(userSessionId);

        assertEquals(userSessionId, found.userSessionId());
        assertEquals(Language.EN, found.language());
        assertEquals(stationId, found.selectedStationId());
    }

    @Test
    void 존재하지_않는_세션을_조회하면_예외가_발생한다() {
        assertThrows(BusinessException.class, () -> userSessionService.get("존재하지-않는-id"));
    }

    // ---------- 갱신 ----------

    @Test
    void 존재하지_않는_userSessionId로_수정하면_예외가_발생한다() {
        UserSessionUpdateRequest request = new UserSessionUpdateRequest(
                Language.EN, null, null, null, null, null, null
        );

        assertThrows(BusinessException.class,
                () -> userSessionService.update("존재하지-않는-id", request));
    }

    @Test
    void 요청에_포함된_필드만_반영되고_나머지는_그대로_유지된다() {
        String userSessionId = createSession();

        UserSessionResponse updated = userSessionService.update(userSessionId,
                new UserSessionUpdateRequest(Language.EN, stationId, null, null, null, null, null));

        assertEquals(Language.EN, updated.language());

        UserSession saved = userSessionRepository.findById(userSessionId).orElseThrow();
        assertEquals(stationId, saved.getSelectedStationId());
        assertNull(saved.getCurrentNodeId());
        assertNull(saved.getDestinationType());
        assertNull(saved.getDestinationId());
    }

    @Test
    void 존재하지_않는_역_ID로_수정하면_예외가_발생한다() {
        String userSessionId = createSession();

        BusinessException ex = assertThrows(BusinessException.class,
                () -> userSessionService.update(userSessionId, new UserSessionUpdateRequest(
                        null, 999_999L, null, null, null, null, null)));

        assertEquals(ErrorCode.STATION_NOT_FOUND, ex.getErrorCode());
    }

    @Test
    void 존재하지_않는_노드_ID로_수정하면_예외가_발생한다() {
        String userSessionId = createSession();

        BusinessException ex = assertThrows(BusinessException.class,
                () -> userSessionService.update(userSessionId, new UserSessionUpdateRequest(
                        null, null, 999_999L, null, null, null, null)));

        assertEquals(ErrorCode.ROUTE_NODE_NOT_FOUND, ex.getErrorCode());
    }

    // ---------- 목적지 ----------

    @Test
    void destinationType과_destinationId는_함께_보내야_반영된다() {
        String userSessionId = createSession();

        userSessionService.update(userSessionId, new UserSessionUpdateRequest(
                null, null, null, "place", 3L, null, null));

        UserSession saved = userSessionRepository.findById(userSessionId).orElseThrow();
        assertEquals("place", saved.getDestinationType());
        assertEquals(3L, saved.getDestinationId());
    }

    @Test
    void destinationType만_보내면_예외가_발생한다() {
        String userSessionId = createSession();

        BusinessException ex = assertThrows(BusinessException.class,
                () -> userSessionService.update(userSessionId, new UserSessionUpdateRequest(
                        null, null, null, "place", null, null, null)));

        assertEquals(ErrorCode.INVALID_DESTINATION, ex.getErrorCode());
    }

    @Test
    void destinationId만_보내면_예외가_발생한다() {
        String userSessionId = createSession();

        BusinessException ex = assertThrows(BusinessException.class,
                () -> userSessionService.update(userSessionId, new UserSessionUpdateRequest(
                        null, null, null, null, 3L, null, null)));

        assertEquals(ErrorCode.INVALID_DESTINATION, ex.getErrorCode());
    }

    // ---------- GPS·활동 시각 ----------

    @Test
    void GPS_위경도는_둘_다_있어야_반영된다() {
        String userSessionId = createSession();

        userSessionService.update(userSessionId, new UserSessionUpdateRequest(
                null, null, null, null, null, new BigDecimal("37.5665"), null));

        UserSession saved = userSessionRepository.findById(userSessionId).orElseThrow();
        assertNull(saved.getLastGpsLatitude());
        assertNull(saved.getLastGpsLongitude());
    }

    @Test
    void 수정_요청마다_lastActiveAt과_expiresAt이_갱신된다() throws InterruptedException {
        String userSessionId = createSession();
        UserSession before = userSessionRepository.findById(userSessionId).orElseThrow();
        LocalDateTime firstLastActiveAt = before.getLastActiveAt();
        LocalDateTime firstExpiresAt = before.getExpiresAt();

        Thread.sleep(10);

        userSessionService.update(userSessionId, new UserSessionUpdateRequest(
                Language.EN, null, null, null, null, null, null));

        UserSession after = userSessionRepository.findById(userSessionId).orElseThrow();
        assertTrue(after.getLastActiveAt().isAfter(firstLastActiveAt));
        assertEquals(firstExpiresAt, after.getExpiresAt());
    }

    // ---------- 종료 ----------

    @Test
    void 세션을_종료하면_true를_반환하고_이후_조회가_차단된다() {
        String userSessionId = createSession();

        assertTrue(userSessionService.end(userSessionId));
        assertThrows(BusinessException.class, () -> userSessionService.get(userSessionId));
    }

    @Test
    void 이미_종료된_세션을_다시_종료하면_예외가_발생한다() {
        String userSessionId = createSession();
        userSessionService.end(userSessionId);

        BusinessException ex = assertThrows(BusinessException.class,
                () -> userSessionService.end(userSessionId));

        assertEquals(ErrorCode.USER_SESSION_ALREADY_ENDED, ex.getErrorCode());
    }

    @Test
    void 존재하지_않는_세션을_종료하면_예외가_발생한다() {
        assertThrows(BusinessException.class, () -> userSessionService.end("존재하지-않는-id"));
    }

    @Test
    void 만료된_세션은_수정할_수_없다() {
        String userSessionId = createSession();
        userSessionService.end(userSessionId);

        assertThrows(BusinessException.class,
                () -> userSessionService.update(userSessionId, new UserSessionUpdateRequest(
                        Language.EN, null, null, null, null, null, null)));
    }
}

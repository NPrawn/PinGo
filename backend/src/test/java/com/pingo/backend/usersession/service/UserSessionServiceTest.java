package com.pingo.backend.usersession.service;

import com.pingo.backend.global.exception.BusinessException;
import com.pingo.backend.station.domain.Station;
import com.pingo.backend.station.repository.StationRepository;
import com.pingo.backend.usersession.domain.Language;
import com.pingo.backend.usersession.domain.UserSession;
import com.pingo.backend.usersession.dto.request.UserSessionUpdateRequest;
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

    @Test
    void language를_지정하면_해당_언어로_세션이_생성된다() {
        UserSessionResponse response = userSessionService.create(Language.EN);

        assertNotNull(response.userSessionId());
        assertEquals(Language.EN, response.language());
        assertNotNull(response.expiresAt());

        UserSession saved = userSessionRepository.findById(response.userSessionId()).orElseThrow();
        assertEquals(Language.EN, saved.getLanguage());
        assertNotNull(saved.getCreatedAt());
        assertNotNull(saved.getLastActiveAt());
    }

    @Test
    void language가_null이면_기본값_한국어로_생성된다() {
        UserSessionResponse response = userSessionService.create(null);

        assertEquals(Language.KO, response.language());
    }

    @Test
    void expiresAt은_생성_시점_기준_24시간_뒤로_설정된다() {
        LocalDateTime before = LocalDateTime.now();
        UserSessionResponse response = userSessionService.create(Language.KO);
        LocalDateTime after = LocalDateTime.now();

        assertTrue(response.expiresAt().isAfter(before.plusHours(24).minusSeconds(5)));
        assertTrue(response.expiresAt().isBefore(after.plusHours(24).plusSeconds(5)));
    }

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
        String userSessionId = userSessionService.create(Language.KO).userSessionId();

        UserSessionUpdateRequest request = new UserSessionUpdateRequest(
                Language.EN, stationId, null, null, null, null, null
        );
        UserSessionResponse updated = userSessionService.update(userSessionId, request);

        assertEquals(Language.EN, updated.language());

        UserSession saved = userSessionRepository.findById(userSessionId).orElseThrow();
        assertEquals(stationId, saved.getSelectedStationId());
        assertNull(saved.getCurrentNodeId());
        assertNull(saved.getDestinationType());
        assertNull(saved.getDestinationId());
    }

    @Test
    void destinationType과_destinationId는_각각_독립적으로_수정된다() {
        String userSessionId = userSessionService.create(Language.KO).userSessionId();

        userSessionService.update(userSessionId, new UserSessionUpdateRequest(
                null, null, null, "FACILITY", null, null, null
        ));
        UserSession afterTypeOnly = userSessionRepository.findById(userSessionId).orElseThrow();
        assertEquals("FACILITY", afterTypeOnly.getDestinationType());
        assertNull(afterTypeOnly.getDestinationId());

        userSessionService.update(userSessionId, new UserSessionUpdateRequest(
                null, null, null, null, 5L, null, null
        ));
        UserSession afterIdOnly = userSessionRepository.findById(userSessionId).orElseThrow();
        assertEquals("FACILITY", afterIdOnly.getDestinationType());
        assertEquals(5L, afterIdOnly.getDestinationId());
    }

    @Test
    void GPS_위경도는_둘_다_있어야_반영된다() {
        String userSessionId = userSessionService.create(Language.KO).userSessionId();

        userSessionService.update(userSessionId, new UserSessionUpdateRequest(
                null, null, null, null, null, new BigDecimal("37.5665"), null
        ));

        UserSession saved = userSessionRepository.findById(userSessionId).orElseThrow();
        assertNull(saved.getLastGpsLatitude());
        assertNull(saved.getLastGpsLongitude());
    }

    @Test
    void 수정_요청마다_lastActiveAt과_expiresAt이_갱신된다() throws InterruptedException {
        String userSessionId = userSessionService.create(Language.KO).userSessionId();
        LocalDateTime firstLastActiveAt = userSessionRepository.findById(userSessionId)
                .orElseThrow().getLastActiveAt();

        Thread.sleep(10);

        userSessionService.update(userSessionId, new UserSessionUpdateRequest(
                Language.EN, null, null, null, null, null, null
        ));

        UserSession afterUpdate = userSessionRepository.findById(userSessionId).orElseThrow();
        assertTrue(afterUpdate.getLastActiveAt().isAfter(firstLastActiveAt));
    }
}
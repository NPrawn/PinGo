package com.pingo.backend.usersession.repository;

import com.pingo.backend.usersession.domain.UserSession;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertNotNull;

@SpringBootTest
@ActiveProfiles("local")
@Transactional
class UserSessionRepositoryTest {

    @Autowired
    private UserSessionRepository userSessionRepository;

    @Test
    void 저장하고_조회하면_동일한_값이_반환된다() {
        UserSession session = UserSession.create("en");

        UserSession saved = userSessionRepository.save(session);

        Optional<UserSession> found = userSessionRepository.findById(saved.getUserSessionId());

        assertTrue(found.isPresent());
        assertEquals("en", found.get().getLanguage());
        assertNotNull(found.get().getCreatedAt());
        assertNotNull(found.get().getLastActiveAt());
    }
}
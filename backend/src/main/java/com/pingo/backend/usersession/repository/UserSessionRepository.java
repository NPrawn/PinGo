package com.pingo.backend.usersession.repository;

import com.pingo.backend.usersession.domain.UserSession;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserSessionRepository extends JpaRepository<UserSession, String> {
}

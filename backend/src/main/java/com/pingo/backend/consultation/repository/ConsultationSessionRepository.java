package com.pingo.backend.consultation.repository;

import com.pingo.backend.consultation.domain.ConsultationSession;
import com.pingo.backend.consultation.domain.ConsultationStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;

public interface ConsultationSessionRepository extends JpaRepository<ConsultationSession, String> {
    boolean existsByUserSessionIdAndStatusIn(String userSessionId, Collection<ConsultationStatus> statuses);
}

package com.pingo.backend.consultation.repository;

import com.pingo.backend.consultation.domain.ConsultationSession;
import com.pingo.backend.consultation.domain.ConsultationStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import jakarta.persistence.LockModeType;

public interface ConsultationSessionRepository extends JpaRepository<ConsultationSession, String> {
    boolean existsByUserSessionIdAndStatusIn(String userSessionId, Collection<ConsultationStatus> statuses);

    List<ConsultationSession> findAllByStationIdAndStatusInOrderByRequestedAtAsc(
            Long stationId,
            Collection<ConsultationStatus> statuses
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT session FROM ConsultationSession session WHERE session.consultationId = :consultationId")
    Optional<ConsultationSession> findByIdForUpdate(@Param("consultationId") String consultationId);
}

package com.pingo.backend.consultation.repository;

import com.pingo.backend.consultation.domain.ConsultationSession;
import com.pingo.backend.consultation.domain.ConsultationStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ConsultationSessionRepository extends JpaRepository<ConsultationSession, String> {
    boolean existsByUserSessionIdAndStatusIn(String userSessionId, Collection<ConsultationStatus> statuses);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select cs from ConsultationSession cs where cs.consultationId = :consultationId")
    Optional<ConsultationSession> findByIdForUpdate(@Param("consultationId") String consultationId);

    @Query("""
        SELECT cs FROM ConsultationSession cs
        WHERE cs.stationId = :stationId
          AND (:status IS NULL OR cs.status = :status)
        ORDER BY cs.requestedAt ASC
        """)
    List<ConsultationSession> findByStationId(@Param("stationId") Long stationId, @Param("status") ConsultationStatus status);
}

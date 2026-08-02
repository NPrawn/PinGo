package com.pingo.backend.consultation.repository;

import com.pingo.backend.consultation.domain.ConsultationSummary;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface ConsultationSummaryRepository extends JpaRepository<ConsultationSummary, Long> {

    boolean existsByConsultationId(String consultationId);

    Optional<ConsultationSummary> findByConsultationId(String consultationId);
}
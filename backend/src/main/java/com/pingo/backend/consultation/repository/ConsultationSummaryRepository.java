package com.pingo.backend.consultation.repository;

import com.pingo.backend.consultation.domain.ConsultationSummary;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ConsultationSummaryRepository extends JpaRepository<ConsultationSummary, Long> {
    Optional<ConsultationSummary> findByConsultationId(String consultationId);

    List<ConsultationSummary> findAllByConsultationIdIn(Collection<String> consultationIds);
}

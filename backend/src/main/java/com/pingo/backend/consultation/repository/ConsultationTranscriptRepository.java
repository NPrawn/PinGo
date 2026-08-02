package com.pingo.backend.consultation.repository;

import com.pingo.backend.consultation.domain.ConsultationTranscript;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ConsultationTranscriptRepository extends JpaRepository<ConsultationTranscript, Long> {

    List<ConsultationTranscript> findByConsultationIdOrderBySeqAsc(String consultationId);
}
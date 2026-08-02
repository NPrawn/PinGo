package com.pingo.backend.consultation.service;

import com.pingo.backend.consultation.domain.ConsultationSummary;
import com.pingo.backend.consultation.repository.ConsultationSummaryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Component
@RequiredArgsConstructor
public class ConsultationSummaryUpdater {

    private final ConsultationSummaryRepository consultationSummaryRepository;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void complete(String consultationId, String summaryText) {
        consultationSummaryRepository.findByConsultationId(consultationId)
                .ifPresentOrElse(
                        summary -> summary.complete(summaryText),
                        () -> log.warn("요약 대상을 찾을 수 없습니다. consultationId={}", consultationId));
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void fail(String consultationId) {
        consultationSummaryRepository.findByConsultationId(consultationId)
                .ifPresentOrElse(
                        ConsultationSummary::fail,
                        () -> log.warn("요약 대상을 찾을 수 없습니다. consultationId={}", consultationId));
    }
}